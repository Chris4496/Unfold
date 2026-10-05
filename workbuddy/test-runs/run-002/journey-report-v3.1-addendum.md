# Unfold 旅程分析報告 v3.1 核實補篇（待委託人確認）

> 本補篇由 Agent 1（旅程分析）產出，**不是 Gate 1 批准，也不是正式模擬**。目的：以程式碼／文件／隔離單元測試證據**獨立核實** v3 §7 新問題 N1–N4 的修復（server-N lane 與 docs-N lane，未 commit），不預設工程代理結論為真。
>
> **基線與狀態**：當前 HEAD = `d90c2f1`（v3 基線 `fa78812` 之上有兩個 docs 提交）；N1–N4 修復在**未提交 worktree**（12 檔修改）。行號以現行 worktree 為準。本補篇與 v3 合讀；v3 未提及部分全部維持有效。
>
> **限制**：唯讀分析＋僅執行現有 in-memory/合成單元測試。未讀 `.env*`、未讀 dev DB（`unfold/server/unfold.db`）、未啟動 app/server/browser、無外部呼叫（已核實 shell 無 `MOONSHOT_API_KEY`，`genai.js:24` 空 key 在 fetch 前即 throw 走 fallback）。未 commit/stage/rollback，未修改任何檔案（唯一新增＝本補篇）。
>
> **模型誠實聲明**：Agent 1 實際運行於 **moonshotai/kimi-k3（thinking: xhigh）＝推理層級近似 Pro，非供應商保證 Pro**（同 v3）。
>
> **本輪親跑測試（唯一執行證據）**：
> - `unfold/server`: `npm test` → **tests 91 / pass 91 / fail 0，exit 0**（node --test，in-memory DB）
> - `unfold/`: `npm test` → **tests 29 / pass 29 / fail 0，exit 0**（tsx --test，fetch 全部 mock）
> - 與主 agent 重跑的 91/91 及 docs-N lane 的 29 一致；其餘一切結論屬靜態核實。

---

## 1. N1–N4 逐項裁定

裁定四態：**已修復／部分修復／未修復／新引入問題**。統計：**已修復 3（N1、N2、N4）／部分修復 1（N3）／未修復 0／新引入問題 0**（另有 5 項邊界殘留列 §2，其中 2 項需委託人裁決）。

### N1 已分享個案內容的雲端生命週期 → **已修復**（附重要邊界，不得籠統稱「全刪」）

**N1a 撤回（case-scoped）**：`POST /api/cases/:id/withdraw` 改為單一交易——`excerpts='[]'`（`server/src/routes-student.js:521`）＋刪除該案全部 messages（`:523`）；個案列保留（status=withdrawn、period/時間戳元資料不動）；200 回應不變。worker 端維持 404/409（v3 已核）。測試釘住 DB 層：`routes-student.test.js:532`（excerpts='[]'、messages=0、**main_concerns 與 period 明確斷言保留**、worker 404）。

**N1b purge（device-scoped）**：`purgeDeviceCloudData` 擴展——同一交易先刪 messages（`purge.js:30`，`case_id IN (SELECT … WHERE device_id=?)`）再刪 cases（`:32`），回傳 `{ deleted, casesDeleted }`（`:37`；`deleted` 維持 entries 計數語義，`casesDeleted` 純 additive）。三入口一致：`DELETE /api/entries`（`routes-student.js:319`）、consent `{cloudOrg:false,purgeCloud:true}`（`routes/devices.js:73-77`，回應 spread purge 結果）。測試：`consent.test.js:113`、`routes-student.test.js:371`（五表清空、messages 隨案刪、`casesDeleted:1`、active→null）。

