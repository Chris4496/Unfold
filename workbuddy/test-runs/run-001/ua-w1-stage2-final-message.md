# UA-W1｜社工（主接案，合成）— 階段 2 最終訊息（旅程終結）

- **run_id**：run-001 ｜ **journey_version**：v2-approved ｜ **role_id**：UA-W1 ｜ **task_id**：UA-W1-stage2
- **範圍**：個案列表邊界 → 個人資料修改（J10）→ 登出守衛 → 自評分（容量閘門測試經編排解綁，本階段不含）
- **資料分類**：全部合成（synthetic）｜ **gate_status**：proceed
- **接續狀態**：session `ua-w1`（登入態，停個案頁）、token /tmp/ua-w1-token.txt、截圖自 step08 接續
- **背景核實**：個案 b81825ca 經 rematch 屬 UA-W2 且學生已 withdraw——curl 讀該案回 **HTTP 403 not_your_case**，確認已不屬我

---

## 1. 逐步結果

| # | 步驟 | 結果 | 證據 |
| --- | --- | --- | --- |
| 1a | /cases（My Cases）邊界 | ✅ 完成 | ua-w1-step08.png |
| 1b | /queue 邊界 | ✅ 完成 | ua-w1-step09.png |
| 1c | API 複核（queue＋舊案） | ✅ 完成（403 not_your_case 補齊實測） | 無截圖（curl 輸出見事件 seq 14） |
| 2 | 個人資料修改（J10）＋API 核對 | ✅ 完成 | ua-w1-step10/11.png |
| 3 | 登出＋localStorage 核對＋未登入守衛 | ✅ 完成 | ua-w1-step12/13.png |
| 4 | 自評分 | ✅ 完成 | events/ua-w1-score.json |

未執行項：無。未觀察項：無（本階段所有預期分支均觀察到）。

## 2. 列表邊界結果

| 核對項 | 預期 | 實際 | 判定 |
| --- | --- | --- | --- |
| /cases My Cases | 列表為空（案已不屬我且已撤回） | 「You have no active cases」＋「Claim a case from the queue…」，無任何個案卡片 | ✅ |
| /queue | 無 b81825ca 該案（已撤回） | 「No cases match you right now」，Active cases: 0 / 5（修改前容量） | ✅ |
| API GET /api/worker/queue | 空 | 200 `{"cases":[],"atCapacity":false,"activeCount":0,"maxActive":5}` | ✅ |
| API GET 舊案 b81825ca | 拒絕 | **HTTP 403 `{"error":"not_your_case"}`** | ✅ |

**附帶收穫**：階段 1 未能觸發的 403 `not_your_case` 分支（存在但屬他人的個案）在本階段自然命中——rematch 後個案屬 UA-W2，以我本人 JWT 讀取即被拒。撤回個案即時退出 queue 與 My Cases 雙列表，server 端權限與列表一致性正確。

## 3. 個人資料修改核對（J10）

- **操作**：/profile 勾選「Academic stress」（原僅 General）、Maximum active cases 5→3，Save profile → 頁面顯示「Profile saved.」
- **落庫核對**（`curl -H "Authorization: Bearer <token>" http://localhost:8787/api/workers/me`）：
  - `max_active`：5 → **3** ✅
  - `expertise`：`["general"]` → **`["general","academic"]`** ✅
  - `languages`：`["zh-HK","en"]` 維持不變；id/email/name/organisation/verified 不變
- 依任務要求不改回（測試 DB）。
- 工具備註：agent-browser click 對 RN Web checkbox 無效 → 改用 input 原生 `el.click()`（DOM 中 checkbox 無 aria-label，依 snapshot 順序定位 index 4），核實 `checked=true` 才儲存；容量用 fill 成功（spinbutton value=3）。

## 4. 登出守衛結果

| 核對項 | 預期 | 實際 | 判定 |
| --- | --- | --- | --- |
| Log out | 登出並重定向 | URL → /login，頁面顯示 Sign in 表單 | ✅ |
| localStorage token | 清除 | `unfold.worker.token`=null 且 `Object.keys(localStorage)=[]`（完全清空） | ✅ |
| 未登入直訪 /queue | 導回登入頁 | open /queue → 最終 URL=/login，渲染 Sign in（Email/Password/Sign in＋Register），queue 內容未渲染 | ✅ |

