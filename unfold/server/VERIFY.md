# Unfold end-to-end verification report

Date: 2026-10-03. Verifier: release-validation pass over `unfold/` (server +
worker-web + student app). All commands below were actually executed on
macOS, Node v25.2.1, npm with the lockfiles committed in each package.

**Overall result: PASS** — all areas green; no cross-package breakage found;
no fixes were required. `MOONSHOT_API_KEY` was not set in the shell, so all
GenAI features were verified on the deterministic fallback path (expected per
the contract), flagged `genai:false`.

---

## 1. Server — install, tests, seed, boot

```bash
cd unfold/server
npm install        # -> found 0 vulnerabilities
npm test           # -> tests 77, pass 77, fail 0 (node --test)
npm run seed       # -> [seed] done; demo.worker@unfold.local / demo1234 (verified),
                   #    new.worker@unfold.local / demo1234 (unverified); idempotent
PORT=8787 node src/index.js &
curl -s http://localhost:8787/api/health
```

Observed health response (no key in env):

```json
{"ok":true,"genai":{"configured":false,"model":"kimi-k3","baseUrl":"https://api.moonshot.ai/v1"},
 "timeouts":{"unclaimedHours":72,"responseHours":48}}
```

Note: `configured:false` only signals the key is absent — the key value is
never exposed by any endpoint. This snapshot is from 2026-10-03, when the
server still defaulted to Moonshot `kimi-k3`. The live server now reports
the Gemini base URL and `gemini-3.8-flash`.

## 2. Full real flow via curl (fallback path, no Moonshot key)

Script: a bash sequence of `curl` calls against `http://localhost:8787`
(device token and worker JWT captured with `node -pe`). Every step below is
the observed output.

| # | Step | Observed |
|---|------|----------|
| 1 | `POST /api/devices/register {installId}` | `201 {"deviceId":"dev_099f…","cloudOrg":false,"token":"676d…"}` |
| 2 | `POST /api/entries/sync` **before consent** | `403 {"error":"cloud_org_not_enabled"}` ✅ consent enforced server-side |
| 3 | `PUT /api/devices/me/consent {cloudOrg:true}` | `{"cloudOrg":true}` |
| 4 | sync 2 entries (sleep/exam note 2025-06-01, family/grades note 2025-06-02) | both classified, `genai:false`; e.g. `{"clientId":"e1","topics":["academic","sleep"],"attributes":["everyday"],"uncertainty":["topics inferred from keywords only"],"genai":false}` |
| 5 | `GET /api/entries` | `entries: 2, links: []` (see Known limitations — fallback linking is deliberately conservative) |
| 6 | `GET /api/analysis` | `{"approaching":false,"explanation":"…automatic keyword pattern check…not a clinical judgement","genai":false}` ✅ disclaimer present |
| 7 | `GET /api/summaries/2025-06-01` | `{"day":"2025-06-01","text":"On 2025-06-01 the notes talked about coursework and sleep.","genai":false}` |
| 8 | `POST /api/ask {"question":"When did I have trouble sleeping?"}` | `{"found":false,"genai":false}` (see Known limitations — exact-word matching) |
| 9 | `POST /api/respond` | `{"kind":"invite-elaboration","text":"Noted. If you like…","genai":false}` |
| 10 | `POST /api/cases` | `201 {"id":"005220bc-…"}` |
| 11 | student `GET /api/cases/active` | `{"status":"queued","claimCount":0,"claimed":false,"waitingNoWorker":false}` |
| 12 | worker login `demo.worker@unfold.local / demo1234` | JWT issued; worker `{verified:true, expertise:["family","sleep"], languages:["zh-HK","en"], max_active:3}` |
| 13 | worker `GET /api/worker/queue` | case visible and **matched** (language `en` + topics `["sleep","family"]` intersect worker expertise), `waitingHours:0`, `atCapacity:false` |
| 14 | `POST /api/worker/cases/:id/claim` | **HTTP 201**, status `claimed` |
| 15 | worker `GET /api/worker/cases/:id` | full case returned; **no `device_id` field** in the payload ✅ |
| 16 | `POST /api/worker/cases/:id/respond` | `201`, status `replied` |
| 17 | student `GET /api/cases/active` | `{"status":"replied","claimed":true,"claimCount":1,"messages":1}` ✅ |
| 18 | student `GET /api/cases/:id/messages` | worker message visible |
| 19 | student `continue` → worker respond again → student `withdraw` | `continued` → second respond **HTTP 201** → `withdrawn` |
| 20 | student `GET /api/cases/active` | `{"case":null}` ✅ |
| 21 | worker `GET /api/worker/cases/:id` after withdraw | still readable by the claimant, `status=withdrawn` — **⚠ superseded (defect H6, since fixed): withdrawn cases now return `404 case_not_found` to workers, even the claimant; `GET .../messages` behaves the same and `POST .../respond` returns `409 invalid_status`. See CONTRACT.md.** |

CORS verified from a web origin:
`OPTIONS /api/worker/queue` with `Origin: http://localhost:4173` → `204` with
`Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: authorization`.

Validation data was removed from the dev database afterwards; the DB is back
to clean seed state (2 seed workers, 0 devices, 0 cases, 0 entries).

## 3. GenAI key check

`MOONSHOT_API_KEY` was **absent** from the shell environment during this run
(`echo ${MOONSHOT_API_KEY:-absent}` → `absent`). Per the task, fallback-only
is recorded as **expected**; no live `genai:true` call could be verified.
Server tests already cover the GenAI-unavailable path, and the health
endpoint confirmed `configured:false`.

