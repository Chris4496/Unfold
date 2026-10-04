# product-workerweb lane — 最終回報

日期：2026-10-04 ｜ 範圍：`unfold/worker-web/`（未 commit、未動其他目錄；server lane 的並行修改非本 lane 所為）

## 修改檔案清單（行號級摘要）

### 1. `unfold/worker-web/src/pages/CaseDetail.jsx`（+56/−5）

**修復項 1 — 撤回後個案頁**
- L4、L7：新增 `useAuth`、`EmptyState` import。
- L69–71：新增 `withdrawn` state。
- L92–94（`load()` catch）：`case_not_found`（404，契約：撤回即 404）→ `setWithdrawn(true)`，不再顯示泛用「Case not found.」錯誤。detail 與 messages 兩個 request 任一 404 都會進此分支（Promise.all）。
- L136–149：渲染閘門 `if (withdrawn || (caseData && caseData.status === 'withdrawn'))` → 只渲染 `<EmptyState title="This summary is no longer shared.">` + 返回連結；**不渲染摘錄、訊息、回覆框**。第二個條件是向後相容：API 未上線 404 前，舊 server 仍回 200 且 `status='withdrawn'`（已用舊碼實測確認此行為），同樣整頁隱藏。
- L124–126（`send()` catch）：送出時遇到撤回競態（respond 回 404 `case_not_found`）→ 切到撤回提示頁。

**修復項 2 — 訊息社工身分**
- L45–58：新增 `senderLabel(message, me)`。worker 訊息有 `worker_name` 時：與當前登入 worker `name` 相符 → `You`；不符 → 顯示該社工姓名（修復「前任社工回覆被標 You」）。無 `worker_name`（舊 server / 契約前遺留訊息）→ 回落 `You`（舊執行緒只可能含本人訊息，回落安全）。
- L64：從 `useAuth()` 取當前 worker。
- L111–116：respond 回應的 message 若缺 `worker_name`（舊 server），樂觀補上本人姓名再 append，保證新氣泡標 `You`。
- L259：訊息串改用 `senderLabel(m, worker)` 取代原先 `m.sender === 'worker' ? 'You' : 'Student'`。

### 2. `unfold/worker-web/src/pages/Queue.jsx`（+12/−2）

**修復項 3 — rematch 徽章語義**
- L14–21：新增 `rematchCount(claimCount) = Math.floor((claimCount || 0) / 2)`，註解依據：server 在**每次成功 claim**（routes-worker.js claim UPDATE）與**每次退回**（學生 rematch routes-student.js、sweeper 逾時 sweeper.js）都 `claim_count + 1`，故 queued/rematch 態案件 cc 必為偶數，實際退回次數 = cc/2。
- L112–115：徽章條件由 `c.claim_count > 0` 改為 `rematchCount(c.claim_count) > 0`，顯示 `rematch ×{rematchCount(...)}`。
- ⚠️ **裁決記錄**：任務書原指定 `claim_count − 1`；經源碼核對該公式在多輪退回時失真（cc=4 實際退回 2 次，cc−1 給 3），且 API 無其他語義更準欄位。經 supervisor 裁決採 **選項 A：`floor(claim_count/2)`**，>0 才顯示。

### 未修改但核對的檔案

**修復項 4 — 註冊容量上限核對（無需改動）**
- `src/pages/Register.jsx` L147–155：`<input type="number" min={1} max={20}>`，標籤「Maximum active cases (1–20)」→ 與契約 server 端 1–20 一致。
- `src/pages/Profile.jsx` 的容量欄位同為 min=1/max=20，一併核對無誤。
- 備註：本 repo 現行 server `PATCH /workers/me` 驗證為 1–100（`routes/workers.js:107`），但表單 1–20 是 1–100 的子集，無論 server lane 是否收緊至 1–20 皆相容，故不改。

## npm run build 結果

```
vite v5.4.21 building for production...
✓ 45 modules transformed.
dist/index.html                   0.42 kB
dist/assets/index-D-eBSpAh.css    6.46 kB
dist/assets/index-BfJxb4lu.js   187.65 kB
✓ built in 5.26s
```
通過（最終碼重跑一次確認）。（`dist/` 被 .gitignore，無追蹤變更。）

## 驗證（對真實 server 的端到端煙霧測試，scratch DB 於 /tmp，已清理）

**對契約前 server（git HEAD 版）**
- 學生 withdraw 後，worker `GET /cases/:id` 回 **200 + status='withdrawn'** → 命中向後相容閘門，渲染提示頁 ✓
- `GET /cases` 列表回 `{"cases":[]}`（撤回案件本就不顯示）✓
- messages 無 `worker_name` → 回落 `You`（單社工執行緒正確）✓

**對契約後 server（server lane 並行落地的 `sender_worker_id` + `worker_name` join + withdrawn 404）**
- 雙社工情境：w1「Demo Worker」claim+回覆 → 學生 rematch → w2「Ada Second」claim+回覆。w2 視角的 messages：`worker_name='Demo Worker'`（前任）與 `worker_name='Ada Second'`（本人）→ 前端分別顯示 **「Demo Worker」** 與 **「You」**，身份混淆修復 ✓
- withdraw 後 `GET /cases/:id` 與 `/messages` 均回 **404 `case_not_found`** → 前端進撤回提示頁 ✓；`/cases` 列表空 ✓
- claim→rematch 後 queue payload `claim_count=2` → 徽章 **rematch ×1**；新案 cc=0 → 不顯示 ✓

## 殘留風險

1. **同名社工誤標**：訊息 payload 只有 `worker_name`（無 sender worker id），若兩位社工同名，前任同名社工的訊息會被誤標 `You`。比對 id 需 server 在 message payload 加 `sender_worker_id`（契約外，未提）。
2. **社工改名**：社工送出訊息後改名，歷史訊息的 `worker_name`（join 當下 workers.name）會顯示新名；比對仍以當前名為準，語義可接受。
3. **撤回 vs 從未存在不可區分**：404 `case_not_found` 涵蓋「撤回」與「id 不存在/無權」，UI 一律顯示「This summary is no longer shared.」——此為契約刻意的隱私設計，文案按任務指定，但對著錯 id 的用戶略有誤導。
4. **多輪退回為罕見路徑**：`floor(cc/2)` 在 cc 異常為奇數時（理論上不會出現在隊列）仍給出合理下限值，屬防禦性行為。

## 規格含糊處的取捨

1. **rematch 公式**：任務字面 `claim_count − 1` vs 實際語義 `floor(cc/2)`——升級 supervisor 裁決，採 A（`floor(cc/2)`），已加註解並於上文記錄。
2. **「You」的顯示格式**：取字面規格——本人顯示 `You`（不附姓名），其他社工顯示姓名。
3. **撤回提示文案**：採任務指定的「This summary is no longer shared.」，副文說明學生已撤回、摘錄與訊息不再可用；用現有 `EmptyState` 組件呈現，附「Back to my cases」。
4. **舊 server 200+withdrawn 的處理**：規格要求「同樣隱藏內容並禁用回覆框」——實作為整頁提示（連訊息串也不渲染），比僅禁用回覆框更嚴格，符合「不渲染摘錄與訊息」的主要求。