工具備註：agent-browser click 對 Log out 按鈕無效（第一次空點後以 eval 確認 token 仍在，未誤判為已登出）→ 以 innerText 定位 BUTTON 並 dispatch pointer/mouse/click 完整序列後成功。

## 5. 自評總分

**89 / 100**（events/ua-w1-score.json；逐維 score/理由/證據/優點/缺點/建議俱全）

| 維度 | 得分 | 要點 |
| --- | --- | --- |
| 完成度（35） | 33 | 指定步驟零跳過；403 分支補齊；扣：409 分支環境上不可觸發、UI 互動需 JS 繞道 |
| 清晰與預期（20） | 17 | 階段 2 預期 100% 命中；扣：topics academic↔coursework 差異、「陳小明」中文姓名未去標識（產品缺口）使「只見去標識內容」預期不完全成立 |
| 內容控制與修正（25） | 22 | 全程 synthetic、回覆逐字核對、持久產物零 token 洩漏；扣：一次 eval 查詢設計失誤將 token 值帶入 session transcript（未入任何事件/報告/截圖）、繞道知識跨階段複用慢（兩次空點） |
| 失敗恢復（20） | 17 | 五次障礙均恢復且每次以產品狀態核實收尾、無資料污染；扣：同類 RN Web click 缺陷分三次才沉澱打法、首次恢復依賴 orchestrator 診斷 |

## 6. 產出清點

- **新增事件數**：7（events/ua-w1.json 總計 18 條；sequence 12–18 接續單調；task_id=UA-W1-stage2；channel UI×5／API×2；全部 data_classification=synthetic、gate_status=proceed；時間戳 `date -u` 實測）
- **截圖數**：本階段新增 6（ua-w1-step08–13.png，全部非空；累計 13）
- **自評檔**：events/ua-w1-score.json（JSON 合法；逐維加總 33+17+22+17=89 與 total_score 一致）
- **驗證**：python3 核對 events JSON 合法、sequence [1..18] 單調無重複、全部 evidence_ref 實存非空、score 加總一致

## 7. 環境問題（產品／環境／工具區分）

**工具問題（非產品）**
1. agent-browser click 對 RN Web 元件（checkbox、Log out 按鈕；階段 1 的 Claim/Send 同）無效——報「✓ Done」但狀態不變；需 JS `el.click()`／dispatchEvent 繞道。每次繞道後均以 API 或 localStorage 核實產品狀態真實改變，證產品 handler 正常。
2. eval 環境 `const` 跨呼叫持久導致重複宣告 SyntaxError——IIFE 包裹解決。
3. profile 表單 checkbox 無 aria-label/name/id，只能靠 DOM 順序定位（可測試性觀察，輕微）。

**產品觀察（非本 agent 失誤）**
1. 正面確認：撤回案即時退出雙列表、rematch 後原社工 403 not_your_case、未登入守衛導回 /login、登出清空 localStorage、profile 修改即時落庫。
2. 已知缺口（階段 1 已記，本階段無新增）：中文姓名「陳小明」未去標識上分享層；topics 分類 academic↔coursework 差異；GET case 不回傳 messages 需子端點。

**執行層自我記錄**：登出前一次無效點擊後的 eval 查詢把完整 token 值帶入 session 工具輸出（查詢設計失誤；值未寫入任何持久產物，已於評分「內容控制與修正」維度扣分並記錄）。

## 8. 旅程終結

