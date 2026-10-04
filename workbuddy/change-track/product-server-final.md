# product-server lane — 最終報告（run 後端修復）

日期：2026-（本 run）。範圍：僅 `/Users/luo/MmM/unfold/unfold/server/`（src/、test 檔、CONTRACT.md、VERIFY.md）。未讀 .env*、未 commit、未動其他目錄（唯讀過 worker-web / 客戶端 src 以對齊規格）。

## 測試結果

- **修改前基線：77 tests / 77 pass**；**修改後：89 tests / 89 pass / 0 fail**（`npm test`，node --test）。
- 新增 12 個測試（見下），既有 77 個全部保持通過。
- 另以真實 dev DB（`unfold.db`，舊 schema）驗證受防護遷移：`sender_worker_id` 成功補上。

## 修改檔案清單（行號級摘要）

### 1. `src/db.js`
- messages DDL（約 L57–64）：新增 `sender_worker_id TEXT REFERENCES workers(id)`（nullable）。
- 新增匯出 `migrateDb(db)`：以 `PRAGMA table_info(messages)` 防護，缺欄位才 `ALTER TABLE ... ADD COLUMN`；`createDb` 在 `db.exec(SCHEMA)` 後呼叫。新 DB 為 no-op，舊 DB 原地遷移。

### 2. `src/purge.js`（新檔）
- `purgeDeviceCloudData(db, deviceId)`：單一交易內刪除該裝置 entries + links + summaries + analyses，回傳刪除筆數。**明示不動 cases/messages**。

### 3. `src/routes-worker.js`
- `MESSAGES_SELECT`：`messages m LEFT JOIN workers w ON w.id = m.sender_worker_id`，附 `w.name AS worker_name`。
- `publicMessage`：回應加 `worker_name`（null for student / 遷移前訊息）。
- `GET /cases/:id`（H6）：`!row || row.status === 'withdrawn'` → **404 `case_not_found`**（先於 ownership 檢查，本人亦然）。
- `GET /cases/:id/messages`（H6）：同上 404；改用 join 查詢。
- `POST /cases/:id/respond`：INSERT 加 `sender_worker_id = req.worker.id`；回應 message 帶 `worker_name`。withdrawn 個案（claimed_by 仍為本人）→ 既有邏輯已回 **409 `invalid_status`**，本次補測試核實。

### 4. `src/routes-student.js`
- 新增 `MAX_MESSAGE_CHARS = 500`，學生訊息由 slice(0,1000) 改 **slice(0,500)**（對齊客戶端 store.tsx:385）。
- `messagesForCase` 改 join workers；學生端 `GET /api/cases/:id/messages` 每則加 **`workerName`**（camelCase，對齊該 API 命名慣例）。
- `POST /entries/sync`（eventAt 更新）：payload 帶 `eventAt` → 更新既有記錄 `event_at`；省略時**保留**既有 `event_at`（新記錄預設 createdAt；修掉舊碼會把 event_at 重設回 createdAt 的隱性 clobber）；`event_at` 跨日搬動時，**舊日與新日**的日摘要快取都失效，links/analysis 經既有 `refreshDerived` 重算。
- 新增 `DELETE /api/entries`：全裝置範圍，200 `{deleted:n}`，連帶清 links/日摘要/分析，**不動 cases**；需裝置 auth。
- 新增 `DELETE /api/entries/:clientId`：200 `{deleted:1}` 或 404 `entry_not_found`；連帶刪參照該 entry 的 links 與該日摘要快取（分析列留待下次 sync 重算，已於 CONTRACT 註明）。

### 5. `src/routes/devices.js`
- `PUT /me/consent` 接受 `purgeCloud?: boolean`（非 boolean → 400）。`{cloudOrg:false, purgeCloud:true}` → 關閉同意 + 呼叫 `purgeDeviceCloudData`，回應加 `deleted: n`；`cloudOrg:true + purgeCloud:true` 屬矛盾，忽略 purge（不回 deleted）。

