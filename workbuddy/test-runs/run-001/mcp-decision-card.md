# Unfold MCP 判定卡 — run-001（Agent 2／MCP 必要性分析）

> 依 software-journey-evaluator 技能與 `references/api_reference.md` §2 格式產出。
> **基線**：`journey-report-v2.md`（已獲委託人概括授權通過，見 `gate-log.md` 事件 #16；非逐關卡知情確認，委託人事後可推翻）。基線程式碼：git `598dcce`。
> **方法**：① 逐檔核實 server/worker-web/Expo 的環境可操控性（不是假設）；② 一次**隔離冒煙實測**（獨立 /tmp DB、測試埠 8799、強制空金鑰）驗證環境變數接線；③ 按 v2 §4 四張任務卡逐待測步驟判定。
> **遵守限制**：未讀任何 `.env*`、未用真實金鑰、未修改產品程式碼、未觸碰開發用 `unfold.db`（冒煙後已驗證其 mtime 未變）、未建置任何 MCP 或工具。
> **本卡不預設要建 MCP**；所有「最小 MCP」欄位只在確有需要時才填實。

---

## 0. 總結論

| 項目 | 結論 |
| --- | --- |
| 整體判定（三選一） | **不需要** |
| 逐步驟判定 | 四張任務卡共 31 個待測步驟，**全部「不需要」**（無一步「需要」或「資料不足」） |
| 需委託人批准的工程項數 | **0**（不啟動 developer／reviewer 分支） |
| 需委託人知悉的環境操作 | 4 項（server 啟動參數、seed、帶外翻轉 `verified`、備援性 DB 時間戳改寫）——均為 gate-log #16 已概括授權的環境操作，非工程項 |

---

## 1. 環境能力核實結果（逐項附證據）

| # | 能力 | 核實方式 | 證據 | 結論 |
| --- | --- | --- | --- | --- |
| E1 | 環境變數覆寫（PORT／DB_PATH／JWT_SECRET／MOONSHOT_API_KEY／超時） | 讀源码＋冒煙實測 | `server/src/config.js:10-18` 全部取自 `process.env`；實測 `PORT=8799 DB_PATH=/tmp/... MOONSHOT_API_KEY= UNCLAIMED_TIMEOUT_HOURS=0.01 RESPONSE_TIMEOUT_HOURS=0.02 node src/index.js` → `/api/health` 回 `{"genai":{"configured":false},"timeouts":{"unclaimedHours":0.01,"responseHours":0.02}}` | **成立** |
| E2 | 分數小時超時（如 0.01h＝36 秒） | 讀源码＋實測 | `config.js:16-17` 用 `Number()` 解析，接受小數；實測 health 回 0.01／0.02 | **成立**——48h/72h 可縮至分鐘級 |
| E3 | 48h 接案超時由 sweeper 吃 config | 讀源码 | `sweeper.js` `runSweeper(db, now, config)` 讀 `config.responseTimeoutHours`；`startSweeper` 每 60s 執行一次 | **成立**——縮短後 ≤(超時＋60s) 內可觀察自動 rematch |
| E4 | 72h 未接案等待旗標為**讀時計算** | 讀源码 | `routes-student.js:442` `waitingNoWorker: isWaiting(row, new Date(), config)`；`sweeper.js` `isWaiting` 讀 `config.unclaimedTimeoutHours` | **成立**——縮短後下一次輪詢即見旗標，**不需改 DB 時間戳** |
| E5 | 強制 GenAI fallback 且**不讀 .env** | 讀源码＋實測 | `config.js:1` `import 'dotenv/config'` 會自動載入 server 目錄的 `.env`，但 dotenv **不覆蓋已設置的環境變數**；實測在 server 目錄（`.env` 存在但未讀）以顯式 `MOONSHOT_API_KEY=`（空值）啟動 → health 回 `configured:false`、啟動日誌明示走 fallback | **成立**——顯式環境變數優先，無需讀 .env 即可鎖定 fallback |
| E6 | 獨立測試 DB | 讀源码＋實測 | `config.js:11` `DB_PATH`；`db.js` `createDb` 對新路徑自動建 schema；實測 `/tmp/unfold-a2-check.db*` 被建立、開發用 `unfold.db` mtime 未變（10/3 23:04）、事後已清理 | **成立** |
| E7 | server 自證環境狀態 | 讀源码＋實測 | `index.js` `GET /api/health` 回 genai 配置與超時值——每次測試開跑可 curl 存證 | **成立**（免費的環境證據通道） |
| E8 | 測試種子幂等 | 讀源码 | `seed.js`：`demo.worker`（verified=1，general，zh-HK+en）／`new.worker`（verified=0），密碼 `demo1234`，`ON CONFLICT(email) DO NOTHING`；以 `DB_PATH=<測試庫> npm run seed` 注入 | **成立** |
| E9 | H6（撤回後直讀）可驗證 | 讀源码 | `routes-worker.js:209-216`：`GET /api/worker/cases/:id` 僅查 `claimed_by !== req.worker.id` → 403，**無狀態檢查**——撤回後以真 JWT curl 直讀即可取證 | **成立**（純 curl，無需 MCP） |
| E10 | 帶外驗證翻轉 | 讀源码 | `db.js` schema `workers.verified INTEGER`；操作者以 sqlite3 對**測試 DB** 執行 `UPDATE workers SET verified=1 …`，記為環境操作（gate-log #16 問題 11 已授權） | **成立**（環境操作，非產品行為，須如實標記） |
| E11 | worker-web 對接測試 server | 讀源码 | `worker-web/vite.config.js`：`server.proxy '/api' → http://localhost:8787`（**硬編碼**）。故測試 server 應跑在 **8787**（現已核實無佔用）＋`DB_PATH` 指獨立測試庫；建議用 `npm run dev`（proxy 已核實），`vite preview` 是否沿用 `server.proxy` 未核實、不作依賴 | **成立**（附埠位約定） |
| E12 | Expo web 學生端 | 讀源码 | 根 `package.json`：`web: expo start --web`；`EXPO_PUBLIC_API_URL` 可指測試 server（v2 報告 §1）；無 ElevenLabs key → 轉寫失敗 → 打字回退（J2 例外路徑天然可測） | **成立** |
| E13 | 事件契約可被官方驗證器檢查 | 讀源码 | `scripts/example.py`：必須欄位 15 個、`channel ∈ {UI, API, MCP}`、`data_classification == "synthetic"`、有 `handoff_id` 時需 5 個交接欄位。**手工維護的 JSON 只要欄位齊即通過**；驗證器純離線唯讀、須操作者顯式指定檔案（技能規定不自動執行） | **成立**（見關鍵裁定 Q3） |

