# UA-W1｜社工（主接案，合成）— 階段 1 最終訊息

- **run_id**：run-001 ｜ **journey_version**：v2-approved ｜ **role_id**：UA-W1 ｜ **task_id**：UA-W1-stage1
- **範圍**：登入 → 隊列匹配 → 接案 → 可見性核對 → 回覆 → 越權測試（階段 1 共 6 步＋環境繞道）
- **資料分類**：全部合成（synthetic）｜ **gate_status**：proceed
- **基線**：journey-report-v2.md（§4 UA-W1 卡、§2 J8/J9、§3 H1/H2）
- **瀏覽器 session**：`ua-w1` 保持開啟（未關閉），停留在個案頁 `/cases/b81825ca-…`

---

## 1. 逐步結果

| # | 步驟 | 結果 | 證據 |
| --- | --- | --- | --- |
| 0 | 環境繞道 | ✅ 完成 | 無截圖（events seq 1） |
| 1 | 開 5174、登入 demo.worker | ✅ 完成 | ua-w1-step01.png |
| 2 | /queue 可見欄位＋匹配核對 | ✅ 完成 | ua-w1-step02.png |
| 3 | Claim b81825ca → 成功；My Cases 核對 | ✅ 完成（201/成功路徑，無 409） | ua-w1-step03/05.png |
| 4 | 個案頁可見性邊界核對（UI＋API） | ✅ 完成 | ua-w1-step04.png |
| 5 | 送出合成回覆 → replied；curl 核對落庫 | ✅ 完成 | ua-w1-step06/07.png |
| 6 | 越權測試（API） | ✅ 完成 | 無截圖（curl 輸出見事件） |

未執行項：無（階段 1 指定步驟全部執行）。未觀察項：403 `not_your_case` 分支（環境中無「存在但屬他人」的個案，屬 UA-W2 階段範圍）；409 競爭接案分支（本階段無第二人同時 Claim）。

## 2. 逐步明細

**步驟 1｜登入（J8）**：`http://localhost:5174` Sign in 頁以 `demo.worker@unfold.local` / `demo1234` 登入，成功後重定向 `/queue`，頂欄顯示「Demo Worker」。**JWT 已落地**：localStorage 含 key `unfold.worker.token`（僅核對存在，值不回報）。

**步驟 2｜隊列匹配（J9）**：隊列恰 1 案，即目標個案（API 核對 id=b81825ca-bdab-414e-b19f-c5f37af9d457）。UI 可見欄位：期間「Notes from Thu 1 Oct to Sun 4 Oct」、狀態 Queued、語言 zh-HK、等待 **0.3h**（API `waitingHours=0.27`）、topics=[academic, group, sleep]、兩句結論首段「Coursework deadlines and a one-person group project are wearing me down」、Queued 時間 4 Oct 2026 01:35、Claim 按鈕。徽章：無 rematch 徽章（claim_count=0，正確）；容量 Active **0/5**、無達容量警示。匹配邏輯成立：語言 zh-HK ∈ 社工語言 ∧ expertise 含 general ∧ 未達容量。**觀察**：任務預期 topics 含 coursework，實際分類產出為 `academic`（group/sleep 相符）——屬 GenAI/fallback 分類輸出差異，非匹配錯誤。

**步驟 3｜接案（H1 接收端）**：對 b81825ca 按 Claim，**一次成功（無 409）**，UI 重定向至 `/cases/b81825ca-…`，狀態「Awaiting your response」。API 複核：status=claimed、claim_count=1、claimed_at=2026-10-03T17:51:55Z。「My Cases」列表出現該案（Awaiting your response、Updated 01:51、Open case 連結）。

**步驟 4｜可見性邊界核對**：見下節。

**步驟 5｜回覆（H2 發送端）**：填入合成回覆「Thank you for sharing this. It sounds like the group project situation has been weighing on you. Would you like to tell me more about what happened?」後 Send 由 disabled 轉可用；送出成功，個案頁狀態轉 **Replied**，Messages 區出現「You · 4 Oct 2026, 01:53」＋回覆全文。curl 複核：GET case → status=**replied**、responded_at=2026-10-03T17:53:34.969Z；GET case/messages → 1 條訊息，sender=worker、text 與合成回覆**逐字一致**、created_at 與 responded_at 相同——**訊息已落庫**。

**步驟 6｜越權測試（channel=API）**：以本人 JWT 讀假個案 ID `b81825ca-0000-0000-0000-000000000000` → **HTTP 404 `case_not_found`**（預期 403/404，實際 404，符合）；無 token 直讀真個案 → **HTTP 401 `missing_bearer_token`**。均通過。

