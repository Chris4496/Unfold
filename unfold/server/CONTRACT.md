# Unfold Server Contract

Backend for the Unfold multi-party support system: Express 4 + better-sqlite3 (ESM, Node >= 20).
All GenAI calls are made **server-side only** against `https://api.moonshot.ai/v1` (model
`kimi-k3` by default) using `MOONSHOT_API_KEY` from the server environment. The key is never
bundled into the Expo client or worker-web. Every GenAI feature has a deterministic local
fallback and marks its output with `genai = 0` when the fallback was used.

**Data boundary:** only *deidentified* text may leave the device, and only when the student
has explicitly enabled the **independent cloud-organisation consent** (`cloud_org = 1`).
Original transcripts/audio never sync.

## Auth header formats

| Principal | Header |
|---|---|
| Worker | `Authorization: Bearer <JWT>` (from `POST /api/workers/login`, 7d expiry) |
| Device | `Authorization: Bearer <device token>` (opaque hex token from `POST /api/devices/register`) |

## Configuration (env, see `.env.example`)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `DB_PATH` | `./unfold.db` | SQLite file |
| `JWT_SECRET` | dev value | Worker JWT signing secret (change in production) |
| `MOONSHOT_API_KEY` | _empty_ | Server-side Moonshot key; empty ⇒ deterministic fallbacks |
| `MOONSHOT_BASE_URL` | `https://api.moonshot.ai/v1` | OpenAI-compatible base URL |
| `GENAI_MODEL` | `kimi-k3` | Model for all GenAI features |
| `UNCLAIMED_TIMEOUT_HOURS` | `72` | Queued/rematch unclaimed threshold for the "waiting" flag |
| `RESPONSE_TIMEOUT_HOURS` | `48` | Claimed-without-response threshold for auto-rematch |

## Schema (SQLite)

- **workers** — `id TEXT pk`, `email TEXT unique`, `password_hash` (bcrypt), `name`,
  `organisation`, `expertise TEXT` (JSON array of
  `'academic' | 'family' | 'sleep' | 'group' | 'friends' | 'general'`),
  `languages TEXT` (JSON array, e.g. `["zh-HK","en"]`), `max_active INTEGER default 5`,
  `verified INTEGER default 0`, `created_at`.
- **devices** — `id pk`, `token unique`, `cloud_org INTEGER default 0` (independent
  cloud-organisation consent), `created_at`.
- **entries** — `id pk`, `device_id`, `client_id`, `created_at`, `event_at`,
  `deidentified` (deidentified text only), `tokens`/`topics`/`attributes`/`uncertainty` (JSON),
  `genai INTEGER default 0`, `synced_at`, `UNIQUE(device_id, client_id)`.
- **links** — `id pk`, `device_id`, `from_entry_id`, `to_entry_id`, `relation`, `note`, `created_at`.
- **summaries** — `device_id`, `day`, `text`, `entry_ids` (JSON), `genai INTEGER`,
  `PRIMARY KEY(device_id, day)`.
- **analyses** — `device_id PRIMARY KEY`, `updated_at`, `approaching INTEGER`, `explanation`,
  `evidence` (JSON), `genai INTEGER`.
- **cases** — `id pk`, `device_id`, `main_concerns`, `recent_change`, `period`,
  `excerpts` (JSON, deidentified only), `topics` (JSON), `language`,
  `status TEXT CHECK IN ('queued','claimed','replied','continued','rematch','withdrawn')`,
  `claim_count INTEGER default 0`, `claimed_by`, `created_at`, `claimed_at`, `responded_at`, `updated_at`.
- **messages** — `id pk`, `case_id`, `sender TEXT CHECK IN ('worker','student')`, `text`, `created_at`.

All timestamps are ISO-8601 UTC strings. `genai` columns: `1` = produced by the GenAI model,
`0` = deterministic local fallback (UIs must disclose "not GenAI").

## Case status enum & timeout rules

Statuses: `queued | claimed | replied | continued | rematch | withdrawn`.

- **Unclaimed timeout:** a case in `queued` or `rematch` that has been unclaimed for more
  than `UNCLAIMED_TIMEOUT_HOURS` keeps its status; `isWaiting()` computes a read-time
  "still waiting" flag so the student UI can disclose the delay.