### 冒煙實測紀錄（run-001／Agent 2，2026-10-04）

```
$ cd unfold/server && PORT=8799 DB_PATH=/tmp/unfold-a2-check.db MOONSHOT_API_KEY= \
  JWT_SECRET=agent2-check-only UNCLAIMED_TIMEOUT_HOURS=0.01 RESPONSE_TIMEOUT_HOURS=0.02 \
  node src/index.js &
$ curl -s http://localhost:8799/api/health
{"ok":true,"genai":{"configured":false,"model":"kimi-k3","baseUrl":"https://api.moonshot.ai/v1"},
 "timeouts":{"unclaimedHours":0.01,"responseHours":0.02}}
# 日誌：[server] GenAI: NOT configured — deterministic local fallbacks will be used (genai=0)
```

事後：測試程序已終結（8799 無監聽）、/tmp 測試庫已刪除、開發用 `unfold.db` mtime 未變、8787 無監聽（測試前後均無）、無 staged 檔案、未改任何產品檔案。

---

## 2. 四個關鍵裁定

### Q1：瀏覽器自動化＋curl＋DB 唯讀快照，能否覆蓋 §4 四張任務卡的「期望證據」？

**裁定：能覆蓋。** 三條證據通道對應任務卡要求的三類證據：

| 任務卡要求的證據 | 覆蓋通道 |
| --- | --- |
| 每步畫面截圖／狀態轉儲（UA-S/UA-U/UA-W1/UA-W2） | 瀏覽器自動化（Expo web＋worker-web 兩個頁面並行操作、截圖、讀 DOM） |
| 開關前後本機儲存快照（UA-S） | Expo web 的 AsyncStorage 落地為瀏覽器 localStorage，自動化可 dump 前後快照 |
| 401/403/409/201/atomic claim 證據（UA-W1/UA-W2） | UI 訊息＋curl 直接呼叫（含 H6 直讀、未驗證 403、重複註冊 409、容量 409） |
| 分享前後本機與 server 兩側快照（UA-U） | server 側：DB 唯讀快照（`sqlite3 'file:…?mode=ro'`）或 curl `GET /api/entries`（持本裝置 token）；本機側：localStorage dump |
| genai 旗標／來源標籤／fallback 狀態 | UI 來源標籤＋API 回應的 `genai` 欄位＋`/api/health` 的 `configured:false` 三重存證 |
| 事件紀錄（api_reference §3 欄位） | 各 agent 手工記 JSON，事後由操作者以 `scripts/example.py` 驗證（見 Q3） |