UA-W1 全旅程（J8 登入 → J9 匹配/接案/可見性/回覆/越權 → J10 個人資料 → 列表邊界 → 登出守衛 → 自評）已完成，無未竟步驟。session `ua-w1` 依任務指示關閉（本訊息落檔後執行 `"$AB" --session ua-w1 close`）。

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "階段 2 指定 4 步全部執行且無範圍擴張：容量測試依解綁指示未做；profile 修改限任務指定兩項（容量 5→3、專長+1）且未改回；越權 curl 僅用本人 token 與既有個案 ID；未碰程式碼/DB/其他 session。事件 seq 12–18 與步驟一一對應"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "7 條新事件（sequence 12–18 單調接續）、6 張非空截圖（step08–13）、API 核對輸出（queue=[]、403 not_your_case、workers/me max_active=3/expertise=[general,academic]）記入事件 observed 與本報告；python3 驗證 events/score JSON 合法、sequence 單調、evidence_ref 全部實存、評分加總一致（33+17+22+17=89）"
    }
  ],
  "changedFiles": [
    "workbuddy/test-runs/run-001/events/ua-w1.json",
    "workbuddy/test-runs/run-001/events/ua-w1-score.json",
    "workbuddy/test-runs/run-001/ua-w1-stage2-final-message.md",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step08.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step09.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step10.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step11.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step12.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step13.png"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "agent-browser-darwin-arm64 --session ua-w1 open /cases＋/queue＋eval innerText＋screenshot（step08/09）",
      "result": "passed",
      "summary": "My Cases 空（You have no active cases）；queue 空（No cases match you right now，Active 0/5）；均截圖"
    },
    {
      "command": "curl -H \"Authorization: Bearer <token>\" /api/worker/queue＋/api/worker/cases/b81825ca-…",
      "result": "passed",
      "summary": "queue→200 cases=[]；舊案→HTTP 403 not_your_case（階段1 未觸發分支補齊實測）"
    },
    {
      "command": "profile 修改：fill 容量 3＋el.click() 勾 Academic stress＋Save→「Profile saved.」；curl /api/workers/me 核對",
      "result": "passed",
      "summary": "max_active 5→3、expertise [general]→[general,academic]、languages 不變——落庫確認；截圖 step10（前）/step11（後）"
    },
    {
      "command": "Log out（dispatch 事件序列）→ eval localStorage＋未登入 open /queue",
      "result": "passed",
      "summary": "登出後 URL=/login、localStorage 完全清空；未登入直訪 /queue 導回 /login 渲染 Sign in；截圖 step12/13"
    },
    {
      "command": "python3 驗證 events/ua-w1.json＋ua-w1-score.json",
      "result": "passed",
      "summary": "18 events、sequence [1..18] 單調無重複、stage2 事件 7 條、evidence_ref 全實存非空、評分 33+17+22+17=89 與 total 一致、全 synthetic"
    },
    {
      "command": "git status --porcelain＋git diff --cached --name-only",
      "result": "passed",
      "summary": "無 staged files（diff --cached 空；run-001 產物為 untracked，gate-log.md 為他 agent 修改）"
    }
  ],
  "validationOutput": [
    "events: 18; sequence monotonic: True [1..18]; stage2: 7; channels UI=12/API=6; all evidence refs exist & non-empty",
    "score total 89 = dims sum 89（完成度33/35、清晰與預期17/20、內容控制與修正22/25、失敗恢復17/20）",
    "邊界：/cases 空＋/queue 空＋API queue cases=[]＋舊案 403 not_your_case",
    "profile：max_active=3、expertise=[general,academic] 落庫",
    "守衛：登出後 localStorage=[]、未登入 /queue→/login"
  ],
  "residualRisks": [
    "一次 eval 查詢設計失誤使完整 token 值進入 session 工具輸出（未寫入任何事件/報告/截圖等持久產物；token 為測試用 JWT，已於自評扣分並記錄）",
    "UI 關鍵互動（Claim/Send/checkbox/Log out）均經 JS 繞道而非原生點擊路徑，真人互動未在本輪覆蓋（產品 handler 均經狀態核實正常）",
    "profile 修改依任務要求未改回（max_active=3、expertise+academic 留存測試 DB，可能影響後續匹配斷言）",
    "409 競爭接案分支在本 agent 旅程內環境上不可觸發（由 UA-W2 覆蓋）"
  ],
  "noStagedFiles": true,
  "diffSummary": "ua-w1.json 追加 7 條階段 2 事件（seq 12–18）、新增 ua-w1-score.json（89/100）、6 張截圖（step08–13）、本最終訊息；未改任何產品程式碼/DB 結構",
  "reviewFindings": [
    "no blockers",
    "觀察（工具）：agent-browser click 對 RN Web 元件系統性無效，建議沉澱標準繞道手冊（el.click/dispatchEvent＋事後狀態核實）",
    "觀察（正面產品確認）：403 not_your_case、撤回案即時退出雙列表、未登入守衛、登出清空 localStorage、profile 即時落庫全部符合預期",
    "自我記錄（執行層）：一次 eval 將 token 值帶入 session transcript，查詢設計應只用布林"
  ],
  "manualNotes": "UA-W1 旅程終結；session ua-w1 於本訊息落檔後關閉；所有資料為合成；自評 89/100 詳見 events/ua-w1-score.json。"
}
```