- **No-response timeout:** a case in `claimed` whose worker has not responded
  (`responded_at IS NULL`) within `RESPONSE_TIMEOUT_HOURS` of `claimed_at` is auto-returned
  to the queue by the sweeper (`runSweeper`, runs every 60 s): status becomes `rematch`,
  `claimed_by`/`claimed_at` are cleared to `NULL`, and `claim_count` is incremented.

## Routes implemented in this step

### Health
- `GET /api/health` → `{ ok, genai: { configured, model, baseUrl }, timeouts: { unclaimedHours, responseHours } }`.

### Workers
- `POST /api/workers/register` — body `{ email, password (>=8 chars), name, organisation? }`.
  Creates an **unverified** worker (`verified = 0`). `409 email_already_registered` on duplicate.
  → `201 { worker }`.
- `POST /api/workers/login` — body `{ email, password }` → `{ token, worker }`.
  `401 invalid_credentials`.
- `GET /api/workers/me` (worker JWT) → `{ worker }`.
- `PATCH /api/workers/me` (worker JWT) — body may include `expertise` (array of the enum
  above), `languages` (string array), `max_active` (int 1–100) → `{ worker }`.

Worker object: `{ id, email, name, organisation, expertise[], languages[], max_active, verified, created_at }`
(never includes `password_hash`).

Middleware for later steps: `requireWorker` (valid JWT), `requireVerifiedWorker`
(JWT + `verified = 1`, else `403 { "error": "not_verified" }`), `requireDevice` (valid device token).

### Devices
- `POST /api/devices/register` — body `{ installId (>= 8 chars) }`. **Idempotent**: the same
  installId always returns the same `{ deviceId, token, cloudOrg, created_at }`.
  `201` on first registration, `200` on repeat.
- `PUT /api/devices/me/consent` (device token) — body `{ cloudOrg: boolean }`. The independent
  cloud-organisation authorisation; toggling it never affects anything else. → `{ deviceId, cloudOrg, created_at }`.
- `GET /api/devices/me` (device token) → `{ deviceId, cloudOrg, created_at }`.

## Seed

`npm run seed` inserts (idempotently):
- `demo.worker@unfold.local` / `demo1234` — **verified**, expertise `["general"]`, languages `["zh-HK","en"]`.
- `new.worker@unfold.local` / `demo1234` — **unverified**.

## Worker case routes (mounted at /api/worker, `src/routes-worker.js`)

All routes below require a **verified** worker (`requireVerifiedWorker`); unverified workers
get `403 { "error": "not_verified" }` on every route except `GET /api/worker/me`. Case payloads
**never include `device_id`**. Active-case capacity counts cases in
`claimed | replied | continued` against `workers.max_active`.

- `GET /api/worker/me` (worker JWT only, no verification needed) → `{ worker }`.
- `GET /api/worker/queue` → `{ cases, atCapacity, activeCount, maxActive }`. Open cases
  (`queued | rematch`) where `case.language IN worker.languages` AND
  (`worker.expertise` contains `'general'` OR intersects `case.topics`) AND the worker is below
  capacity. Ordered `created_at ASC`. Each case includes `waitingHours` (hours since
  `created_at`, 2-decimal) and `claim_count`. Empty list + `atCapacity: true` when at capacity.
- `POST /api/worker/cases/:id/claim` — atomic conditional
  `UPDATE ... WHERE status IN ('queued','rematch')`; sets `claimed_by`, `claimed_at`,
  `status = 'claimed'`, `claim_count++`. → `201 { case }`.
  Errors: `404 case_not_found`, `409 already_claimed` (incl. lost claim race), `409 capacity_reached`.
- `GET /api/worker/cases` → `{ cases }`: my active cases (`claimed_by = me`) with
  `lastMessage` snippet (`{ sender, text (≤140 chars + …), created_at }` or `null`).
- `GET /api/worker/cases/:id` → `{ case }` full detail (`main_concerns`, `recent_change`,
  `period`, `excerpts[]`, `topics[]`, `language`, timestamps) only if `claimed_by = me`,
  else `403 not_your_case` / `404 case_not_found`.
- `POST /api/worker/cases/:id/respond` — body `{ text }`, only if `claimed_by = me` and
  `status IN ('claimed','continued')`. Inserts a `worker` message, sets `status = 'replied'`,
  `responded_at`. → `201 { message, case }`. Errors: `400` missing text, `403 not_your_case`,
  `404 case_not_found`, `409 invalid_status`.