## 3. 個案當前狀態（階段 1 結束時）

- id：`b81825ca-bdab-414e-b19f-c5f37af9d457` ｜ status：**replied** ｜ claim_count：1 ｜ claimed_by：demo.worker（UA-W1）
- claimed_at：2026-10-03T17:51:55Z ｜ responded_at：2026-10-03T17:53:34Z
- messages：1 條（worker → student，H2 已送達 server；學生端 15 秒輪詢消費屬 UA-U 階段 2 核對範圍）

## 4. 可見性邊界核對結果

| 核對項 | 結果 |
| --- | --- |
| 去標識兩句結論（main_concerns＋recent_change） | ✅ 可見 |
| 期間、topics、語言、狀態、時間戳 | ✅ 可見 |
| 摘錄（6 條，摺疊展示） | ✅ 可見（均為去標識文字；例外見下） |
| device_id | ✅ **不可見**——UI 無；API 負載 grep `device\|audio\|transcript\|install` **零命中** |
| 音頻入口 | ✅ 無（UI 與 API 均無任何音頻欄位/連結） |
| 全文稿 | ✅ 無入口 |
| 頁面明示錄音/全文稿不離開學生裝置 | ✅ 原文：「These excerpts are deidentified student text, shared only because the student explicitly authorised the cloud organisation. **Original recordings and transcripts never leave the student's device.**」 |
| **「陳小明」觀察** | ⚠️ **產品缺口（如實記錄，非測試失誤）**：Excerpt 2（粵語摘錄）可見虛構中文姓名「陳小明」——`deidentify.ts` 僅覆蓋英文格式 PII，中文姓名未去標識且已延伸至分享層（對應 v2 §1 風險 4）。UI 與 API 負載中均可見。 |

## 5. 產出清點

- **事件數**：11（`events/ua-w1.json`；sequence 1–11 單調；channel UI×7／API×4；全部 data_classification=synthetic、gate_status=proceed）
- **handoff 事件**：接案事件掛 `handoff_id=H1-run001`（sender UA-U → recipient UA-W1）；回覆事件掛 `handoff_id=H2-run001`（sender UA-W1 → recipient UA-U）；兩者均含 artifact_id=b81825ca-bdab-414e-b19f-c5f37af9d457、artifact_version=1、consent_ref=cloudOrg+review-approve
- **截圖數**：7（ua-w1-step01–07.png，全部非空；未引用截圖的事件 evidence_ref="none"）

## 6. 環境問題（產品／環境區分）

**環境問題（非產品）**
1. 字面 `agent-browser` 命令在本環境被攔截（回覆「Use the native agent_browser tool…」且卡死）；改用直接二進位路徑 `/opt/homebrew/lib/node_modules/agent-browser/bin/agent-browser-darwin-arm64` 後全部操作正常（orchestrator 診斷修復，事件 seq 1 已記）。
2. 個案 API（GET /api/worker/cases/:id）不回傳 messages，需另呼叫 `/messages` 子端點——屬 API 設計觀察，不影響核對。

**產品觀察（非本 agent 失誤）**
1. ⚠️ 中文姓名「陳小明」未去標識並進入分享層（已知缺口，v2 §1 風險 4；本輪在社工端 UI＋API 雙側實測確認）。
2. 備註：topics 分類輸出為 `academic` 而非任務預期的 `coursework`（分類器輸出差異；匹配與可見性不受影響）。
3. 本階段未觸發的產品分支：409 競爭接案、403 not_your_case（均待 UA-W2／後續階段）。

## 7. 交接給階段 2 的狀態

- 瀏覽器 session `ua-w1` 開著，已登入，停在個案頁（狀態 Replied）。
- JWT 暫存於 `/tmp/ua-w1-token.txt`（chmod 600；僅供本 run 後續 curl 使用，值未外洩至任何報告）。
- 個案 b81825ca 現為 replied，等待 UA-U 階段 2 的三分支（continue/rematch/withdraw）與 UA-W2 的競爭/rematch 接收。