唯一需要「操作者協助」的環節（server 啟動參數、seed、`verified` 翻轉、DB 快照導出）已在任務卡中明文標為操作者環境操作，不構成工具缺失。

### Q2：48h/72h 超時情境——環境變數縮短是否可行？不可行時的無 MCP 替代？

**裁定：可行，且已實測接線（E1–E4），列為首選方案。**

- 機制：`RESPONSE_TIMEOUT_HOURS`／`UNCLAIMED_TIMEOUT_HOURS` 經 `Number()` 解析（接受小數），sweeper 每 60s 吃 config（E3），72h 等待旗標是**讀時計算**（E4）——兩條超時路徑都由同一組 env 變數控制。
- 建議值（Phase C 可再調）：`UNCLAIMED_TIMEOUT_HOURS=0.01`（36 秒）、`RESPONSE_TIMEOUT_HOURS=0.02`（72 秒）→ 72h 情境在下次輪詢（≤15s）可見；48h 情境在 ≤(72s＋60s tick) 內可見自動 rematch。
- 真實性聲明：超時數值被縮短屬**環境操作**，須記入事件紀錄（`channel` 標 API／備註環境操作）；**狀態機行為本身由真實 server 程式產生**，不是跳過待測確認。
- **備援（不需要時不用）**：若未來 env 途徑失效，操作者可直接改**測試 DB** 的 `cases.created_at`／`claimed_at` 時間戳（72h 路徑改 `created_at`、48h 路徑改 `claimed_at`），記為環境操作。兩案均不需 MCP、不需改產品程式碼。

### Q3：各 agent 手工記 JSON 事件再彙整，是否滿足 api_reference §3 契約？

**裁定：足夠。** `scripts/example.py` 只檢查：15 個必須欄位齊全、`channel ∈ {UI,API,MCP}`（我們只用 UI／API，合法）、`data_classification == "synthetic"`、有 `handoff_id` 時補 5 個交接欄位。手工 JSON 完全可以滿足；驗證器由操作者在事後對**明確指定的彙整檔**執行（技能規定不自動掃描）。

附帶紀律要求（寫進 Phase C 任務包）：
1. `timestamp` 必須是記錄當下真實時間，禁止事後估算；
2. `sequence` 全 run 單調遞增（彙整時以 timestamp＋agent 前綴決序）；
3. `evidence_ref` 必須指向實際存在的截圖／快照／curl 輸出檔；
4. H1–H6 交接的發送、授權、接收、撤回事件共享同一 `handoff_id`，以 `artifact_version` 區分修訂；
5. 環境操作（啟動參數、verified 翻轉、DB 快照）由操作者以獨立事件如實登錄，不得冒充產品行為。
殘餘風險：手工紀律出錯（漏欄位、時間倒序）——緩解：統一事件模板＋彙整後 example.py 驗證＋Agent 3 事後抽核。**此風險用 MCP 也只是把同樣的紀律問題搬進工程面**，不構成建 MCP 的理由。

### Q4：有沒有任何步驟「現有工具觀察不到、必須加產品內埋點或 MCP」？

**裁定：沒有。** 逐一排查後，「觀察不到」的項目全部是**根本不存在的功能**，屬產品缺口而非可觀察性缺口：

| 觀察不到的對象 | 性質 | 處置 |
| --- | --- | --- |
| 雲端資料刪除（關閉同意／Delete everything／單條刪除後的 server 側） | 功能不存在（無刪除 API） | 記「無法測試」＋缺口；MCP 也測不了不存在的功能 |
| 管理員驗證發放介面 | 產品表面不存在（帶外人工流程） | 環境操作替代（E10）＋如實標記 |
| demo 模式回覆後三分支 | 回覆入口已移除 | 記「無法測試」（CONTRACT 明示 demo 無真人回覆） |
| 跨記錄連結的使用者可觀察性 | 無客戶端 UI 消費 | API 層核對 `GET /api/entries` 的 links（curl 可做）；使用者旅程層記「無法測試」 |
| server 端存取審計（H6「被讀幾次」） | 無日誌欄位 | 只能證明「撤回後**可**直讀」（curl 一次即證），不能證明「曾被讀」——記錄為產品觀察限制 |

