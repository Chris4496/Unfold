# UA-SUPP-2 最終訊息回報 — J4「Ask your diary」API 層補測

- **role_id**: UA-SUPP-2 ｜ **task_id**: j4-ask-remediation ｜ **channel**: API（純 curl，全合成資料）
- **補測範圍聲明**: 本補測僅覆蓋 J4 的**伺服器路徑**（POST /api/ask 的請求/回應契約、引用誠實性、genai 旗標）。app UI 的「來源標籤」段落無法由 API 層覆蓋，如實標記為**未執行**。
- **server**: http://localhost:8787（health 200，GenAI fallback 模式，genai=false）
- **裝置**: installId=`supp-device-run001`（重用，token 已遮蔽，未外洩）

## 逐步結果

### Step 1 — 重新註冊取回 device token
- `POST /api/devices/register`（installId=supp-device-run001）→ **HTTP 200**（幂等成立：非首次 201 而是 200，回同一 deviceId=`dev_9487492a94ac911e258040300f0de58f`，cloudOrg=**true**）。
- 證據：`evidence/ua-supp2-01-device-register.json`（token 欄位已遮蔽為 `***REDACTED***`）。

### Step 2 — GET /api/entries 確認記錄在冊
- **HTTP 200**，3 條合成記錄全部在冊，**無需重同步**：
  - `supp-e1`（academic）: "Felt stressed about a heavy coursework deadline this week and stayed up late working on it."
  - `supp-e2`（academic+group）: "Group project meeting felt tense because tasks were not divided fairly."
  - `supp-e3`（sleep）: "Sleep has been short and broken for several nights in a row."
- links 為空陣列。
- 證據：`evidence/ua-supp2-02-entries.json`。

### Step 3 — 有匹配查詢
- 請求：`POST /api/ask`，question = "What has been bothering me about group work?"
- **HTTP 200**，實際回應形狀：
  ```json
  {
    "found": true,
    "text": "On 2026-10-03 the notes say: \"Sleep has been short and broken for several nights in a row.\"\n\nOn 2026-10-03 the notes say: \"Group project meeting felt tense because tasks were not divided fairly.\"",
    "hits": [
      { "clientId": "supp-e3", "dateLabel": "2026-10-03", "quote": "Sleep has been short and broken for several nights in a row." },
      { "clientId": "supp-e2", "dateLabel": "2026-10-03", "quote": "Group project meeting felt tense because tasks were not divided fairly." }
    ],
    "genai": false
  }
  ```
- 回應形狀符合契約 `{ found, text, hits:[{clientId, dateLabel, quote}], genai }`；text 以日期標籤編織逐字引用。
- **觀察到的相關性雜訊**：fallback 以關鍵詞計分，問題中的 "been"（非停用詞）命中 sleep 記錄 supp-e3（score=1），與 supp-e2 的 "group"（score=1）同分；同日同分下維持 recentEntries 原始順序（新→舊），故 supp-e3 排在 supp-e2 之前。真正與「group work」相關的 supp-e2 列第二。不構成錯誤（兩條均為真實記錄的逐字引用），但 fallback 的相關性排序品質有限，值得在報告中註記。
- 證據：`evidence/ua-supp2-03-ask-matched.json`。

### Step 4 — 無匹配查詢
- 請求：`POST /api/ask`，question = "What did I say about my grandmother's cooking?"
- **HTTP 200**，實際回應形狀：
  ```json
  {
    "found": false,
    "text": "I could not find anything about that in the available notes.",
    "hits": [],
    "genai": false
  }
  ```
- 符合預期：明確「找不到」語義、hits 為空、**無捏造引用**。
- 證據：`evidence/ua-supp2-04-ask-nomatch.json`。

### Step 5 — 引用誠實性核對
- **核對方式**：以 jq 將 ask-matched 回應的每個 `hits[].quote` 對 GET /api/entries 中同 `clientId` 的 `deidentified` 文字做 `contains` 逐字子串檢查（與 server `validateAsk`「非逐字即丟棄」的設計對應）。
- **結果**：2/2 引用均為原文逐字子串，`all_verbatim = true`。引用誠實性成立。
- 證據：`evidence/ua-supp2-05-quote-honesty-check.json`。

## genai 旗標
- 兩次 /api/ask 回應均為 `genai: false`（確定性本地 fallback），與 server 未配置 MOONSHOT_API_KEY 的環境一致；契約要求 UI 須披露「非 GenAI」——此披露段屬 app UI 範圍，本補測未覆蓋。

## 事件數
- `events/ua-supp2.json` 共 **5** 條事件（sequence 1–5 單調遞增，role_id=UA-SUPP-2、task_id=j4-ask-remediation、channel=API、data_classification=synthetic、gate_status=proceed，timestamp 為 UTC ISO-8601）；首條 observed 已註明「本補測僅覆蓋 API 層；app UI 來源標籤段未執行」。

## 環境問題
- 無阻斷性環境問題。server 在 8787 正常運行（health 200），既有裝置與 3 條記錄完好，無需重同步。
- macOS `head -n -1` 不相容導致第一次註冊指令的 body 擷取失敗（僅本地腳本問題），改用 `sed '$d'` 後成功，不影響被測系統。

## 結論
- J4 伺服器路徑**通過**：有匹配 → found=true + 逐字引用（附相關性排序雜訊註記）；無匹配 → 誠實「找不到」+ 空 hits；引用誠實性 2/2 逐字；genai=false 旗標正確。
- **未覆蓋**：app UI 的來源標籤 / 「非 GenAI」披露段（需 app channel 補測）。
- 佐證 UA-U 的 F1 矛盾（漏執行 J4 卻誤報完成）經本補測補上 API 層證據。