## 4. worker-web

```bash
cd unfold/worker-web
npm install     # OK
npm run build   # vite v5.4.21 ✓ 45 modules, dist/index.html 0.42 kB,
                # assets/index-*.js 187.03 kB (59.39 kB gzip), css 6.46 kB
npx vite preview --port 4173 &
curl -s http://localhost:4173/    # HTTP 200, serves index.html
                                  # (<title>Unfold — Social Worker Console</title>)
```

## 5. Student app (Expo)

```bash
cd unfold
npm test          # -> tests 20, pass 20, fail 0
npx tsc --noEmit  # -> exit 0
```

Worker-route removal verified:

- `ls app/` — no `worker/` directory (both `app/worker/index.tsx` and
  `app/worker/[id].tsx` deleted).
- `grep -rn "worker" app/ src/` — remaining hits are only domain references
  (`sender: 'worker' | 'student'`, "social worker" copy, matching helpers in
  `src/api.ts`); **no route reference to `/worker` anywhere**.

Key-safety grep: no `MOONSHOT`/API-key reference in `src/`, `app/`, or
`worker-web/src/` (the only client key is the pre-existing, separately
disclosed `EXPO_PUBLIC_ELEVENLABS_API_KEY` used for audio transcription,
unchanged from the single-device prototype).

## Fallback matrix (observed this run, no key)

| Feature | GenAI path (key set) | Deterministic fallback (this run) | Flag |
|---|---|---|---|
| Entry classification | `classifyEntry` → kimi-k3 topics/attributes | keyword/topic rules | `genai:false` + `uncertainty:["topics inferred from keywords only"]` |
| Cross-record linking | `linkEntries` → kimi-k3 semantic links | ≥2 shared distinctive (>4-char) words across different days; max 10 | links carry no genai flag; none produced for the 2 test entries |
| Daily summary | `dailySummary` → kimi-k3 prose | template: "On \<day\> the notes talked about \<topics\>." | `genai:false` |
| NL Q&A (`/api/ask`) | `ask` → kimi-k3 with verbatim-quote validation | exact word-overlap ranking over synced entries | `genai:false` |
| Brief response (`/api/respond`) | `briefResponse` → kimi-k3 | rule kinds (e.g. `invite-elaboration`), repetition-aware via `recentKinds` | `genai:false` |
| Background analysis | `analyseBackground` → kimi-k3 | difficult-topic recurrence rule + "not a clinical judgement" disclaimer | `genai:false` |
| Case summary draft | `caseSummary` → kimi-k3 | heuristic mainConcerns/recentChange/period | `genai:false` |

All flags surface to the clients so UIs can label output as "server rules —
not AI" / "On-device" (student app) as implemented in `src/api.ts`
(`source:'cloud'|'device'` + `genai`).

## Setting GEMINI_API_KEY

1. `cp unfold/server/.env.example unfold/server/.env`
2. Set `GEMINI_API_KEY=…` in `unfold/server/.env` (or export it in the
   shell before starting the server). Create the key in Google AI Studio.
3. Restart the server. Verify with
   `curl -s http://localhost:8787/api/health` → `"configured":true`.
4. All GenAI features then call
   `https://generativelanguage.googleapis.com/v1beta/openai` model
   `gemini-3.8-flash` server-side and return `genai:true`. If a call fails
   or returns an invalid shape, the server automatically falls back to the
   deterministic path and still flags `genai:false` — clients never break.
5. The key must **never** be placed in the Expo app or worker-web; there is
   no client code path that reads it.

## Known limitations

- **Fallback ask is exact-word matching.** "When did I have trouble
  *sleeping*?" does not match a note containing "*sleep*" (no stemming).
  This is a faithful port of the on-device heuristic (`unfold/src/lib/ask.ts`),
  so server and device fallbacks agree. With a Gemini key the GenAI path
  handles inflections/semantics.
- **Fallback linking is very conservative** (needs ≥2 shared >4-char words on
  different days). The two test entries ("sleep/exam" vs "family/grades")
  share only one such word, so no link was produced. Expected; GenAI linking
  is semantic.
- **Fallback classification of the family note** produced `topics:["academic"]`
  only (the word "grades" matched; "mother" is not in the family keyword list
  which uses mum/mom/dad/parent). Rule-based limitation, `genai:false` and
  `uncertainty` disclose it. Case submission carries client-supplied topics,
  so worker matching is unaffected.
- **Unverified-worker flow** (`new.worker@unfold.local`) is covered by server
  unit tests (`403 not_verified` on all case routes) and by worker-web's
  VerificationPending screen; not re-curled in this pass.
- **Timeouts** (`UNCLAIMED_TIMEOUT_HOURS=72`, `RESPONSE_TIMEOUT_HOURS=48`) are
  covered by sweeper unit tests (auto-rematch of stale claims, `waitingNoWorker`
  read-time flag); no long-wait live test was performed.
- CORS is wide open (`Access-Control-Allow-Origin: *`) — fine for local dev,
  should be restricted to the worker-web origin in a real deployment.
- `JWT_SECRET` defaults to a placeholder; must be changed for any real
  deployment (see `.env.example`).

## Boundary compliance

- No file under `/Users/luo/MmM/unfold/docs/` and no `unfold/README.md` was
  modified by this validation pass (the pre-existing
  `docs/Interim_Progress_Report.md` modification in `git status` has an mtime
  preceding this run and is external to it).
- No fixes were committed: the contract held across all three packages; no
  contract drift, CORS, or field-name breakage was found.