建立上述任何一項都等於**修改產品**，為任務明令禁止；MCP 無法、也不應用來憑空測試不存在的產品行為。

---

## 3. 逐卡逐步判定表（api_reference §2 格式）

通用說明（避免每列重複）：**最小 MCP 工具與權限／需改動的專案範圍**：全部步驟均為「**無——不需要**」（結論同 §0）；**合成資料與測試環境**：全卡合成輸入（v2 §4 各卡已定義），環境＝測試 server（8787＋獨立 DB＋強制 fallback）＋Expo web＋worker-web dev，均已核實可用（§1）；**維護成本**：不建任何東西，維護成本為零，僅事件紀錄的人工紀律成本（低）。

### UA-S｜中學生（J1→J2→J3→J7＋缺口盤點）

| 步驟 | 目標能力 | 現有工具能否滿足 | 缺失 | 無 MCP 替代方案 | 跳過待測的真實確認？ |
| --- | --- | --- | --- | --- | --- |
| ① onboarding 理解＋是否提及雲端整理 | 讀取三步引導文案 | 能：瀏覽器逐頁截圖＋DOM 文字提取 | 無 | — | 否 |
| ② 勾選閘門驗證 | 未勾選不得完成 | 能：嘗試不勾直接完成（UI 行為）＋勾選後完成，兩次截圖 | 無 | — | 否 |
| ③ mic 拒絕→打字回退 | 權限失敗回退可用 | 能：自動化環境拒絕/無麥克風 → 觀察錯誤與打字入口（無 ElevenLabs key 時轉寫本來就失敗，回退路徑天然可達） | 無 | — | 否（web 近似原生，差異記入盲點 §4-7） |
| ④ 存英文＋含虛構中文姓名記錄 | 記錄落本機 | 能：UI 輸入＋localStorage 快照佐證 | 無 | — | 否 |
| ⑤ saved 頁 AI 回應（雲端關：應無） | 來源標籤與降級行為 | 能：截圖＋DOM | 無 | — | 否 |
| ⑥ diary/day 摘要與非評估聲明 | 本機摘要展示 | 能：截圖＋DOM | 無 | — | 否 |
| ⑦ 開雲端整理＋回述資料流＋中文姓名上雲核對 | 同意開關、去標識邊界 | 能：UI 開關＋錯誤提示截圖；server 側用 DB 唯讀快照／curl `GET /api/entries` 檢 `deidentified` 欄位（**預期中文姓名未去標識而上雲→記產品缺口**） | 無 | — | 否（缺口本身即為待測對象，如實記錄） |
| ⑧ privacy 頁未涵蓋雲端資料流 | 文案覆蓋落差 | 能：截圖＋DOM 對照 settings 文案 | 無 | — | 否 |

**UA-S 小結：不需要。**

### UA-U｜大學生（雲端開啟全流程＋例外＋超時）

| 步驟 | 目標能力 | 現有工具能否滿足 | 缺失 | 無 MCP 替代方案 | 跳過待測的真實確認？ |
| --- | --- | --- | --- | --- | --- |
| ① 建 4–5 條跨天合成記錄 | 記錄＋同步 | 能：UI 輸入；同步結果以 API 回應與 UI 來源標籤觀察 | 無 | — | 否 |
| ② server 側只存去標識文字 | 資料邊界 | 能：操作者導出 DB 唯讀快照（entries.deidentified/tokens）＋curl 比對；虛構英文識別字串應消失、中文姓名應殘留（缺口） | 無 | — | 否（快照是環境證據，非代替 UI 確認） |
| ③ 提示由 server 分析驅動（不滿足→不提示；補足→提示） | 閾值與來源 | 能：UI 觀察主頁 Notice 有無＋curl `GET /api/analysis` 取 `approaching/evidence/genai` | 無 | — | 否 |
| ④ Not now snooze | snooze 閘門 | 能：UI 操作＋前後截圖 | 無 | — | 否 |
| ⑤ prepare→review 編輯/TokenRow/摘錄 | 草稿可控性 | 能：UI 全程截圖 | 無 | — | 否 |
| ⑥ Approve→遠端個案 | H1 發送 | 能：UI（/shared 文案）＋curl/DB 見 `cases` 新列 `status=queued` | 無 | — | 否 |
| ⑦ claimed 提示→回覆→rematch→UA-W2 接→continue→withdraw | H1/H2 全狀態機 | 能：學生端 UI 15s 輪詢觀察狀態文案＋curl `GET /api/cases/active` 對帳；撤回後學生端「Nothing is shared right now.」截圖 | 無 | — | 否（跨端交接由 UA-W1/W2 真實操作產生） |
| ⑧ 兩種超時情境 | S2 行為 | 能：env 縮短超時（E1–E4 已實測）；72h→`waitingNoWorker` 下次輪詢可見；48h→≤(超時＋60s tick) 見自動 rematch＋`claim_count+1` | 無 | 備援：操作者改測試 DB 時間戳（記環境操作） | 否——**超時數值是環境操作，狀態機由真實 server 產生**；如實標記 |
| ⑨ J4 查詢來源標籤 | 問答降級揭露 | 能：UI 截圖＋curl `POST /api/ask` 回應的來源欄位 | 無 | — | 否 |