**依任務要求，本階段不做自評分。**

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "6 個指定步驟＋1 條環境繞道全部執行且無範圍擴張：未碰 8081/5173/8082 其他 session、未改程式碼/DB、未讀 .env*；越權測試僅用任務指定的假 ID；未做自評分（留待階段 2）。事件檔 11 條與任務步驟一一對應"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "11 條事件（sequence 單調、handoff 欄位齊：H1-run001/H2-run001、artifact_id、consent_ref）、7 張非空截圖、API 核對輸出（queue/case/messages/404/401）均記入事件 observed 與本報告；python3 驗證 events JSON 合法、evidence_ref 全部實存"
    }
  ],
  "changedFiles": [
    "workbuddy/test-runs/run-001/events/ua-w1.json",
    "workbuddy/test-runs/run-001/ua-w1-stage1-final-message.md",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step01.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step02.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step03.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step04.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step05.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step06.png",
    "workbuddy/test-runs/run-001/evidence/ua-w1-step07.png"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "agent-browser-darwin-arm64 --session ua-w1 open/fill/click/eval/screenshot/snapshot（5174 登入→queue→claim→case→respond 全程）",
      "result": "passed",
      "summary": "登入成功 JWT 落地；queue 顯示目標個案；Claim 成功轉 claimed；回覆成功轉 Replied；7 截圖存證"
    },
    {
      "command": "curl -H \"Authorization: Bearer <token>\" http://localhost:8787/api/worker/queue",
      "result": "passed",
      "summary": "200；id=b81825ca…、status=queued、topics=[academic,group,sleep]、zh-HK、waitingHours=0.27、無 device_id"
    },
    {
      "command": "curl -H \"Authorization: Bearer <token>\" http://localhost:8787/api/worker/cases/b81825ca-bdab-414e-b19f-c5f37af9d457（接案前後＋回覆後共 3 次）＋grep device|audio|transcript|install",
      "result": "passed",
      "summary": "200；status queued→claimed→replied 正確流轉；負載邊界 grep 零命中；responded_at=2026-10-03T17:53:34Z；摘錄含「陳小明」（產品缺口，如實記錄）"
    },
    {
      "command": "curl -H \"Authorization: Bearer <token>\" http://localhost:8787/api/worker/cases/b81825ca-…/messages",
      "result": "passed",
      "summary": "1 條訊息，sender=worker，text 與合成回覆逐字一致，created_at 與 responded_at 相同——落庫確認"
    },
    {
      "command": "curl（越權測試）假 ID b81825ca-0000-… ＋無 token 直讀",
      "result": "passed",
      "summary": "假 ID→404 case_not_found；無 token→401 missing_bearer_token；均符合預期"
    },
    {
      "command": "python3 驗證 events/ua-w1.json（JSON 合法、sequence 單調、evidence_ref 實存非空）",
      "result": "passed",
      "summary": "11 events、sequence [1..11] 單調無重複、7 個截圖引用全部實存"
    }
  ],
  "validationOutput": [
    "events: 11; sequence monotonic: True [1..11]; all evidence refs exist & non-empty; handoff events: step3-claim(H1), step5-respond(H2)",
    "case 最終態：status=replied, claim_count=1, responded_at=2026-10-03T17:53:34.969Z",
    "可見性 grep：device/audio/transcript/install 在 case API 負載零命中",
    "越權：404 case_not_found（假 ID）、401 missing_bearer_token（無 token）"
  ],
  "residualRisks": [
    "403 not_your_case 分支未觸發（環境中無他人個案），待 UA-W2 階段覆蓋",
    "409 競爭接案分支未觸發（本階段無第二人同時 Claim）",
    "JWT 暫存 /tmp/ua-w1-token.txt 供階段 2 接續 curl 使用（chmod 600，值未入任何報告）",
    "學生端是否收到 replied（15 秒輪詢消費 H2）屬 UA-U 階段 2 核對範圍，本 agent 未驗證"
  ],
  "noStagedFiles": true,
  "diffSummary": "新增 UA-W1 階段 1 事件檔（11 條，含 H1/H2 handoff 欄位）、7 張 UI 截圖證據、本最終訊息；未改任何產品程式碼/DB",
  "reviewFindings": [
    "no blockers",
    "觀察（產品缺口，非本次執行失誤）：摘錄 Excerpt 2 可見虛構中文姓名「陳小明」，UI 與 API 雙側確認，對應 v2 §1 風險 4",
    "觀察（環境）：字面 agent-browser 命令被攔截，已改用直接二進位路徑繞過並記為事件 seq 1",
    "觀察（分類輸出）：個案 topics 為 academic/group/sleep，與任務預期的 coursework/group/sleep 有 academic↔coursework 差異，不影響匹配與可見性結論"
  ],
  "manualNotes": "瀏覽器 session ua-w1 依要求保持開啟（停在個案頁，狀態 Replied）；所有資料為合成；未做自評分（階段 2 才做）。"
}
```
