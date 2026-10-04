# product-client lane — final report

Client (Expo) + docs fixes for Unfold. All changes confined to `unfold/app/`, `unfold/src/`, `README.md`, `docs/`. Server/worker-web untouched (their in-tree modifications belong to the server lane). No commits, no staged files.

## Verification

- `npm test` (tsx --test): **28/28 pass** (was 20; +5 deidentify, +3 api).
- `npm run typecheck` (tsc --noEmit): **clean**.
- Server lane contract cross-checked against the landed `server/CONTRACT.md` + routes (read-only): consent `{cloudOrg:false, purgeCloud:true}` ✓, `DELETE /api/entries` ✓, `DELETE /api/entries/:clientId` ✓, sync `eventAt` update semantics ✓, student messages include worker display name ✓.

## Changed files (line-level summary)

### `unfold/src/lib/deidentify.ts` (fix 1 — Chinese de-identification)
- L52–158: new conservative Chinese rule data —
  - `ZH_SURNAMES` (~90 common surnames, traditional+simplified), `ZH_GIVEN` (~120 given-name characters chosen to avoid grammar words — this is the main false-positive guard), `ZH_NAME_STOP` (白天/王子/馬路/高山/方法/溫柔/關心/黃大仙/馬鞍山/白云山 …).
  - `ZH_ADDR_FORBIDDEN` + `ZH_ADDR_CHAR`: place-name characters = CJK minus function words (我/喺/咗/條/呢/座…), so 呢條街 and 我住喺太古城 never match at the wrong span; `ZH_ADDR_STOP` suffix-matched generic road words (知道/味道/馬路/道路/公里/家里 …).
- L187–191: phone — added mainland mobile `(?:\+?86)?1[3-9]\d{9}` and HK landline `[23]\d{3}[\s-]\d{4}` (separator **required** so 8-digit IDs/dates are not redacted).
- L220–232: Chinese addresses — `[place]{1,8}(道|街|路|里|徑|坊|圍|巷)` (+ optional `門牌號`, digits bypass the stop list → [ADDRESS]); `[place]{2,6}(大廈|中心|廣場|花園|邨|苑|城)`.
- L234–249: Chinese names — surname+title (陳老師→[PERSON]); relationship-prefix (同學陳小明, prefix kept); name before speech verb (陳小明話); bare 3-char full name (陳小明). Stop list applied to the two context-free patterns.
- Conservative choices on purpose: bare `12號` untouched (Cantonese date), 阿X names and 2-char names without context not matched, `樓/座` not address suffixes (公司樓下 FP).

### `unfold/src/lib/deidentify.test.ts` (+5 tests)
- Chinese names in common forms (陳小明 bare, 陳老師, 我同學黃家明, 李明問…, mixed EN+ZH); false-positive boundaries (白色/黃色/一張枱/陳年/白天/高山/溫柔/小王子/黃大仙/藍色); Chinese streets & estates (旺角道12號, 太古城, 美孚新邨, 彌敦道+上海街, 黃埔花園); generic road words & bare 聽日12號 kept; mainland mobile / HK landline / 學號23456789 kept / mixed PERSON+PHONE.

### `unfold/src/api.ts`
- L131: `CaseMessage.workerName?: string | null` (student-route spelling per landed CONTRACT.md L211 — note the worker side uses `worker_name`, student side is camelCase).
- L141–150: `setCloudConsent(token, cloudOrg, options?: { purgeCloud?: boolean })` — sends `purgeCloud:true` only when asked.
- L158–166: `deleteCloudEntries` (DELETE /api/entries), `deleteCloudEntry` (DELETE /api/entries/:clientId); `RequestOptions.method` gains `'DELETE'` (L40).

### `unfold/src/api.test.ts` (+3 tests)
- Consent-off sends `{cloudOrg:false, purgeCloud:true}`; DELETE routes called with method+token+path; re-sync payload carries updated `eventAt` with unchanged `createdAt`.

### `unfold/src/types.ts`
- `Entry.synced?: boolean` (set once the cloud organiser acknowledges an entry; scopes per-entry cloud deletes). `Message.workerName?: string`.

