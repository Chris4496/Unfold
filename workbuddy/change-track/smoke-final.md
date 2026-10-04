# Smoke Lane — 三端整合煙霧測試最終報告

- **日期**：2026-10-04（系統時鐘）
- **範圍**：純 API 跨 lane 整合驗證（device / student API、worker API、entries-consent-analysis 生命週期），全合成英文資料
- **環境**：`node src/index.js`，PORT=8787，DB_PATH=/tmp/smoke-run.db，JWT_SECRET=smoke-secret，MOONSHOT_API_KEY=（空）→ **GenAI fallback 模式**（`/api/health` 回 `genai.configured=false`，server log 確認 `deterministic local fallbacks will be used`）
- **種子**：demo.worker@unfold.local（verified）/ new.worker@unfold.local（unverified），密碼 demo1234
- **未做的事**：未讀 .env*、未改任何程式碼、未碰 unfold.db、未 commit

## 總覽

| # | 測試項 | 結果 |
|---|--------|------|
| 1 | H6 端到端（withdraw 後三連驗） | ✅ 通過 |
| 2 | 刪除生命週期（單刪→purge→全刪） | ✅ 通過 |
| 3 | eventAt 更新（D1 server 側）+ fallback 分析 days≥2 | ✅ 通過 |
| 4 | worker_name（學生視角） | ✅ 通過 |
| 5 | 學生訊息 500 字上限 | ✅ 通過 |
| 6 | max_active 1–20 邊界 | ✅ 通過 |

**6/6 通過，無失敗項。**

---

## 1. H6 端到端 — ✅ 通過

流程與實際 status code（device installId `smoke-h6-device-0001`，caseId `19b1efc9-…`）：

| 步驟 | 請求 | 實際 |
|------|------|------|
| 裝置註冊 | POST /api/devices/register | **201** `{deviceId:"dev_4acb…", cloudOrg:false, token:"afd8…"}` |
| consent | PUT /api/devices/me/consent `{cloudOrg:true}` | **200** `cloudOrg:true` |
| sync 3 條英文記錄 | POST /api/entries/sync | **200** 3 筆 results，topics 分類正確（academic / academic+sleep / academic+group），`genai:false` |
| 建案 | POST /api/cases | **201** `{id:"19b1efc9-…"}` |
| demo.worker 登入 | POST /api/workers/login | **200** `{token, worker.verified:true}` |
| claim | POST /api/worker/cases/:id/claim | **201** `status:"claimed", claim_count:1` |
| 裝置 withdraw | POST /api/cases/:id/withdraw | **200** `{status:"withdrawn"}` |
| ① worker GET /api/worker/cases/:id | → | **404 `{"error":"case_not_found"}`** ✅ |
| ② worker GET /api/worker/cases/:id/messages | → | **404 `{"error":"case_not_found"}`** ✅ |
| ③ worker POST /api/worker/cases/:id/respond | → | **409 `{"error":"invalid_status"}`** ✅ |

三項 H6 預期全部精確命中：withdrawn case 對 worker（含原 claim 者）完全不可見；respond 因狀態機守衛回 409 而非 404/400，與契約一致。

## 2. 刪除生命週期 — ✅ 通過

device `smoke-del-device-0002`：

| 步驟 | 實際 |
|------|------|
| sync 3 條（del-e1..e3） | 200 |
| DELETE /api/entries/del-e2 | **200 `{"deleted":1}`**；GET /api/entries → **剩 2 筆**（del-e1, del-e3），links=0 ✅ |
| PUT consent `{cloudOrg:false, purgeCloud:true}` | **200 `{cloudOrg:false, deleted:2}`**（≥2 ✅）；GET /api/entries → **0 筆** ✅ |
| 撤 consent 後 sync | **403 `{"error":"cloud_org_not_enabled"}`**（邊界守衛正確） |
| 重新 consent `{cloudOrg:true}` → sync 2 條（del-f1..f2） | 200 / 200 |
| DELETE /api/entries（全刪） | **200 `{"deleted":2}`**；GET /api/entries → **0 筆，links=0** ✅ |
| 全刪後 GET /api/analysis | `{approaching:false, explanation:null, evidence:[], updatedAt:null}`（分析連動清除 ✅） |

## 3. eventAt 更新（D1 server 側）— ✅ 通過

device `smoke-d1-device-0003`，三筆 entry **createdAt 全部同為 2026-10-04**（這是關鍵對照）：

1. sync `d1-e1` 不帶 eventAt（createdAt=2026-10-04T01:46:29Z）→ 200；GET 顯示 `eventAt = createdAt`（預設回填正確）。
2. 同 clientId 再 sync，帶 `eventAt=2026-10-01T01:46:29Z`（3 天前）→ 200。GET /api/entries：
   - **eventAt 已更新**：`2026-10-04T01:46:29.000Z → 2026-10-01T01:46:29.000Z` ✅
   - **createdAt 不變**：`2026-10-04T01:46:29.000Z`（前後一致）✅