**邊界（必須精確陳述）**：
- **撤回只清 `excerpts`＋`messages`**。個案列仍含**學生衍生內容**：`main_concerns`／`recent_change`（學生批准分享的兩句結論，去標識文字，`db.js:81-82`）、`topics`（`:84`，分類結果）、`language`（`:85`）、`period`。即「**此次指定的 excerpts/messages 修復完成**」**不等於**「所有敏感個案內容都已刪除」——worker 雖 404 不可讀，資料仍 at-rest 留存。
- **歷史 withdrawn 個案未遷移**：本次無任何資料遷移（`db.js` 未在 N 修復中改動，`migrateDb` 仍只處理 `sender_worker_id`）；修復前已存在的 withdrawn 列仍帶舊 excerpts/messages（同樣 404 不可讀但留存；dev DB 存量依限制未讀，狀態不明）。→ §2 決策 D-b。
- **CONTRACT.md:248 過度表述**：「so nothing shared stays readable **or stored**」——「or stored」不準確（main_concerns/recent_change/topics 仍 stored）。屬文件小疵，不修，→ §2 D-a 一併裁。
- **client 相容**：`ConsentResult` 型別未宣告 `casesDeleted`（`src/api.ts:81-86`）、`deleteCloudEntries` 回傳型別仍 `{deleted:number}`（`:158-166`）——additive 欄位被靜默忽略，無破壞；store 行為不變。

### N2 單筆刪除後 analysis 暫時過期 → **已修復**（server 行為已測；可見體驗僅程式碼層）

`DELETE /api/entries/:clientId` 交易內新增 `DELETE FROM analyses WHERE device_id=?`（`routes-student.js:344`）。**「無 GenAI 呼叫」由呼叫路徑核實，非由回應 shape 推斷**：該 handler 全路徑（`:327-348`）只有 4 條 SQL DELETE，不經 `refreshDerived`、不觸及 `genai.js` 任何函式；`GET /api/analysis`（`:398-417`）只讀列、缺列回預設 shape，亦不呼叫 GenAI。測試 `routes-student.test.js:424` 釘住：sync 產生的 analyses 列被清、`GET /api/analysis` 回預設空 shape（無過期 evidence）、**且單筆路徑不動 cases**（邊界釘死）。**可見體驗（客戶端回退）屬程式碼層推斷**：`app/index.tsx:37` 收到 `updatedAt:null` → `cloudApproaching=null` → 主頁提示回退本機 `shouldOfferSupport` 規則（`:81` 附近，v3 已核）；執行期未驗證。下次 sync 經 `refreshDerived` 重算（既有路徑）。

### N3 文件測試計數 → **部分修復**（client 29 已同步；server 89 因 lane 順序再次滯後，現行 91）

- docs-N lane 的修復本身正確且自我糾錯（先誤 31、以 runner 修正為 29；`change-track/fix-n3-final.md`）。本輪以 runner 獨立核實現行值：**client 29（exit 0）／server 91（exit 0）**。
- **README.md:123** client `29 tests` ✓ 與現行一致；**README.md:124** server `89 tests` ✗ 滯後（現行 91）。
- **Questionnaire** L55（Q13 `client 29 … server 89`）、L63（Q15 `29 client and 89 server`）、L79（Q19 `29 client tests, 89 server tests`）——server 數字三處 ✗ 滯後。
- **滯後原因（修改順序）**：docs-N lane 在 server-N lane 完工**之前**測得 server 89 並定稿（其時 89 屬正確）；server-N lane 之後 89→91（+2 測試）。即 v3 指出的「lane 完工前定稿文件」結構性問題再次發生。**依指示本次不修文件**，列 §2 D-d 交委託人裁決流程規則。

### N4 worker 訊息無 server 端長度上限 → **已修復**

- worker 訊息**唯一寫入點**：`routes-worker.js:255-257`（respond；全 server src grep `INSERT INTO messages` 僅此與學生端兩處，seed/sweeper 無訊息寫入），現截斷至 `MAX_WORKER_MESSAGE_CHARS = 1000`（`:23`、`:257`）。測試 `routes-worker.test.js:357`（1200→回應與 **DB 皆** 1000）。
- student 訊息唯一寫入點：`routes-student.js:590`（`MAX_MESSAGE_CHARS = 500`，`:34`）；客戶端本地先截 500（`src/store.tsx:443`）。
- 文件一致：CONTRACT.md respond 段 `:143-144`（≤1000，並註明 student 500）、`:223`（≤500）；README/Questionnaire 無與此衝突的陳述。
- 小觀察（非缺口）：worker-web 輸入框無 `maxlength`（`CaseDetail.jsx` grep 無匹配），超出 1000 由 server 靜默截斷、worker 無提示 → §2 D-e。

