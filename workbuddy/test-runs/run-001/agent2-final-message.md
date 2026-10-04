# Agent 2（MCP 必要性分析）最終回報 — run-001

## 產出

- **判定卡路徑**：`/Users/luo/MmM/unfold/workbuddy/test-runs/run-001/mcp-decision-card.md`
- 依 `api_reference.md` §2 格式：對 v2 §4 四張任務卡共 **31 個待測步驟**逐項列出目標能力／現有工具能否滿足／缺失／無 MCP 替代方案／最小 MCP（如需）／是否跳過真實確認／合成資料與環境／維護成本。
- 基線：journey-report-v2（概括授權通過，gate-log 事件 #16）；基線程式碼 git `598dcce`。

## 總結論（三選一）

**不需要。** 31 個待測步驟全部判定「不需要」，無一步「需要」或「資料不足」。

## 需要委託人批准的工程項數

**0。** 不啟動 developer／reviewer 分支。僅有 4 項已獲概括授權的操作者環境操作（server 啟動參數、seed、帶外 `verified` 翻轉、備援性 DB 時間戳改寫），非工程項。

## 四個關鍵問題裁定

1. **瀏覽器自動化＋curl＋DB 唯讀快照可覆蓋 §4 全部「期望證據」**：截圖/DOM/localStorage 快照（Expo web 的 AsyncStorage 落地為 localStorage）、curl 驗證 401/403/409/201 與 H6 直讀（`routes-worker.js:209-216` 無狀態檢查，已核實）、DB 唯讀快照核對去標識邊界。
2. **48h/72h 超時：環境變數縮短可行，且已冒煙實測接線**。`config.js:16-17` 以 `Number()` 解析（接受小數小時）；48h 路徑由 sweeper 每 60s 吃 config，72h 等待旗標是讀時計算（`routes-student.js:442`）。實測 `UNCLAIMED_TIMEOUT_HOURS=0.01 RESPONSE_TIMEOUT_HOURS=0.02` 啟動，`/api/health` 如實回報。備援（不需用）：操作者改測試 DB 時間戳，記環境操作。兩案均不需 MCP、不改產品。
3. **手工 JSON 事件＋`scripts/example.py` 事後驗證足夠滿足 §3 契約**（只用 UI/API channel 即合法）；附 5 條紀律要求（真實 timestamp、單調 sequence、evidence_ref 指向實存檔、handoff 共享 ID、環境操作如實登錄）。
4. **沒有任何步驟需要產品埋點或 MCP**。觀察不到的項目全部是不存在的功能（雲端刪除、管理員介面、demo 回覆迴路、連結 UI、存取審計），記「無法測試」＋產品缺口；MCP 測不了不存在的功能，建立它們＝改產品（禁止）。

## 主要測試盲點清單（與 MCP 無關，現有工具亦不可解）

1. GenAI 真實品質（無金鑰/不連網，整類無法測試；fallback 與降級揭露可測）
2. 跨記錄連結無使用者可觀察性（僅 API 層核對）
3. demo 模式回覆後三分支（無入口）
4. 管理員驗證發放（無產品表面，環境操作替代）
5. 雲端資料刪除（無功能）
6. server 無存取審計（H6 只能證「可讀」、不能證「曾讀」）
7. Expo web ≈ 原生近似差異（localStorage、mic/權限）
8. 15 秒輪詢僅能近似觀察（除非瀏覽器工具支援網路面板）
9. 嚴格同時 Claim 競爭（以 curl 併發補強）
10. 轉寫準確率／臨床適切性／真機行為（同 v1/v2）

## 核實方式與副產品證據

- 讀源核實：`config.js`、`sweeper.js`、`db.js`、`index.js`、`routes-student.js`、`routes-worker.js`、`seed.js`、`worker-web/vite.config.js`、兩個 `package.json`、`scripts/example.py`。
- **一次隔離冒煙實測**（8799 埠＋/tmp 獨立 DB＋顯式空 MOONSHOT_API_KEY）：證明 env 覆寫、小數超時、強制 fallback（在 `.env` 存在但未讀的 server 目錄下仍 `configured:false`，因 dotenv 不覆蓋已設變數）、獨立 DB 自動建 schema、`/api/health` 自證環境。
- 事後清理：測試程序已終結、/tmp 測試庫已刪、開發用 `unfold.db` mtime 未變（10/3 23:04）、8787 無監聽、無 staged 檔案、未改任何產品檔案。
- **重要執行備忘**（已寫入判定卡 §6）：worker-web proxy 硬編碼 `localhost:8787`，測試 server 須跑 8787＋`DB_PATH` 指獨立庫；worker-web 用 `npm run dev`（`vite preview` 是否沿用 proxy 未核實，不依賴）。

## 建議下一步

主 agent 依判定卡 §6 備忘準備隔離環境並派使用者 agents（Phase C）；無需任何工程批准關卡。