- `GET /api/worker/cases/:id/messages` → `{ messages }` (ASC) only if `claimed_by = me`.

The sweeper (`startSweeper`, wired in `src/index.js` on boot) enforces the no-response
timeout: a `claimed` case without response older than `RESPONSE_TIMEOUT_HOURS` becomes
`rematch` with `claimed_by`/`claimed_at` cleared, so another worker can claim it from the
queue. Unclaimed `queued`/`rematch` cases stay queued; the student side computes the
read-time `isWaiting` flag.

## Student routes (mounted at /api, `src/routes-student.js`)

All routes below require **device auth** (`Authorization: Bearer <device token>`). Only
deidentified text is ever accepted or returned; original transcripts/audio never sync.
Every GenAI-derived payload carries a `genai` boolean: `false` means the deterministic
local fallback was used and the UI must disclose it is not GenAI. Ownership of every
`:id` resource is enforced against the authenticated device (`404 case_not_found` for
foreign ids).

### Entries & GenAI features
- `POST /api/entries/sync` — body `{ entries: [{ clientId, createdAt, eventAt?, deidentified, tokens[] }] }`
  (max 200 per call). `403 cloud_org_not_enabled` when the device's cloud-organisation
  consent is off. Upserts by `(device_id, clientId)`; unchanged entries are returned as-is.
  New/changed entries are classified server-side (`classifyEntry`), then the device's
  recent 50 entries are re-linked (`linkEntries`), the background support analysis row is
  regenerated (`analyseBackground`), and cached summaries for the affected days are dropped.
  → `{ results: [{ clientId, topics, attributes, uncertainty, genai }] }`.
- `GET /api/entries` → `{ entries, links }`: all synced entries (ASC) plus cross-record
  links (`fromClientId`, `toClientId`, `relation`, `note`, `createdAt`).
- `GET /api/summaries/:day` (`YYYY-MM-DD`) → cached summary or a fresh `dailySummary` call
  over that day's entries, cached on write. → `{ day, text, genai }`. `400` on bad day format.
- `POST /api/ask` — body `{ question }` → NL Q&A over the device's recent entries (`ask`).
  Stores nothing. → `{ found, text, hits: [{ clientId, dateLabel, quote }], genai }`.
- `POST /api/respond` — body `{ deidentified, recentKinds[] }` → one brief, optional
  response (`briefResponse`). → `{ kind: 'acknowledgement'|'encouragement'|'invite-elaboration', text, genai }`.
- `GET /api/analysis` → latest background support analysis:
  `{ approaching, explanation, evidence, genai, updatedAt }`
  (defaults `{ approaching: false, explanation: null, evidence: [], genai: false, updatedAt: null }`
  before the first sync).

### Cases (student side)
- `POST /api/cases` — body `{ mainConcerns, recentChange, period, excerpts[], topics[], language? }`
  (deidentified content only). Creates a case in status `queued`. → `201 { id }`.
- `GET /api/cases/active` → `{ case }` (latest non-withdrawn) or `{ case: null }`.
  Case payload: `{ id, status, createdAt, updatedAt, claimCount, claimed, waitingNoWorker, messages }`
  where `waitingNoWorker` is the read-time `isWaiting` flag (queued/rematch older than
  `UNCLAIMED_TIMEOUT_HOURS`) and `messages` is the message count.
- `POST /api/cases/:id/withdraw` — any non-withdrawn status → `withdrawn`. → `{ id, status }`.
- `POST /api/cases/:id/continue` — `replied` → `continued` (student continues the conversation).
- `POST /api/cases/:id/rematch` — from `claimed|replied|continued|rematch`: returns the case to
  the queue — `status = 'queued'`, `claimed_by`/`claimed_at`/`responded_at` cleared,
  `claim_count++`. → `{ id, status }`.
  All three transitions return `400 invalid_transition` (with current `status`) from other states.
- `GET /api/cases/:id/messages` → `{ messages: [{ id, sender, text, createdAt }] }` (ASC).
- `POST /api/cases/:id/messages` — body `{ text }` (≤1000 chars), sender `student`;
  `400` on empty text or a withdrawn case. → `201 { message }`.

## Planned (later steps, not implemented here)

None on the server: auth/consent, worker queue, GenAI features and student routes are all
implemented. Remaining work is client-side (Expo app + worker-web) against this contract.
