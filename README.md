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
- All GenAI calls (Gemini `gemini-3.8-flash`) made server-side; empty key falls back to deterministic rules
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
- `unfold/server/` — the backend: Express 4 + better-sqlite3 (ESM, Node ≥ 20). It holds worker accounts and case routing, and makes every GenAI call server-side against Gemini `gemini-3.8-flash` (`GEMINI_API_KEY` from the server environment only — never bundled into the client). An empty key falls back to deterministic rules. The full API contract is in `unfold/server/CONTRACT.md`.
- `unfold/worker-web/` — the social-worker console: Vite + React. Workers register (unverified), log in, and — once verified — claim cases from a language/expertise-matched queue, read de-identified summaries and reply.
- `workbuddy/` — the evaluation tooling: the software-journey-evaluator skill plus `test-runs/` evidence from past evaluation runs (not part of the product).

## Run locally

Requires **Node.js 20 or newer**. To start the API server, worker console and student app together, run this from the repository root:

```bash
./start-all.sh
```

The script creates local env files if needed, seeds demo accounts, and starts all three services. Press Ctrl-C to stop them. Its default ports (8787, 5173 and 8081) must be free. For manual setup, use the steps below.

### 1. Start the server

```bash
cd unfold/server
npm install
cp .env.example .env
npm run seed   # creates demo worker accounts; safe to re-run
npm run dev    # http://localhost:8787
```

The server loads settings from `unfold/server/.env` (see `.env.example`):

- `PORT` defaults to `8787`; `DB_PATH` defaults to `./unfold.db`.
- `JWT_SECRET` must be replaced with a strong, private value outside local development; do not use the example value in production.
- `GEMINI_API_KEY` is optional. If unset, GenAI features use deterministic fallbacks. Keep this key in the server `.env` only—never put it in the Expo app or worker console.

For local testing, the seeded verified account is `demo.worker@unfold.local` / `demo1234`; the unverified account is `new.worker@unfold.local` / `demo1234`.

### 2. Start the social-worker console

```bash
cd unfold/worker-web
npm install
npm run dev    # http://localhost:5173
```

The console proxies API requests to the server at `http://localhost:8787`.

### 3. Start the student app

```bash
cd unfold
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:8787
EXPO_PUBLIC_ELEVENLABS_API_KEY=your_key_here
```

The API URL defaults to `http://localhost:8787`. When using Expo Go on a physical phone, set it to your computer's LAN address instead (for example, `http://192.168.1.10:8787`). The ElevenLabs key is needed for voice transcription; get one from [ElevenLabs](https://elevenlabs.io/) for Scribe v2. Restart Expo after changing environment variables.

Choose how to run the app:

```bash
npm start       # Expo development menu; choose a platform
npm run web     # run in a browser
npm run ios     # launch iOS simulator
npm run android # launch Android emulator
```

Recordings are sent to ElevenLabs for transcription; audio and transcripts remain on-device. The ElevenLabs key is bundled into the development app, so use a restricted key with a low usage limit. Do not ship a public build with this setup; production transcription should go through a backend that keeps the key private.

## Tests

- Client: `cd unfold && npm test` — 29 tests covering de-identification, classification, prompt rules, transcription and the API client.
- Server: `cd unfold/server && npm test` — 89 tests covering auth, consent, entry sync, cloud-data purge, case withdrawal, GenAI fallbacks, the worker queue and case transitions.