### `unfold/src/store.tsx` (fixes 2/D1, 5)
- L162–177 `mergeSyncResults`: shared merge, now also marks `synced:true`.
- L198–212 `backfillCloud`: batches of 200 (server cap), fire-and-forget, per-batch `console.warn` on failure.
- L229–236 `setCloudOrg`: off → `setCloudConsent(token, false, { purgeCloud:true })`; on → backfill existing local notes (deidentified text only).
- L254–261 `setEventTime`: re-syncs that entry (server accepts eventAt updates) (D1).
- L262–272 `deleteEntry`: `DELETE /api/entries/:clientId` only when `entry.synced && cloudOrg && deviceToken`; failure logged, never blocks.
- L284–292 `clearAll`: `DELETE /api/entries` fire-and-forget alongside local wipe.
- L369: `refreshCaseFromServer` maps server `workerName` into local messages.

### `unfold/app/index.tsx` (fix D2)
- L46–52: on mount (keyed by `openCase?.id`) calls `refreshCaseFromServer()` for remote open cases → "A social worker replied" Notice now reachable without opening the case screen.

### `unfold/app/case.tsx` (fix D3 + worker_name)
- L15–35 `WithdrawButton`: two-step inline confirm (Cancel/Withdraw) — web-compatible (no `Alert`, mirrors existing delete-everything pattern); replaces all 3 direct withdraw buttons (L118/123/132).
- L113: worker messages titled "`name` (social worker)" when the server provides `workerName`.

### `unfold/app/settings.tsx` (fix 6 copy)
- Cloud toggle card: one-off backfill on opt-in; "turning it off deletes every cloud copy"; deletes propagate; de-identification coverage (EN+ZH names, schools, addresses/estates, phones, emails) and best-effort limits stated.

### `unfold/app/privacy.tsx` (fix 6 copy)
- STEPS: new "De-identified here…" step (coverage + best-effort limits + read-before-approve) and "Optional cloud organisation" step (what goes up, never transcripts/audio, off ⇒ cloud copies deleted, deletes propagate).

### `README.md` (fix 7)
- Architecture (client/server/worker-web, Moonshot server-side only), run instructions for all three (`npm run seed`, `npm run dev`), `EXPO_PUBLIC_API_URL`, test status (**client 28 / server 77**).

### `docs/Interim_Progress_Report_Questionnaire.md` (fix 7)
- Q5: same-device simulation → real two-sided backend (simulation = offline demo fallback). Q13: rewritten (real server + worker console, Chinese deidentification, cloud lifecycle, 28+77 tests). Q14: GenAI classification & Chinese deidentification landed; key proxy + threshold design remain. Q15: M3.5 mostly complete, M4 numbers. Q19: stack + suite sizes. (Remaining "simulated" mentions in Q10/Q23 are still accurate.)

## Contract ambiguities — decisions taken

1. **`worker_name` spelling**: task brief said `worker_name`, but the landed student-route contract documents **`workerName`** (camelCase; `worker_name` is the worker-side spelling). Client follows the student-route contract.
2. **"僅已同步者" for single delete**: implemented via new `Entry.synced` flag set on successful sync/backfill. Entries synced *before* this change lack the flag → their cloud rows are not deleted per-entry (covered by delete-everything / purge-on-off). Server returns `404 entry_not_found` for unsynced ids, which the client swallows with a log — safe either way.
3. **Withdraw confirm**: inline two-step buttons instead of `Alert.alert` (no-op on RN-web), matching existing delete patterns.
4. **"withdrawn 個案 GET 回 404"** is a worker-route rule; the student client only calls student routes and already owns the withdrawn state locally + polls stop on withdrawn — no client change needed.
5. **Backfill is fire-and-forget** (not awaited by the settings toggle) so a large diary can't block the switch; failures logged via `console.warn` ("靜默降級並記錄").

## Residual risks

- Chinese name recall is bounded by the surname/given-char lists — uncommon names, 阿X forms, and 2-char names without speech-verb/relationship context are **not** redacted (documented in settings/privacy copy as best-effort).
- `purgeCloud` / DELETE routes 404-or-fail silently on old servers; local behaviour is unaffected by design.
- `clearAll` wipes local `installId`/`deviceToken`; the now-empty server device row remains (pre-existing design, entries are deleted).
- Store logic (backfill/delete propagation) has no unit-test harness (store is React-coupled); covered at the API-client level instead.