**文件殘留掃描**（任務點 2 要求）：以多組 phrasing 掃 README／Questionnaire／privacy.tsx／settings.tsx／CONTRACT／VERIFY／worker-web src，**無任何文件仍聲稱 cases 不受刪除影響**（0 匹配；CONTRACT「Planned」段的舊 pending 註記亦已移除，VERIFY.md:64 步驟 21 已加註 N1 更新）。

## 2. 殘留邊界與需委託人裁決（不自行擴張或修復）

| # | 事項 | 性質 | 建議裁決選項 |
| --- | --- | --- | --- |
| D-a | 撤回後 `main_concerns`/`recent_change`/`topics`/`language` 仍 at-rest 留存（worker 不可讀）；CONTRACT.md:248「or stored」表述過度 | **需裁決** | ① 接受現狀（指定的 excerpts/messages 範圍已清，修正 CONTRACT 措辭即可）；② 擴大撤回清空範圍至 summary 欄位（server lane 示明為一行 UPDATE，但屬未批准範圍） |
| D-b | 歷史 withdrawn 個案（修復前）仍帶舊 excerpts/messages；無遷移 | **需裁決** | ① 接受「不可讀但留存」；② 要求一次性遷移腳本（另開工程範圍） |
| D-c | consent-off purge 現在連同刪除裝置**全部**個案（含進行中）：學生端本地個案狀態**未對帳**——`refreshCaseFromServer` 收到 `case:null` 直接 return、保留舊態（`src/store.tsx:357`），UI 可能殘留幻影個案直至本地清除；worker 端對被 purge 個案得 404，CaseDetail 一律顯示「student has withdrawn」（purge≠withdraw，文案不準確）；settings/privacy 文案只說「deletes every cloud copy of your notes」，未提分享中個案也會被刪 | 邊界觀察（修復使舊缺口顯性化，非新引入缺陷） | ① 接受為演示級並如實記錄；② 列 client 改善（對帳邏輯／worker 文案／開關文案補述個案刪除） |
| D-d | 文件 server 計數 89→91 再次滯後（lane 順序結構性問題） | **需裁決（流程）** | ① 本次接受滯後；② 訂「完工定義含文件計數同步」或「server lane 先於 docs lane」規則；本補篇不修文件 |
| D-e | worker-web 輸入無 maxlength，超 1000 字 server 靜默截斷無提示 | 邊界觀察 | ① 接受；② 加 UI 提示／前端同步截斷 |

## 3. v3 受影響部分的 delta（明確由 v3.1 取代之處）

**取代（v3 相應文字作廢，以本節為準）**：
- **v3 §7 N1–N4 狀態**：由「待委託人確認的新問題」改為本補篇 §1 裁定（N1/N2/N4 已修復、N3 部分修復）＋§2 殘留決策 D-a–D-e。
- **v3 §2 J3**：單筆刪除的連帶範圍改為「links＋當日日摘要快取＋**analyses 列**」。
- **v3 §2 J6 撤回語義**：撤回改為「**內容層刪除**（excerpts 清空＋對話刪除，同交易）＋狀態層關閉（worker 404/409）」；個案列保留、summary 欄位留存（D-a）。
- **v3 §2 J7／§3 H3**：關閉同意 purge 與 Delete everything 的刪除範圍擴大為「**entries 級＋cases＋messages**」，回應新增 `casesDeleted`；H3 殘留邊界由「個案內容不隨 purge 刪除（pending）」改寫為 §2 D-a/D-b/D-c。
- **v3 §3 H6**：維持（404/409 不變）；新增「新撤回個案的內容已 at-rest 刪除」。
- **v3 §4 任務卡 UA-U 新增步驟⑩**：預期**改寫**——關閉雲端開關後核對 server 端 entries 級資料**與個案（含對話）全部清空**、回應含 `casesDeleted`；**刪去「個案不受影響」預期**；新增「單筆刪除後 `GET /api/analysis` 回預設空 shape」與「撤回後 DB 層 excerpts='[]'/messages=0（操作者協助核對）」；UA-W1 增加「purge 後個案從列表消失、直訪 404（文案現一律為 withdrawn，如實記錄）」；訊息上限情境改為 student 500／worker 1000 雙側核對。
- **測試規模**：v3「server 89／client 30」更正為 **server 91／client 29**（client 數字 v3 靜態點算含 `.test(` 誤計 1，runner 為準＝29；docs-N lane 點算陷阱說明成立）。