3. 補 sync 2 條：`d1-e2`（eventAt=2026-10-03，sleep 主題）、`d1-e3`（eventAt=2026-10-04，group 主題）→ 200。
4. GET /api/analysis → **200**：
   ```json
   {"approaching": true,
    "explanation": "Across 3 days the notes repeatedly mention academic pressure, group collaboration and sleep, which suggests the difficulties have persisted rather than appeared once. This is an automatic keyword pattern check on the notes, not a clinical judgement.",
    "evidence": ["6525f379-…","38001c6a-…","1cecf8dc-…"],
    "genai": false,
    "updatedAt": "2026-10-04T01:46:29.256Z"}
   ```

**D1 分析實際行為**：fallback（genai=false）判定 `approaching:true`，explanation 明確寫 **"Across 3 days"**。由於三筆 entry 的 createdAt 全在同一天（2026-10-04），若天數推導仍走 createdAt，days 只會 =1、`approaching` 必為 false——實測為 true 且說出 3 天，**證明分析天數確實由 event_at 推導（toGenaiEntry 用 `event_at || created_at`），且 sync 的 eventAt 更新已正確持久化並觸發分析重算**。fallback 條件 `entries≥3 && days≥2 && hardTopics≥2` 現可被真實跨天資料滿足；evidence 列出 3 個 entry id（≥1，非空）。符合且優於預期（不只是 evidence 間接顯示，而是 approaching 直接為 true）。

## 4. worker_name — ✅ 通過

device `smoke-name-device-0004` → 建案（`49edbba9-…`）→ demo.worker claim（201）→ respond（201，回應中 `worker_name:"Demo Worker"`）：

- 裝置 GET /api/cases/active → 200 `{status:"replied", claimed:true, messages:1}`
- 裝置 GET /api/cases/:id/messages → **200**：
  ```json
  {"messages":[{"sender":"worker","text":"Hello, I am Demo Worker. …","workerName":"Demo Worker", …}]}
  ```
  學生視角訊息附 **`workerName="Demo Worker"`** ✅（camelCase 鍵；worker 端為 snake_case `worker_name`，兩側命名契約各自一致）。
- 交叉確認 worker 端 GET /api/worker/cases/:id/messages → `worker_name:"Demo Worker"` ✅

## 5. 學生訊息 500 字上限 — ✅ 通過

承測試 4 的 case：POST /api/cases/:id/continue → **200 `{status:"continued"}`**（replied→continued 轉態正確）。

- 送 600 字（'x'×600）POST /api/cases/:id/messages → **201**，回應 `message.text` **長度恰為 500**（截斷，非拒收）✅
- GET messages 覆核：`[{sender:"worker", len:129, workerName:"Demo Worker"}, {sender:"student", len:500, workerName:null}]` —— 學生訊息存儲即 500 字，workerName 欄位不受影響。

## 6. max_active 1–20 — ✅ 通過

demo.worker JWT，PATCH /api/workers/me：

| payload | 實際 |
|---------|------|
| `{max_active:21}` | **400** `{"error":"max_active must be an integer between 1 and 20"}` ✅ |
| `{max_active:20}` | **200** `worker.max_active:20` ✅ |
| （加測）`{max_active:0}` | 400（下界守衛正確） |
| （加測）`{max_active:1}` | 200，之後還原為 5 |

---

## 清理確認

| 項 | 狀態 |
|----|------|
| server 進程 | 已 kill（`node src/index.js` pid 49181，先 kill 到 nohup 包裝 pid 49178 後發現 listener 仍在，已補 kill 並確認停止） |
| 8787 監聽 | `lsof -i :8787` 無結果，**已釋放** |
| /tmp/smoke-run.db* | **已刪除**（含 -wal/-shm） |
| unfold.db | mtime **未變**：`1791075209 Oct 4 08:53:29 2026`（測前後一致） |
| 程式碼改動 | `git status --porcelain` 測前後逐行 diff **完全一致**（61 行既有 dirty state 均為四條 lane 的既有工作）；HEAD 仍 `14e214d`，**無 commit** |
| server log | 僅 2 行啟動訊息，運行期間**無 error/exception** |

## 殘留風險 / 備註

- 本輪為 GenAI fallback 模式驗證；真實 Moonshot 路徑（genai=true）未覆蓋，屬預期範圍外。
- 測試 6 過程中 demo.worker 的 max_active 曾被改為 20/1，已還原 5；且測試 DB 已刪除，無任何殘留影響。
- sync 回應中 fallback 分類附 `uncertainty:["topics inferred from keywords only"]`，屬設計內披露行為。