### 6. `src/routes/workers.js`
- 新增常數 `MAX_ACTIVE_MIN/MAX/DEFAULT = 1/20/5` 與 `isValidMaxActive`。
- register：接受可選 `max_active`（1–20，預設 5；worker-web 註冊流程本就緊接 PATCH，此為對齊規格「register/PATCH」字面要求）。
- PATCH：`max_active` 範圍由 1–100 改 **1–20**（對齊表單 min=1/max=20）。

### 7. `CONTRACT.md`
- messages schema 加 `sender_worker_id` + 遷移說明；workers register/PATCH max_active 1–20；consent purgeCloud；worker GET detail/messages 的 withdrawn 404 與 respond 409；messages 附 worker_name；sync eventAt 更新與雙日快取失效；學生訊息 ≤500、workerName；新增 **「Cloud-data deletion lifecycle」** 章節，明訂**已分享個案（cases.excerpts/messages）不在刪除範圍、其生命週期另行決策（pending）**。

### 8. `VERIFY.md`
- 步驟 21（撤回後 worker 仍可讀）加註：⚠ 已被 H6 修復取代（現為 404 case_not_found / messages 同 / respond 409）。

## 新增/修改測試（+12：77 → 89）

| 檔案 | 測試 |
|---|---|
| routes-worker.test.js (+2) | withdrawn→detail/messages 404、respond 409；respond 寫 sender_worker_id、messages 帶 worker_name（student 則 null） |
| routes-student.test.js (+4) | eventAt 更新＋舊/新日快取失效＋省略 eventAt 不覆蓋；DELETE /entries 全刪（衍生清空、cases 保留、401）；DELETE /entries/:clientId（404、links/日摘要連帶清）；學生訊息截 500＋workerName |
| consent.test.js (+2) | `{cloudOrg:false,purgeCloud:true}` 全刪（cases 保留、回 deleted）；purgeCloud 僅配 cloudOrg:false 生效、非 boolean 400 |
| routes-workers.test.js (+2，新檔) | register max_active 1–20/預設 5/越界 400/重複 409；PATCH 邊界 1、20 通過，0/21/100 拒絕 |
| db.test.js (+2，新檔) | 舊 messages 表遷移補欄位＋舊列 NULL＋冪等；新 DB 自建欄位 |

## 殘留風險

1. **單筆刪除後 analysis 列暫時過期**（evidence 可能指到已刪 entry 的內部 id；僅 id、無引文，下次 sync 重算即修復）。已在 CONTRACT 註明，屬刻意取捨以避免 DELETE 觸發 GenAI 呼叫。
2. `DELETE /api/entries` 全刪後 `GET /api/analysis` 回預設空形——語義正確但客戶端需能處理。
3. 既有 dev DB 已被本次驗證遷移（加了欄位），屬預期行為。
4. worker_name 對學生端暴露社工顯示名——additive 欄位；若日後政策改為匿名化，移除學生端 workerName 即可（worker 端不受影響）。

## 規格含糊處的自行取捨

1. **「GET messages 回應加 worker_name」未指明哪一端**：worker 端按字面（snake_case `worker_name`）；學生端亦補 `workerName`（camelCase 對齊其 API，且呼應 run-001「訊息不區分社工身份」缺陷）。純附加、不破壞既有消費者。
2. **`{cloudOrg:true, purgeCloud:true}` 矛盾輸入**：忽略 purge（僅 `cloudOrg:false && purgeCloud:true` 觸發），不回 400——避免影響既有同意切換流程；已在 CONTRACT 寫明。
3. **register 的 max_active**：現行 register 本不接受該欄位（worker-web 是註冊後 PATCH）；依規格字面「register/PATCH」兩端都加 1–20 校驗（register 預設 5，向後相容）。
4. **respond 對 withdrawn**：規格說「應已 409」——核實成立（withdraw 不清 claimed_by，本人 respond 落 409 invalid_status），未改碼、補測試鎖定行為。
5. **DELETE /entries/:clientId 的衍生清理範圍**：規格只對全刪指明「連帶清衍生資料」；單筆採輕量清理（entry＋參照 links＋當日摘要快取），analysis 留待下次 sync。