**不變**：v3 卷首九項裁定、§1 邊界（除測試數）、§2 其餘旅程、§3 H1/H2/H4/H5、§5 Persona 卡、§6 路由表、§8 審批欄格式。

**Persona 卡**：**無需變更**。三卡知識邊界僅載產品基本使用資訊，未承諾任何刪除語義細節；N1–N4 修復使產品行為與 UI 文案更一致（P-2 的「開關文案 vs 實際效果」試探現在無矛盾可發現），卡片內容不受影響。

**模型路由**：**仍適用，無需調整**。本輪 Agent 1 同為 kimi-k3（xhigh）；v3 §6 全部建議（含 3 個探索型 agents 的 Pro）不受 N1–N4 修復影響。

## 4. 已測／僅靜態／未測

- **已測（本輪親跑）**：server `npm test` 91/91 exit 0；client `npm test` 29/29 exit 0（皆既有 in-memory/合成測試，無外部呼叫）。
- **僅靜態（程式碼/文件核實）**：N1a/N1b/N2/N4 全部行為裁定與行號證據；「N2 無 GenAI 呼叫」（呼叫路徑）；client 對 `casesDeleted` 的 additive 忽略；主頁 analysis 回退路徑；文件殘留掃描；CONTRACT:248 過度表述。
- **未測**：任何執行期端到端行為（app/server/worker-web 實跑）；dev DB 存量（含歷史 withdrawn 個案，D-b）；worker-web 對 purge 的實際渲染；客戶端幻影個案的實際呈現（D-c）；GenAI 真實品質（同 v3）；D-a–D-e 所涉行為的 UI 層驗證。

## 5. 是否需要新版完整報告＋Gate 1 建議

**不需要**以 v4 完整報告取代：N1–N4 屬局部修復，v3 其餘章節全部有效，§3 的 delta 清單已完整承載差異（逐條標明取代關係）。建議：**v3＋v3.1 補篇合併作為 Gate 1 呈交文本**；若委託人希望單一基線文件，可在確認後由 Agent 1 出 v4 合併版（不越過關卡）。**未獲委託人確認前，不啟動 Agent 2、驗證型／探索型 agents 或圓桌。**

---

## 附：主 agent 可原樣呈交的簡短摘要

> **v3.1 核實補篇已完成**（Agent 1，靜態＋單元測試，未 commit 任何改動）。
> 裁定：**N1 已修復**（撤回同交易清 excerpts＋刪對話、列保留；purge 三入口現含 cases＋messages，回應新增 `casesDeleted`——但撤回後 main_concerns/recent_change/topics 仍留存、歷史 withdrawn 未遷移，**不得稱全刪**；CONTRACT:248「or stored」措辭過度）；**N2 已修復**（單筆刪除連帶清 analyses，「無 GenAI 呼叫」經呼叫路徑核實，測試釘住預設 shape；客戶端回退僅程式碼層）；**N3 部分修復**（client 29 已同步；server 因 docs lane 先於 server lane 完工，文件 89 對現行 91 再次滯後，依指示未修文件）；**N4 已修復**（worker 唯一寫入點截 1000、student 500，測試與 CONTRACT 一致）。
> 本輪親跑：server **91/91 exit 0**、client **29/29 exit 0**（僅既有 in-memory/合成測試，無外部呼叫）。
> 新增 5 項殘留決策（D-a 撤回留存欄位、D-b 歷史遷移、D-c purge 後雙端體驗縫隙、D-d 文件同步流程、D-e worker-web 無截斷提示）。Persona 卡與模型路由**無需變更**；v3 其餘部分維持有效，delta 已逐條標明取代關係。**建議 v3＋v3.1 合併呈交 Gate 1**；確認前不啟動任何後續 agent。

