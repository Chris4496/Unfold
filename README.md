# Unfold

A private voice diary for students. Record on your phone, then decide whether a de-identified summary can be shared with a social worker.

## What the app does

**Student app (`unfold/`)**

- Record voice notes on your phone; audio and transcripts stay on-device
- Transcribe recordings with ElevenLabs Scribe v2
- De-identify text on-device before anything leaves: names, schools, addresses, phones, emails — in English and Chinese
- Organise notes with topics, attributes, daily summaries and "Ask your diary"
- Optional cloud organisation (separate consent in Settings): only de-identified text syncs to the server
  - Turning it on backfills the de-identified text of existing notes
  - Turning it off purges every cloud copy from the server
  - Deleting a note or "Delete everything" also deletes the matching cloud copies
- Share a de-identified case with a social worker, with two-way messaging (worker name shown)
- Withdraw sharing at any time — the worker immediately loses access
- Privacy screen explaining exactly what leaves the phone

**Social-worker console (`unfold/worker-web/`)**

- Register and log in; unverified workers are gated until verified
- Claim cases from a language/expertise-matched queue
- Read de-identified summaries and reply to students
- Withdrawn cases are hidden (indistinguishable from never-shared)

**Server (`unfold/server/`)**

- Worker accounts, consent enforcement and case routing
- All GenAI calls (Moonshot `kimi-k3`) made server-side; empty key falls back to deterministic rules
- Cloud-data deletion lifecycle: per-entry delete, full purge on consent withdrawal
- Background sweeper for stale data

## WorkBuddy evaluation skill (`workbuddy/`)

A multi-agent skill that evaluates a software product by simulating full user journeys:

- **Agent 1 / journey analysis** — journey maps, role & handoff matrices, per-agent task cards, persona cards, and Pro/Flash model-tier recommendations; the report must be approved by the client before anything runs
- **Agent 2 / MCP necessity** — judges whether custom test tooling (MCP) is needed, with a minimal-build alternative; optional developer + reviewer agents build it only on approval
- **User agents** — run the approved journeys through the real product UI, including rejection / revision / cancellation paths, with a shared event-logging contract
- **Agent 3 / validity monitor** — labels each test valid / partially valid / invalid / not-run, and audits task-card coverage
- **Agent 4 / handoff review** — scores cross-role handoffs (send → authorise → receive → withdraw)
- **Exploration phase** — exploratory role-play from persona cards, isolated from reports/code; produces narrative journey logs and friction points, no numeric scores
- **Roundtable phase** — the persona's agents debate in written rounds; output is consensus findings, open disputes, unverified hypotheses and per-role priority votes
- **Scoring & governance** — evidence-based 0–100 scores with pre-fixed weights; privacy/consent/minor-protection violations are blocking items; final summary keeps contradictions instead of merging them

## Architecture

- `unfold/` — the Expo client (iOS / Android / web, this app). Voice notes are recorded and stored on-device; only de-identified text ever syncs, and only after the separate cloud-organisation consent is switched on in Settings.
- `unfold/server/` — the backend: Express 4 + better-sqlite3 (ESM, Node ≥ 20). It holds worker accounts and case routing, and makes every GenAI call server-side against Moonshot `kimi-k3` (`MOONSHOT_API_KEY` from the server environment only — never bundled into the client). An empty key falls back to deterministic rules. The full API contract is in `unfold/server/CONTRACT.md`.
- `unfold/worker-web/` — the social-worker console: Vite + React. Workers register (unverified), log in, and — once verified — claim cases from a language/expertise-matched queue, read de-identified summaries and reply.
- `workbuddy/` — the evaluation tooling: the software-journey-evaluator skill plus `test-runs/` evidence from past evaluation runs (not part of the product).

## Running it

The client:

```bash
cd unfold
npm install
npm test
npm run web
```

The server (port 8787 by default):

```bash
cd unfold/server
npm install
npm run seed   # demo.worker@unfold.local / demo1234 (verified), new.worker@unfold.local / demo1234 (unverified)
npm run dev
```

The worker console:

```bash
cd unfold/worker-web
npm install
npm run dev
```

The client talks to the server at `EXPO_PUBLIC_API_URL` (default `http://localhost:8787`). Set it in `unfold/.env.local` when the server is not local.

## Tests

- Client: `cd unfold && npm test` (tsx --test) — 28 unit tests covering de-identification (English + Chinese names, addresses, phones), classification, prompt rules, transcript handling and the server API client.
- Server: `cd unfold/server && npm test` (node --test) — 89 tests covering auth, consent, entry sync, cloud-data purge, case withdrawal, GenAI fallbacks, the worker queue, case transitions and the sweeper.

## Transcription key

Voice notes are transcribed with [ElevenLabs Scribe v2](https://elevenlabs.io/docs/api-reference/speech-to-text/convert). Put your API key in `unfold/.env.local` (gitignored) before starting the dev server:

```bash
EXPO_PUBLIC_ELEVENLABS_API_KEY=sk_...
```

> **Known issue: the API key is exposed in the app.** Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript bundle. Anyone with a copy of the app or the web build can extract the key and spend the account's ElevenLabs credits. This is fine for local development and demos, but not for a public release. Before shipping, move the speech-to-text call behind a small backend that holds the key, and have the app send recordings there. Until then, use a key restricted to speech-to-text with a low usage limit, and rotate it if a build is shared.

`npm start` opens the Expo dev server for Android, iOS, or web. Recordings are sent to ElevenLabs only to be transcribed; voice notes and transcripts are saved on the device. A short summary is prepared only if you ask, and it is shared only after you approve it.