**UA-U 小結：不需要。**

### UA-W1｜社工（主接案）

| 步驟 | 目標能力 | 現有工具能否滿足 | 缺失 | 無 MCP 替代方案 | 跳過待測的真實確認？ |
| --- | --- | --- | --- | --- | --- |
| ① 登入＋隊列匹配欄位 | J8/J9 入口 | 能：worker-web UI（`demo.worker` 種子帳號）＋curl `GET /api/worker/queue` 對帳匹配三條件 | 無 | — | 否 |
| ② Claim 原子性 201 | 接案寫入 | 能：UI 點擊＋curl 併發補強（與 UA-W2 步驟④同一證據） | 無 | — | 否 |
| ③ 只見去標識內容、無 device_id/音頻入口 | 可見性邊界 | 能：個案頁截圖＋curl `GET /api/worker/cases/:id` 檢回應 JSON 無 `device_id` 欄位 | 無 | — | 否 |
| ④ 送出回覆 | H2 發送 | 能：UI 輸入送出；學生端 UA-U 輪詢到 `replied` 交互佐證 | 無 | — | 否 |
| ⑤ rematch 後回隊列＋`rematch ×1` 徽章 | H1 恢復 | 能：UI 隊列截圖＋curl queue 回應的 claim_count | 無 | — | 否 |
| ⑥ withdraw 後列表消失＋H6 直讀核對 | 撤回語義 | 能：UI `/cases` 列表截圖＋操作者協助 curl 帶真 JWT 直讀（E9，**只記錄不評論**） | 無 | — | 否（用真 token 真 API 驗真實產品行為） |
| ⑦ 容量=1 閘門＋改回 | 容量限制 | 能：UI（queue 空＋警示）＋curl `PATCH /api/workers/me` 前後對帳 | 無 | — | 否 |
| ⑧ 登出＋路由守衛 | J10 | 能：UI 觀察跳轉＋curl 帶已清除 token 取 401 | 無 | — | 否 |

**UA-W1 小結：不需要。**

### UA-W2｜社工（註冊→待驗證→競爭／接收 rematch）

| 步驟 | 目標能力 | 現有工具能否滿足 | 缺失 | 無 MCP 替代方案 | 跳過待測的真實確認？ |
| --- | --- | --- | --- | --- | --- |
| ① 註冊＋待驗證雙端阻擋 | J8 閘門 | 能：UI（VerificationPending、個人資料可編輯）＋curl 未驗證 token 取 `403 not_verified`；重複註冊 409、錯密碼 401 同法 | 無 | — | 否 |
| ② 操作者帶外翻轉 verified | 驗證發放替代 | 能：操作者 sqlite3 寫**測試 DB**（E10），事件紀錄標「環境操作」 | 產品無此表面（缺口，非工具缺失） | — | 部分是——**觸發手段**非產品行為並已如實標記；閘門行為本身仍由真實 server 驗證 |
| ③ 驗證後進隊列 | 狀態解鎖 | 能：UI 刷新截圖 | 無 | — | 否 |
| ④ 同時 Claim 競爭（一方 201／一方 409） | 原子性 | 能：兩個瀏覽器頁面近似同時點擊；**併發強度不足處以 curl 平行請求補強**（同 case_id、兩組 token） | UI 難保證嚴格同時（記入盲點 §4-9） | curl 併發即無 MCP 替代 | 否 |
| ⑤ 接走 rematch 個案＋歷史訊息可見 | H1 再接收 | 能：UI 個案頁截圖（歷史訊息串對新社工可見，記錄觀察） | 無 | — | 否 |
| ⑥ 回覆讓 UA-U continue | H2 | 能：UI＋學生端交叉佐證 | 無 | — | 否 |

**UA-W2 小結：不需要。**

---