**檔案路徑**：本補篇＝`/Users/luo/MmM/unfold/workbuddy/test-runs/run-002/journey-report-v3.1-addendum.md`（唯一新增檔）。
**證據限制**：除上述兩次 `npm test` 外全部為靜態核實；dev DB、執行期 UI、GenAI 品質未測；工程 lane 結論（fix-n124/fix-n3）均經本輪獨立 diff/測試/文件核實，未預設為真。

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "僅新增補篇 1 檔（journey-report-v3.1-addendum.md）；未 commit/stage/rollback；未修改產品碼、既有報告、gate-log 或設定；未派子代理"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "N1–N4 逐項裁定附 path:line（routes-student.js:521/523/344/319/590、purge.js:30/32/37、devices.js:73-77、routes-worker.js:23/257、db.js:81-85、CONTRACT.md:143/223/248、store.tsx:357/443、api.ts:81-86）；親跑 server 91/91 exit 0、client 29/29 exit 0；文件滯後三處（README:124、Questionnaire L55/L63/L79）"
    }
  ],
  "changedFiles": [
    "workbuddy/test-runs/run-002/journey-report-v3.1-addendum.md",
    "workbuddy/test-runs/run-002/agent1-v3-final-message.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "cd unfold/server && npm test",
      "result": "passed",
      "summary": "tests 91 / pass 91 / fail 0，SERVER_EXIT=0（in-memory，無外部呼叫）"
    },
    {
      "command": "cd unfold && npm test",
      "result": "passed",
      "summary": "tests 29 / pass 29 / fail 0，CLIENT_EXIT=0（fetch 全 mock）"
    },
    {
      "command": "git diff d90c2f1 -- <12 modified files>；grep 行號與殘留掃描（多組 phrasing）",
      "result": "passed",
      "summary": "取得 N1–N4 全部行號級證據；文件無『cases 不受刪除影響』殘留（0 匹配）；CONTRACT:248 措辭過度已定位"
    },
    {
      "command": "env | grep -iE 'moonshot|elevenlabs|api_key'",
      "result": "passed",
      "summary": "shell 無 MOONSHOT_API_KEY；genai.js:24 空 key 在 fetch 前 throw，測試無外部呼叫風險"
    }
  ],
  "validationOutput": [
    "N1：withdraw 交易清 excerpts+messages（列保留，main_concerns/recent_change/topics/language 留存）；purge 含 cases/messages，casesDeleted additive；歷史 withdrawn 未遷移",
    "N2：單筆刪除清 analyses；『無 GenAI 呼叫』經 handler 呼叫路徑核實（4 條 SQL、不經 genai.js）；測試釘住預設 shape 與不動 cases",
    "N3：runner 現行 client 29/server 91；文件 server 89 三處滯後（lane 順序），未修",
    "N4：worker 唯一寫入點截 1000（回應與 DB 皆截，有測試）；student 500；CONTRACT 兩段一致",
    "server npm test 91/91 exit 0；client npm test 29/29 exit 0"
  ],
  "residualRisks": [
    "D-a：撤回後 main_concerns/recent_change/topics/language 仍 at-rest 留存；CONTRACT:248『or stored』過度表述（待委託人裁決，未修）",
    "D-b：修復前歷史 withdrawn 個案內容未遷移（dev DB 未讀，存量不明）",
    "D-c：consent-off purge 連刪進行中個案後，學生端本地狀態未對帳（幻影個案風險）、worker 端 404 文案一律顯示 withdrawn、開關文案未提個案刪除",
    "D-d：文件 server 計數 89→91 滯後（結構性順序問題，依指示未修）",
    "D-e：worker-web 輸入無 maxlength，超 1000 字 server 靜默截斷",
    "除兩次 npm test 外全部結論屬靜態核實；執行期 UI/dev DB/GenAI 品質未測"
  ],
  "noStagedFiles": true,
  "diffSummary": "新增 journey-report-v3.1-addendum.md（N1–N4 裁定＋D-a–D-e 殘留決策＋v3 delta 取代清單＋已測/靜態/未測＋Gate 1 建議＋呈交摘要）；重寫 agent1-v3-final-message.md 為 v3.1 最終訊息",
  "reviewFindings": [
    "no blockers"
  ],
  "manualNotes": "本輪為核實補篇，非 Gate 1 批准；HEAD=d90c2f1＋未提交 worktree 修復。工程 lane 結論均經獨立 diff/測試核實。未獲委託人確認前不啟動 Agent2/驗證型/探索型/圓桌。"
}
```
