# server-N lane：修復 run-002 v3 新問題 N1 / N2 / N4

基線：git `fa78812`。只改動 `unfold/server/` 內檔案；未讀 `.env*`；未 commit、未 stage。

## 修改檔案（行號級摘要）

| 檔案 | 行號 | 變更 |
|---|---|---|
| `src/purge.js` | 1–40 | **N1b** `purgeDeviceCloudData` 擴展：同一交易內先刪 `messages`（`case_id IN (SELECT id FROM cases WHERE device_id=?)`，L30）再刪 `cases`（L32），加上原有 links/summaries/analyses/entries。回傳值由 `n` 改為 `{ deleted, casesDeleted }`（`deleted` 維持 entries 計數語義，`casesDeleted` 為 additive） |
| `src/routes-student.js` | 311–321 | **N1b** `DELETE /api/entries` 直接回傳 purge 結果 → `200 { deleted, casesDeleted }`；註解更新（cases+messages 納入 purge） |
| `src/routes-student.js` | 323–355 | **N2** `DELETE /api/entries/:clientId` 交易內新增 `DELETE FROM analyses WHERE device_id = ?`（L344）；註解說明不觸發 GenAI、下次 sync 重算、客戶端回退預設 analysis |
| `src/routes-student.js` | 509–527 | **N1a** `POST /api/cases/:id/withdraw` 改為交易：`UPDATE cases SET status='withdrawn', excerpts='[]', updated_at=?`（L521）＋ `DELETE FROM messages WHERE case_id=?`；個案列保留（period/main_concerns/時間戳等元資料不動），200 回應 `{ id, status:'withdrawn' }` 不變 |
| `src/routes-worker.js` | 22–23, 235, 257 | **N4** 新增 `MAX_WORKER_MESSAGE_CHARS = 1000`；`POST …/respond` 寫入改為 `text.trim().slice(0, MAX_WORKER_MESSAGE_CHARS)`（worker 訊息唯一寫入點，已全 codebase grep 確認） |
| `src/routes/devices.js` | 59–63, 73–77 | **N1b** consent purge 註解更新；`{cloudOrg:false,purgeCloud:true}` 回應改為 spread purge 結果（`deleted`＋`casesDeleted`），無 purge 時兩欄位皆不出現（舊行為相容） |
| `CONTRACT.md` | consent 段、worker respond 段、`DELETE /api/entries`/`DELETE /api/entries/:clientId` 段、withdraw 段、「Cloud-data deletion lifecycle」整段、「Planned」段 | 撤回＝同交易清 excerpts＋刪 messages（列保留）；purge 三入口含 cases＋messages；單筆刪除連帶清 analyses（無 GenAI 呼叫）；respond ≤1000 字；移除「pending 產品決策」註記改為已定行為 |
| `VERIFY.md` | 流程表第 21 列 | 沿用既有「⚠ superseded」風格加註 N1 行為更新（撤回清內容、purge 含 cases、回應含 `casesDeleted`） |

## 測試

既有 89 → **91**（新增 2、更新 3）：

- **更新** `src/consent.test.js:113` — consent purge 現連 cases＋messages 一併清；驗證 `deleted:1`（entries 語義不變）、`casesDeleted:1`、5 表皆空、被清 case 的 messages 為 0
- **更新** `src/routes-student.test.js:371` — `DELETE /api/entries` 全刪現含 cases/messages（`casesDeleted:1`、cases 表空、messages 空、`cases/active` → null）；auth 401 不變
- **更新** `src/routes-student.test.js:424` — 單筆刪除：sync 產生的 analyses 行被清、`GET /api/analysis` 回預設空 shape（證明無 GenAI 呼叫、無過期 evidence）；並釘住邊界：單筆路徑不動 cases
- **新增** `src/routes-student.test.js:532` — 撤回後 DB 層核對：case 列仍在（status=withdrawn、period/main_concerns 保留）但 `excerpts='[]'`、messages=0；200 回應如常；worker（已接案者）GET detail/messages 仍 404
- **新增** `src/routes-worker.test.js:357` — respond 1200 字 → 回應與 DB 皆截為 1000；學生 500 上限由既有測試（`routes-student.test.js:674`）覆蓋不變

## `npm test` 結果

```
ℹ tests 91   suites 10   pass 91   fail 0
```

## 取捨點

1. **撤回只清 `excerpts`＋`messages`，保留 `main_concerns`/`recent_change`**：任務明確列舉的刪除範圍即 excerpts＋messages，並言明「期間/時間戳等元資料可留」；worker 端 withdrawn→404 使這些欄位對 worker 亦不可讀。若產品要連 case summary 欄位一起清空，是一行 UPDATE 的事，但屬未批准的範圍擴張，未做。
2. **purge 回傳值改為物件**：`purgeDeviceCloudData` 兩個呼叫端都在 server 內且一併更新；對外 API 純 additive（`deleted` 語義不變、新增 `casesDeleted`），客戶端不破壞。
3. **單筆刪除連帶清 analyses 而非重算**：符合 N2 指定行為——DELETE 不觸發 GenAI；下次 sync 的 `refreshDerived` 會 upsert 新 analysis。
4. 單筆刪除路徑刻意**不**動 cases（entry-scoped vs device-scoped 邊界），已用測試釘住。

## 殘留風險

- 客戶端（Expo `src/api.ts` 等）若對 purge 回應做嚴格 schema 校验會看到新欄位 `casesDeleted`——additive 設計下應無礙，但客戶端 lane 可自行核對。
- 撤回後 DB 仍留 case 元資料列（設計如此）；若未來要求物理刪除，需另開決策。
- 既有 dev DB（`unfold/server/unfold.db`）不含被撤回案的歷史 messages 清理邏輯——本次只改行為，不補資料遷移（測試皆用 in-memory DB；存量資料本來就受 404 保護不可讀）。