## 4. 測試盲點清單（現有工具亦覆蓋不了；均非 MCP 可解）

| # | 盲點 | 性質 | 處置 |
| --- | --- | --- | --- |
| 1 | 所有 GenAI 功能的真實模型品質 | 無金鑰＋不連網（gate-log #16 問題 7 已決） | 整類「無法測試」；fallback 與降級揭露可測 |
| 2 | 跨記錄連結的使用者可觀察性 | 無客戶端 UI | 僅 API 層核對；旅程層「無法測試」 |
| 3 | demo 模式回覆後三分支 | 回覆入口已刪 | 「無法測試」（設計明示） |
| 4 | 管理員驗證發放流程 | 無產品表面 | 環境操作替代＋標記 |
| 5 | 雲端資料刪除 | 功能不存在 | 「無法測試」＋阻斷觀察項（gate-log #16 問題 10） |
| 6 | server 存取審計 | 無日誌欄位 | H6 只能證「可讀」不能證「曾讀」；記產品觀察限制 |
| 7 | Expo web ≈ 原生的近似差異 | AsyncStorage→localStorage、麥克風/權限行為、導覽手勢 | 記環境近似聲明；真機行為「無法測試」 |
| 8 | 15 秒輪詢的精確間隔 | UI 層只能觀察狀態變化的上界 | 以時間戳截圖近似；若瀏覽器工具支援網路請求面板可補強，否則記「近似觀察」 |
| 9 | 嚴格同時的 Claim 競爭 | UI 併發不可保證 | curl 平行請求補強原子性證據 |
| 10 | 粵語/英文轉寫準確率、臨床適切性、真機行為 | 同 v1/v2 先天限制 | 「無法測試」 |

---

## 5. 不建 MCP 的替代方案總結（與假設性 MCP 的對照）

| 假設性 MCP 能帶來的便利 | 現有無 MCP 替代 | 判定 |
| --- | --- | --- |
| 事件自動捕捉 | 手工 JSON＋統一模板＋example.py 事後驗證＋Agent 3 抽核 | 便利抵不過工程＋reviewer＋權限審查成本 |
| 測試時間控制 | env 變數（已實測）＋備援 DB 時間戳 | 完全覆蓋 |
| 內部狀態直讀 | DB 唯讀快照＋curl（健康/分析/隊列/個案 API 已暴露所需欄位） | 完全覆蓋 |

**技能界線提醒**（SKILL.md 安全與品質界線）：即使日後建有 MCP，內部狀態讀取也**不能取代**使用者可見的端到端測試；本次全部關鍵確認均走真實 UI／真實 API，符合該界線。

---

## 6. 交接給主 agent 的執行備忘（非工程項，無需委託人批准）

1. **測試 server 啟動樣例**（Phase C 操作者執行，事件紀錄標環境操作）：
   ```bash
   cd unfold/server
   PORT=8787 DB_PATH=<獨立測試庫路徑> MOONSHOT_API_KEY= JWT_SECRET=run001-test-only \
     UNCLAIMED_TIMEOUT_HOURS=0.01 RESPONSE_TIMEOUT_HOURS=0.02 node src/index.js
   DB_PATH=<同一測試庫> npm run seed
   curl -s http://localhost:8787/api/health   # 開跑前存證環境狀態
   ```
   注意：啟動前確認 8787 無既有 dev server（本卡核實時無監聽）；worker-web 用 `npm run dev`（proxy→8787 已核實）；Expo 用 `EXPO_PUBLIC_API_URL=http://localhost:8787 npm run web`。
2. **操作者環境操作清單**（每項都要進事件紀錄）：① 上述啟動參數；② seed；③ UA-W2 的 `verified` 翻轉；④（僅備援）DB 時間戳改寫；⑤ DB 唯讀快照導出。
3. **事件檔**：各 agent 獨立 JSON → 彙整單檔 → 操作者顯式執行 `python3 scripts/example.py <檔案>`（技能規定不自動執行）。
4. 本判定不需要 developer／reviewer；若委託人事後要求任何工程項，依技能 §B.5 另起批准關卡。

---

## 7. 審批欄

- **判定卡版本**：mcp-decision-card v1（run-001，Agent 2 產出；基線：journey-report-v2／git `598dcce`）。
- **總結論**：**不需要** MCP；工程批准項數 **0**。
- 依 gate-log #16 概括授權，本卡不觸發任何工程分支；Phase C 可依 §6 備忘直接準備隔離環境。委託人如推翻概括授權或要求工程項，回到技能 §B 關卡處理。
