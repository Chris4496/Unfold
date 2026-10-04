# Unfold 旅程分析報告 v2（待委託人確認）

> 本報告由 Agent 1（旅程分析）依 software-journey-evaluator 技能契約產出，為 v1 之後的**核實重評**。背景：委託人主張「已增加 v1 發現的十個缺失功能」。依技能規則，委託人主張僅屬「文件主張」，本報告已**逐項回到程式碼核實**。本輪仍為**靜態唯讀分析**：未執行 app／server／測試、未連網、未讀取任何 `.env*`（含 `.env.example`）。「已實作」一律指「程式碼層面可觀察」，不等同已通過執行期驗證；「已實作並可觀察」的 GenAI 功能，其**真實 GenAI 輸出品質**在無金鑰、不連網的限制下仍屬「無法測試」。
>
> **版本備註**：分析進行期間，工作目錄中的未提交改動被委託人提交為 `598dcce feat: add WorkBuddy student/worker platform (server, worker-web, client API)`（2026-10-04 00:23）。本報告讀取的全部檔案內容與該提交一致，分析不受影響；行號以該提交後的工作目錄為準。

---

## v1→v2 變更摘要（十項核實清單裁定表）

裁定四態：**已實作並可觀察**（程式碼層面）／**部分實作**／**未實作**／**未知**。統計：**已實作 9／部分 1／未實作 0／未知 0**。

| # | v1 缺口 | v2 裁定 | 程式碼證據 | 關鍵附註 |
| --- | --- | --- | --- | --- |
| 1 | GenAI 主題分類 | **已實作並可觀察** | `server/src/genai.js:268`（`classifyEntry`，kimi-k3＋確定性 fallback）；接入 `server/src/routes-student.js:190`（`POST /api/entries/sync`，新/改記錄逐條分類並回寫 `genai` 旗標）；客戶端 `src/store.tsx:160`（`syncEntryToCloud` 合併分類回本機 entry） | 真 GenAI 需 `MOONSHOT_API_KEY`；無 key 走關鍵字 fallback 且 `genai:false` 揭露。**品質無法測試**；分類結果依設計不在學生介面展示 |
| 2 | 跨記錄語意聯結 | **部分實作** | `server/src/genai.js:352`（`linkEntries`）；`server/src/routes-student.js:148`（`refreshDerived` 重算近 50 條連結）、`:279`（`GET /api/entries` 回傳 links）；`server/src/db.js` links 表 | **無任何客戶端消費**：Expo 端無 `GET /api/entries` 呼叫（`src/api.ts` 無此函式，全倉 grep 證實），worker-web 亦無展示。計算、儲存、API 可取＝已實作；使用者可觀察＝未實作 |
| 3 | GenAI 自然語言問答（/ask） | **已實作並可觀察** | `server/src/routes-student.js:325`（`POST /api/ask`）；`genai.js:653`（逐字引用驗證，非逐字即丟棄）；客戶端 `src/api.ts:251`（`askWithFallback`）＋ `app/ask.tsx`（雲端/本機來源標籤） | 雲端路徑僅在雲端整理開啟時使用；無 key／離線自動回退本機關鍵字搜尋並如實標示。**品質無法測試** |
| 4 | AI 確認／鼓勵文案（saved 頁） | **已實作並可觀察** | `server/src/routes-student.js:351`（`POST /api/respond`）；`genai.js:468`（三類 kind；連續兩次 invite-elaboration 被硬規則禁止）；`app/saved.tsx`（顯示 brief 並標 AI／非 AI；離線保留靜態文案） | 僅雲端整理開啟時出現；`recentResponseKinds` 存於本機（`src/store.tsx:206`）。**文案品質無法測試** |
| 5 | GenAI 每日摘要 | **已實作並可觀察** | `server/src/routes-student.js:297`（`GET /api/summaries/:day`，讀寫快取）；`genai.js:396`；`app/day/[date].tsx`（`daySummaryWithFallback`＋來源標籤） | 有記錄變更時相關日快取會被清除重算（`refreshDerived`）。**摘要品質無法測試** |
| 6 | GenAI 背景分析與提示閾值 | **已實作並可觀察** | `genai.js:541`（`analyseBackground`；`approaching` 必須附引用記錄否則強制 false）；同步時重算（`routes-student.js:148`）；`GET /api/analysis`（`:370`）；主頁 `app/index.tsx`（雲端結果優先、本機規則回退，snooze/未結個案閘門仍生效）；`app/prompt.tsx`（展示解釋＋來源標籤） | **附註**：`genai.js:757` 的 `caseSummary` 有實作與測試但**未接任何路由**（grep 全 server 證實）；個案摘要草稿仍是本機關鍵字規則（`src/lib/organise.ts` `buildDraft` ← `app/prepare.tsx`）。VERIFY.md 的 fallback 矩陣將 caseSummary 列為線上功能，屬文件主張與程式碼不符 |
| 7 | 雲端整理授權與資料流 | **已實作並可觀察** | `server/src/routes/devices.js:32`（註冊，installId 雜湊幂等）、`:56`（獨立 `cloudOrg` 同意）；同步閘門 `routes-student.js:196`（`403 cloud_org_not_enabled`）；`app/settings.tsx`（獨立開關＋失敗提示）；`src/api.ts:218`（`toSyncPayload` 只送去標識文字，`api.test.ts` 斷言無 transcript/audio/姓名）；金鑰僅在 server（`server/src/config.js`） | **缺口**（詳 §6）：關閉同意與 Delete everything 均**不刪除已上雲資料**，且無任何刪除 API；server 信任客戶端去標識結果，不做二次去標識——中文識別資訊缺口（見 §1 風險 5）影響範圍由本機擴大到雲端 |
| 8 | 社工按專長／語言／工作量選案 | **已實作並可觀察** | `server/src/routes-worker.js:119`（`GET /api/worker/queue`：語言 ∈ 社工語言 ∧（expertise 含 general ∨ 與個案 topics 相交）∧ 低於容量，最久等待優先）；`worker-web/src/pages/Queue.jsx`（匹配隊列＋Claim）、`Profile.jsx`／`Register.jsx`（語言/專長/容量設定）；測試 `routes-worker.test.js:161,185,194` | 個案 language/topics 由客戶端推斷上報（`src/api.ts:229` CJK 啟發式、`:235` 本機關鍵字 topics 聯集）——匹配輸入的品質依賴本機規則 |
| 9 | 社工身份驗證與權限控管 | **已實作並可觀察** | `server/src/routes/workers.js:40`（註冊，bcrypt，預設 `verified=0`）、`:64`（登入發 JWT 7 日）；`server/src/auth.js:42,68`（`requireWorker`／`requireVerifiedWorker`，未驗證 403 `not_verified`）；`routes-worker.js:209`（`403 not_your_case`，個案負載永不含 `device_id`，有測試）；`worker-web/src/App.jsx`（`RequireAuth`／`RequireVerified`＋VerificationPending 頁） | **附註**：「驗證發放」是帶外人工動作（CONTRACT.md 明載），無管理員介面/API——該環節**無法測試**；`JWT_SECRET` 預設 dev 值、CORS 全開（VERIFY.md 自認）屬部署風險 |
| 10 | 無人接案／超時機制 | **已實作並可觀察** | `server/src/sweeper.js:17`（`runSweeper`：`claimed` 逾 `RESPONSE_TIMEOUT_HOURS`（預設 48h）未回應 → 自動 `rematch`、清空 claimed_by、`claim_count++`，每 60s 執行）；`:44`（`isWaiting`：`queued/rematch` 逾 `UNCLAIMED_TIMEOUT_HOURS`（預設 72h）→ 讀時等待旗標）；學生端 `app/case.tsx`（「No social worker has taken the case yet — keep waiting or withdraw.」）；社工端 `Queue.jsx` WaitingBadge；測試 `sweeper.test.js` 6 項＋`routes-worker.test.js:359` | 無人接案的個案**永久留隊**（僅向學生揭露，無升級／通知／機構介入）——CONTRACT.md 明載為設計；長時間執行期行為未驗證 |

**全域附註**：① 第 1–6 項的「已實作」指 GenAI 程式碼路徑存在且有確定性 fallback；**真實 GenAI 是否啟用**取決於 server 環境的 `MOONSHOT_API_KEY`（`server/.env` 存在於工作目錄且已 gitignore，依限制未讀取，配置狀態**未知**）；**輸出品質**需連網與金鑰，本輪**無法測試**。② 委託方的 `server/VERIFY.md` 主張已執行端到端驗證（server 77 測試、app 20 測試通過、21 步 curl 流程）——屬**文件主張**；本報告靜態點算測試數與其一致（server 77、app 20），並以唯讀方式核實開發資料庫處於其所述 clean seed 狀態（2 名種子社工、0 個案/記錄），但測試「通過」本身未獲本輪執行核實。

---

## 1. 評估邊界

**產品版本**
- 三個套件（git 提交 `598dcce`，2026-10-04）：
  - `unfold/`：Expo 學生端 v1.0.0（SDK ~57，iOS／Android／Web），經 `src/api.ts` 與後端通訊；預設 API 位址 `http://localhost:8787`（`EXPO_PUBLIC_API_URL` 可覆寫）。
  - `unfold/server/`：新增 Node ≥20／Express 4／better-sqlite3 後端，所有 GenAI 呼叫僅在 server 端（Moonshot `kimi-k3`，OpenAI 相容端點），金鑰只存 server 環境。
  - `unfold/worker-web/`：新增 Vite／React 18 社工主控台（獨立客戶端，`/api` 代理至 server），已含 `dist/` 建置產物。
- **刪除**：`unfold/app/worker/index.tsx`、`unfold/app/worker/[id].tsx`——v1 的同機社工模擬介面已移除，由 worker-web 取代（`src/components/ui.tsx` 的 `/worker` 路由型別同步移除）。

**資料來源**
- 需求主張（文件）：根 `README.md`、`docs/Project_Proposal.md`、`docs/Interim_Progress_Report_Questionnaire.md`（新增）、`unfold/server/CONTRACT.md`、`unfold/server/VERIFY.md`。**文件落差警示**：`docs/Interim_Progress_Report.md` 及 v1 引用的 `Interim_Progress_Report_zh.md` 已刪除；新 Questionnaire 的 Q5/Q13 仍寫「社工端同機模擬」「12 個單元測試」，Q14/Q15 仍將「GenAI 分類、中文去標識」列為**未來工作**——文件明顯滯後於程式碼；根 `README.md` 亦未提及 server／worker-web。`.workbuddy-ai/` 經查證為本評估技能自身的副本，不含產品設計筆記。
- 實作證據（逐一開啟閱讀）：server 全部原始碼（`index.js`、`config.js`、`db.js`、`auth.js`、`genai.js`、`routes-student.js`、`routes-worker.js`、`routes/workers.js`、`routes/devices.js`、`sweeper.js`、`seed.js`）與 6 個測試檔；worker-web 全部原始碼（`App.jsx`、`auth.jsx`、`api.js`、5 個頁面、2 個元件、vite 設定）；Expo 端全部路由畫面（含未變更的 `onboarding`／`write`／`prepare`／`diary`／`privacy`）與 `src/`（`api.ts`、`store.tsx`、`types.ts`、`lib/*`）；5 個 app 測試檔（deidentify 3、organise 3、pcm 5、support 1、api 8，共 20 個 `test()`）。
- 唯讀核實：`server/unfold.db`（immutable 模式）確認為 clean seed 狀態；**未讀取** `server/.env`。

**可操作環境（下階段需求）**
- 端到端模擬需要：啟動 server（本地埠）、Expo dev server、worker-web（vite preview 或 dev），三者同機不同埠即可構成**真實跨程序、跨介面**交接（實體跨裝置非必要）；一支受限 `MOONSHOT_API_KEY`（GenAI 路徑）與一支受限 ElevenLabs 金鑰（轉寫路徑），均由委託人提供、本團隊不讀取 `.env*`；合成輸入。種子帳號：`demo.worker@unfold.local`（已驗證）／`new.worker@unfold.local`（未驗證），密碼 `demo1234`（`server/src/seed.js`，本地演示用途）。

**不可測範圍（本輪及下階段先天限制）**
1. **所有 GenAI 功能的真實模型品質**（分類、連結、摘要、問答、簡短回應、背景分析）：需金鑰＋連網；fallback 路徑可離線測，但 fallback 品質不等於 GenAI 品質。
2. **真實執行期行為**：本輪未啟動任何程序；跨客戶端交接、15 秒輪詢、sweeper 長時間運行均只有程式碼與單元測試證據。
3. **社工「驗證發放」流程**：帶外人工動作，無產品表面，無法測試。
4. **雲端資料刪除**：無功能（關閉同意／Delete everything／撤回均不刪除 server 已存資料），無法測試。
5. **本機 demo 模式的完整個案迴路**：雲端關閉時個案只存本機且**已無任何回覆模擬入口**（v1 的同機社工介面已刪），demo 個案永遠停在等待態——demo 模式下 J6 的回覆後三分支無法走通。
6. 粵語／英文轉寫準確率（同 v1）；提示閾值臨床適切性（同 v1，非臨床判斷）；真機麥克風與權限行為（同 v1）。

**敏感風險（v2 更新）**
1. **ElevenLabs 金鑰內嵌**（未變）：`EXPO_PUBLIC_ELEVENLABS_API_KEY` 仍打包進客戶端（`src/transcribeAudio.ts` 未變更），README 自述已知；正式發佈前阻塞項。註：Moonshot 金鑰已正確置於 server 端，未見外洩路徑（VERIFY.md key-safety grep 與本輪抽核一致）。
2. **未成年人**（未變）：實作仍無年齡區分、無監護人同意；Questionnaire Q8 文件主張兩群需「不同的同意與保障安排」——未實作。測試一律合成輸入。
3. **心理支援主題**（未變）：不產生診斷、分流或臨床結論。
4. **去標識化缺口升級**：`src/lib/deidentify.ts` **未變更**（仍僅英文格式正則，無中文姓名／地址覆蓋）。v1 時洩漏僅留本機；v2 雲端整理開啟後，未去標識的中文識別資訊**會隨同步進入 server 資料庫**（server 不做二次去標識，`routes-student.js:190` 直接儲存客戶端送來的 `deidentified`）——風險半徑擴大，合成測試含中文識別資訊時預期**上雲洩漏**，應如實記錄為產品缺口。
5. **撤回後可見性缺口（新發現）**：`GET /api/worker/cases/:id` 僅檢查 `claimed_by = me`，**不檢查狀態**（`routes-worker.js:209-219`）——學生撤回後，已接案社工仍可經 API 直讀個案全文摘錄與訊息（VERIFY.md 步驟 21 同樣記錄此行為）。隊列與「我的個案」列表會消失，但直接存取未被截斷。屬設計抉擇還是缺陷，需委託人裁定（§6 問題 9）。
6. **部署預設值（新）**：`JWT_SECRET` 預設 `'dev-only-secret-change-me'`（`server/src/config.js:10`）；CORS 全開 `*`（`server/src/index.js:21`，VERIFY.md 自認）；worker JWT 與裝置 token 均無輪換機制，裝置 token 永不過期且持久存於本機 AsyncStorage（`unfold.v1`）。
7. **本地資料未加密**（未變）：全部狀態（含完整文字稿、音頻路徑、裝置 token）JSON 存於 AsyncStorage。
8. **`server/.env` 存在於工作目錄**（已 gitignore，未讀）：可能含真實金鑰；提醒委託人確認其額度與用途，測試一律使用獨立受限金鑰與獨立 DB。

---

## 2. 流程圖及狀態

三態標記：**【文件】**＝僅文件主張；**【實作】**＝程式碼可觀察（未執行驗證）；**【未知】**＝無法確認。
架構總覽：**雲端整理關閉（預設）**＝純本機（v1 行為，但社工介面已移除）；**雲端整理開啟**＝Expo 學生端 ⇄ Express/SQLite server（裝置 token 認證）⇄ worker-web 社工端（JWT 認證）——跨裝置交接由 v1 的「同機模擬」變為**真實後端中介**。

### 學生端（Expo app）

**J1 首次啟動與資料處理同意**（未變）
起點：首次開啟 →【實作】`index.tsx` 檢查 `onboarded` →【實作】`onboarding.tsx` 三步（自由記錄／ElevenLabs 轉寫與本機儲存／批准才分享）→ 第 3 步勾選閘門【實作】→ 終點：回主頁。
對照與落差：Project_Proposal 主張「首次使用了解資料儲存、**雲端整理**與背景分析後確認設定」【文件】；實作的 onboarding **未提雲端整理**，該同意改為設定頁獨立開關、預設關閉【實作，與文件不同但屬更保守的折衷】。仍無「拒絕並退出」分支【未知】。

**J2 自由記錄 → 轉寫 → 儲存（＋可選雲端同步與 AI 簡短回應）**
主鏈同 v1【實作】（錄音 → `transcribeRecording` ElevenLabs → opencc 簡轉繁 → 編輯 → `addEntry` 去標識＋本機關鍵字標註 → 存 AsyncStorage）。新增分支：① 儲存後若 `cloudOrg && deviceToken` →【實作】`syncEntryToCloud`（`store.tsx:160`）**只送去標識文字**（`api.ts:218`）至 `POST /api/entries/sync`；server 端 GenAI/fallback 分類後回寫 topics/attributes/uncertainty/`genai` 旗標至本機 entry；失敗靜默保留本機規則【實作】。② `/saved` 頁若雲端開啟 →【實作】`respondWithFallback` → `POST /api/respond` 取得一則簡短回應（acknowledgement／encouragement／invite-elaboration），顯示並標「(AI)／(not AI)」；離線或失敗顯示原靜態文案，儲存不被阻擋【實作】。「不反覆追問」由 server 硬規則保證不連續兩次邀請補充【實作】。
例外／取消：同 v1（mic 拒絕→打字；空轉寫；轉寫失敗；轉寫中離開【未知】；錄音後不儲存【未知】）。

**J3 月曆回顧與刪除（日摘要可來自雲端）**
主鏈同 v1【實作】。新增：`/day/[date]` 的日摘要在雲端開啟時優先取 `GET /api/summaries/:day`（server 快取，無快取即時生成並寫回），顯示來源標籤「Cloud summary (AI)／(server rules — not AI)／On-device summary」【實作】；記錄變更後 server 會作廢相關日快取【實作】。月曆不顯示心理標籤【實作，與文件一致】。刪除仍為本機兩步確認【實作】；**已同步到 server 的副本不被刪除**【實作缺口，見 §1 風險 4／§6 問題 10】。

**J4 Ask your diary 查詢（雲端 NL Q&A＋本機回退）**
起點同 v1 →【實作】`ask.tsx`：雲端開啟時送 `POST /api/ask`（server 對近 50 條**去標識**記錄做 NL 問答，引用須逐字出自所引記錄，多來源按日期升冪）；失敗自動回退本機關鍵字搜尋；雲端關閉時直接本機搜尋 → 來源標籤「Cloud answer (AI)／(server rules — not AI)／On-device search」【實作】→ 命中可跳回 `/day/[date]`【實作】。
對照：「答案只來自本人記錄、找不到要明說」【實作，server prompt 與驗證雙重約束】；「GenAI 自然語言理解」【已實作程式碼；品質無法測試】。

**J5 支援提示 → 準備 → 預覽 → 批准（雲端背景分析驅動；產出遠端或本機個案）**
起點（判斷）：雲端開啟時，主頁以 `GET /api/analysis` 的 `approaching` 為準（server 於每次同步後對近 50 條重算背景分析；保守驗證：無引用證據不得為 true）；取不到時回退本機 `shouldOfferSupport` 規則；snooze 與無未結個案閘門兩者皆生效【實作；程式碼與 UI 均註明非臨床判斷】→ 主頁 Notice 同 v1 → 分支 A「Not now」snooze（條數＋2）【實作】；分支 B「See options」→ `/prompt` 顯示 server 解釋（或本機模板）＋來源標籤＋「not a clinical judgement」【實作】→「Prepare summary」→【實作】`/prepare` 觸發 `prepareDraft()`——**仍是本機 `buildDraft` 關鍵字規則**（server 的 `caseSummary` GenAI 函式未接路由，見變更摘要 #6）→ `/review` 兩句可編輯＋TokenRow＋可展開摘錄【實作】→「Approve sharing」→【實作】`approveSharing()`：雲端開啟時 `POST /api/cases`（含 mainConcerns、recentChange、period、去標識摘錄、topics、推斷語言）成功則建**遠端個案**（`remote:true`）；雲端關閉或 server 不可達則建**本機 demo 個案** → 終點 `/shared`（文案依 remote 與否區分：「A verified social worker can now pick up the summary」vs「Demo mode…no real social worker will reply」）【實作】。
例外：review 頁「Not now」→ draft 保留【實作】。

**J6 分享後：等待 → 回覆 → 繼續／換人／撤回（真實跨端或本機 demo）**
遠端個案：【實作】`/case` 每 15 秒 `refreshCaseFromServer()` 輪詢 `GET /api/cases/active`＋訊息；狀態機與 server 對齊（queued/claimed/replied/continued/rematch/withdrawn）。新增：① `claimed` 態顯示「A social worker is reading your summary」；② `waitingNoWorker`（queued/rematch 逾 72h）顯示「No social worker has taken the case yet — keep waiting or withdraw.」【實作】。回覆到達 → 主頁 Notice【實作】→ 三分支：continue（→`POST /continue`，雙向訊息，本機 ≤500 字／server ≤1000 字——**上限不一致**【實作小落差】）、rematch（→`POST /rematch`，回隊列、`claim_count++`）、withdraw（→`POST /withdraw`）【實作】。
本機 demo 個案：`/case` 顯示 Demo mode Notice，**無任何回覆入口**（v1 的同機社工介面已刪除）——demo 個案永遠等不到回覆，replied 後三分支在 demo 模式走不通【實作缺口】；撤回可用。
撤回語義：撤回後 server 個案狀態轉 `withdrawn`，從隊列與雙方列表消失，但**已接案社工仍可經 API 直讀**【實作缺口，§1 風險 5】；學生端「新記錄是否併入個案」【文件自認未定；實作：不併入】。

**J7 設定：雲端整理開關、樣本、刪除**
【實作】`/settings` 新增「Cloud organisation」獨立開關：文案明示「only the de-identified text…full transcripts and audio never leave this phone」、與 ElevenLabs 轉寫及分享批准三者各自獨立；開關經 `PUT /api/devices/me/consent` 落到 server（首次開啟會先懒註冊裝置取 token）；server 不可達時開關不變更並顯示錯誤【實作】。「Load a sample week」「Delete everything」同 v1【實作】；**Delete everything 只清本機**，不動 server 已同步資料（也無 API 可動）【實作缺口】。
注意：隱私頁（`privacy.tsx`）未提及雲端整理資料流——三層說明仍是「本機／本機去標識／批准才分享」，與設定頁的雲端說明存在**文案覆蓋落差**【實作觀察】。

### 系統（server，非人類角色）

**S1 同步後衍生計算**：`POST /api/entries/sync` 對新/改記錄逐條分類（GenAI/fallback）→ 重算近 50 條的跨記錄連結（整批刪除重建）→ 重算背景分析 → 作廢相關日日摘要快取【實作 `routes-student.js:148`】。GenAI 失敗／無 key 自動 fallback 且 `genai:0`【實作 `genai.js` `withFallback`]。

**S2 超時清掃**：每 60 秒 `runSweeper`：`claimed` 逾 48h 未回應 → 自動 `rematch`（清空 claimed_by、claim_count++），個案回隊列供他人接案【實作 `sweeper.js:17`】；`queued/rematch` 逾 72h 不接案 → 不改狀態，讀時 `isWaiting` 旗標供學生端揭露【實作 `sweeper.js:44`】。

### 社工端（worker-web，真實獨立客戶端）

**J8 註冊 → 登入 → 待驗證 →（帶外驗證）→ 已驗證**
起點：`/register` 填 email／密碼（≥8）／姓名／機構／語言／專長／容量 →【實作】`POST /api/workers/register` 建**未驗證**帳號（bcrypt 雜湊）→ 自動登入（JWT 7 日，存 localStorage）→【實作】所有個案路由被 `RequireVerified`／server `requireVerifiedWorker` 雙重擋下，顯示 VerificationPending 頁（仍可編輯個人資料）→ **帶外驗證**【文件主張的流程；實作上僅能由操作者直接改 DB 或用種子帳號——無管理員介面/API】→ 已驗證後可進 `/queue`、`/cases`。登入失敗 401、註冊重複 409【實作】。

**J9 隊列（匹配）→ 接案 → 讀個案 → 回覆 → 訊息**
起點：`/queue` →【實作】`GET /api/worker/queue`：僅顯示語言匹配 ∧（專長 general ∨ 與個案 topics 相交）∧ 未達容量的 `queued/rematch` 個案，最久等待優先，顯示等待時數、`rematch ×N` 徽章；達容量時顯示警示且不給 Claim【實作】→「Claim」→【實作】`POST …/claim` 原子條件更新：成功 201／被搶先 409 `already_claimed`／達容量 409 `capacity_reached` → `/cases/:id` 顯示兩句結論、期間、topics、去標識摘錄（逐條摺疊）、時間戳；**負載不含 device_id**，頁面明示原始錄音與全文稿不離開學生裝置【實作】→ 撰寫回覆「Send」（僅 `claimed/continued` 態可送）→【實作】`POST …/respond` 插入 worker 訊息、狀態轉 `replied`、記 `responded_at` → 終點：學生端 J6 接手；`continued` 後可再回覆，訊息串雙向【實作】。
例外：非本人個案 403 `not_your_case`；狀態不符 409 `invalid_status`；未驗證 403【實作】。
可見／不可見：社工可見＝去標識結論＋摘錄＋訊息【實作】；不可見＝全文稿、音頻、裝置身分【實作：程式碼層面成立且較 v1 更強——資料物理上位於不同儲存；但 server 信任客戶端去標識品質，見 §1 風險 4】。

**J10 個人資料與登出**
【實作】`/profile`：檢視驗證狀態；修改語言／專長／容量（`PATCH /api/workers/me`）；登出（清 localStorage token）。註：註冊表單容量上限 20、server 接受 1–100【實作小落差】。

---

## 3. 角色與交接矩陣

產品參與者：**學生**（中學／大學，程式碼仍**無任何區分**）、**社工**（已驗證／未驗證兩態）、**機構管理員**（僅作為帶外流程存在，無產品表面，不列使用者 agent）、**系統**（server 衍生計算與 sweeper，非人類角色）。
交接由 v1 的 **1 條**增至 **5 條**（H1–H5），另列 1 條資料邊界觀察（H6）。

| # | 交接 | 內容與狀態 |
| --- | --- | --- |
| H1 | **學生 →（server）→ 社工：個案摘要提交與接案** | 發起：學生 `/review`「Approve sharing」（前置授權鏈：onboarding 勾選 → 雲端整理獨立開關 → 提示後主動進入 → review 最終批准）【實作】。載體：`POST /api/cases`（去標識結論兩句、期間、摘錄、topics、語言）【實作】。接收：已驗證社工於匹配隊列 Claim【實作（真實後端，跨程序；雲端關閉時無此交接，只有本機 demo）】。接收方可見：去標識內容＋後續訊息【實作】；不可見：全文稿、音頻、device_id【實作（程式碼＋測試）】。失敗恢復：撤回（狀態隱藏，但见 H6）、rematch 回隊列、接案逾時自動回隊列【實作】 |
| H2 | **社工 →（server）→ 學生：回覆與訊息** | `POST …/respond` → 狀態 `replied` → 學生端 15 秒輪詢取得，主頁 Notice＋`seenReply=false`【實作】。反向（學生→社工訊息）：`POST /api/cases/:id/messages`，社工端於個案頁讀取【實作】。送達保證：學生端 fire-and-forget＋下次輪詢對帳【實作；離線期間訊息可能延遲對帳——執行期未驗證】 |
| H3 | **學生 → server：去標識記錄同步（資料交接）** | 授權：獨立 `cloudOrg` 同意，server 端強制（未同意 403）【實作＋測試】。內容：僅去標識文字＋token 種類（`api.test.ts` 斷言不含 transcript/audio/人名）【實作】。撤回授權（關閉開關）：停止未來同步，**不刪除已存資料**【實作缺口】 |
| H4 | **server → 學生：衍生產物回送** | 分類（寫回本機 entry）、日摘要、背景分析、簡短回應、NL 問答，全部附 `genai` 旗標並在 UI 標示來源（AI／server rules／on-device）【實作】。跨記錄連結有 API 但**無客戶端消費**【部分實作】 |
| H5 | **系統（sweeper）→ 隊列：超時自動重配** | 接案 48h 未回應 → 自動 rematch 回隊列，`rematch ×N` 對下一位社工可見【實作】。責任轉移以狀態與計數表達，無通知機制【實作（文件未主張通知）】 |
| H6 | **撤回後的殘留可見性（邊界觀察）** | 撤回後：隊列、雙方列表、學生介面均隱藏【實作】；**已接案社工經 `GET /api/worker/cases/:id` 仍可直讀摘錄與訊息**【實作缺口；VERIFY.md 步驟 21 同載】。另：server 不留撤回後的存取審計（無日誌欄位）【未知是否設計取捨】 |

權限缺口總結（v2 重估）：v1「同機任何人可開社工視圖」的阻斷項**已消除**（JWT＋驗證閘門＋所有權檢查，有測試）【實作】；新晉缺口為 H6（撤回後直讀）、帶外驗證無產品表面、以及去標識品質信任鏈（§1 風險 4）——三者均不屬同機演示限制，而是邁向真實部署前必須裁定的項目。

---

## 4. 使用者 agent 任務卡（N = 4）

角色依產品實際參與者決定：**UA-S 中學生、UA-U 大學生、UA-W1 社工（主接案）、UA-W2 社工（第二人：註冊→待驗證→競爭／接收 rematch）**。v1→v2：UA-W 由「同機模擬」改為「真實獨立客戶端」，並因接案競爭／容量／rematch 需要第二名社工而增至 4 卡。UA-S 與 UA-U 在程式碼上仍**完全無區分**，保護缺口盤點仍是 UA-S 卡的核心產出。

### UA-S｜中學生（合成）
- **角色 ID**：UA-S
- **情境**：首次使用的中學生；關注隱私理解、引導勾選、錄音回退、以及「未成年人保護流程是否存在」與「雲端整理是否預設關閉、是否被清楚告知」的缺口盤點。
- **測試身份與權限**：合成學生（無帳戶，全新安裝）；僅學生端。
- **起始狀態**：全新安裝（`onboarded=false`，無 entries，雲端整理關閉）。
- **目標**：J1→J2（含 mic 失敗回退）→J3→J7；盤點保護與告知缺口。
- **步驟**：① 逐步閱讀 onboarding 並記錄理解，特別記錄「是否提及雲端整理／背景分析」（預期：未提及）；② 勾選閘門驗證；③ mic 拒絕→打字回退；④ 儲存一條英文合成記錄＋一條含虛構中文姓名（如「陳小明」）的合成記錄；⑤ saved 頁選事發時間，記錄是否出現 AI 簡短回應（預設雲端關閉：應無）；⑥ diary/day 查看摘要與非評估聲明；⑦ 進 settings 開啟雲端整理，回述「哪些上雲、哪些留機」，再核對中文姓名記錄在雲端開啟後的去標識結果（預期：中文姓名未被去標識且**會上雲**——記錄為缺口）；⑧ 閱讀 privacy 頁，記錄其未涵蓋雲端資料流的落差。
- **禁止操作**：不輸入真實個資或真實經歷；不操作 worker-web；不修改程式碼、設定檔或資料庫。
- **合成輸入**：固定合成句（英文一則、粵語語意中文一則含虛構中文姓名）。
- **成功判準**：引導可完成且閘門生效；回退可用；雲端開關預設關、可開關且失敗有提示；能正確回述三層資料流（轉寫／雲端整理／分享）。**預期缺口（記錄而非失敗）**：無監護人同意、無年齡區分、onboarding 未告知雲端整理與背景分析、privacy 頁未涵蓋雲端資料流、中文識別資訊上雲。
- **失敗判準**：未勾選仍可完成引導；回退死結；記錄消失；雲端開關在 server 離線時誤報成功。
- **期望證據**：每步畫面截圖或狀態轉儲＋事件紀錄（api_reference §3 欄位）；開關前後本機儲存快照。
- **依賴**：無（可與 UA-U 並行，各自隔離環境或先後重置）。

### UA-U｜大學生（合成）
- **角色 ID**：UA-U
- **情境**：全流程角色：雲端整理開啟下記錄一週 → 觀察同步與來源標籤 → 觸發支援提示 → 準備／編輯／批准 → 與社工走完三分支＋兩種超時情境。
- **測試身份與權限**：合成大學生；學生端全部功能＋雲端整理開啟（操作者預先啟動測試 server，獨立 DB）。
- **起始狀態**：已完成 onboarding，雲端整理開啟（裝置已註冊），無記錄。
- **目標**：J2×多條（觀察 genai 旗標與來源標籤）→ J3（雲端日摘要）→ J4（雲端問答，有/無匹配各一）→ J5（server 背景分析驅動的提示；Not now snooze）→ J6（等待旗標、replied 後三分支、訊息往返）。
- **步驟**：① 建立 4–5 條跨 ≥2 天、含 ≥2 困難主題的合成記錄（含虛構英文識別資訊「Ms Chan」「Westview Secondary」「88 Harbour Road」「9123 4567」驗證去標識；一條含虛構中文姓名驗證上雲缺口）；② 核對 server 端（操作者協助導出）只存去標識文字；③ 觀察主頁提示由 server 分析驅動（先不滿足條件→不提示；補足→提示），記錄來源標籤；④ Not now 驗證 snooze；⑤ prepare→review：編輯兩句、核對 TokenRow 與摘錄；⑥ Approve → 確認遠端個案（`/shared` 文案為「verified social worker…」）；⑦ 待 UA-W1 接案後觀察「A social worker is reading your summary」；待回覆後先 rematch（驗證回隊列、claim_count+1），UA-W2 接案回覆後 continue 互傳訊息，最後 withdraw；⑧ 超時情境（需操作者調 server 時間或縮短超時設定）：未接案逾 72h 觀察「No social worker has taken the case yet」；社工接案 48h 未回應觀察自動回隊列；⑨ 全程穿插 J4 查詢並記錄來源標籤。
- **禁止操作**：不直接改 AsyncStorage／server DB（超時情境由操作者以環境手段執行並記錄為環境操作）；不使用真實金鑰以外的後端。
- **合成輸入**：預設計合成週記（coursework＋group＋sleep；新合成集，非內建 sample）。
- **成功判準**：提示時機與來源一致；server 端無虛構英文識別字串（中文姓名洩漏記錄為產品缺口）；遠端個案建立且隊列可見；三分支狀態機與 server 一致；撤回後學生端顯示「Nothing is shared right now.」；兩種超時行為與 CONTRACT 一致。
- **失敗判準**：提示提早／不出現或來源標籤錯誤；英文識別資訊上雲（屬產品缺陷，如實記分）；狀態機卡死；demo 文案出現在遠端個案。
- **期望證據**：事件紀錄＋各狀態截圖＋分享前後本機與 server 兩側快照（操作者導出，全合成）。
- **依賴**：J6 依賴 UA-W1／UA-W2 完成產品內狀態變化（不得代理間私下假裝交接成功）；超時情境依賴操作者環境配合。

### UA-W1｜社工（主接案，合成）
- **角色 ID**：UA-W1
- **情境**：已驗證社工在真實後端隊列接案、評估摘要可用性、回覆、處理學生 rematch 後的再流入。
- **測試身份與權限**：種子帳號 `demo.worker@unfold.local`（已驗證，general，zh-HK＋en）；僅 worker-web。
- **起始狀態**：UA-U 已完成至少一次遠端 Approve，隊列有 ≥1 個匹配個案。
- **目標**：J8（登入）→J9 全程→J10；驗證匹配、可見性邊界與撤回處理。
- **步驟**：① 登入，開 `/queue`，記錄可見欄位與匹配結果（語言∧專長∧容量）；② Claim，核對原子性與 201；③ 個案頁核對「只見去標識內容、無 device_id、無音頻入口」；④ 送出合成回覆；⑤ 學生 rematch 後確認個案回到隊列且帶 `rematch ×1` 徽章（此時讓 UA-W2 接走）；⑥ 學生 withdraw 後：確認個案從 `/cases` 列表消失；**另以操作者協助直接呼叫 API 驗證撤回後是否仍可直讀（H6 缺口）——只記錄，不評論**；⑦ `/profile` 修改容量為 1 並驗證容量閘門（達容量時 queue 為空＋警示），改回；⑧ 登出並確認 token 清除後路由守衛生效。
- **禁止操作**：不開啟學生端（除任務卡允許的狀態核對）；不記錄任何真實社工做法結論。
- **合成輸入**：合成回覆（支持性、不診斷）。
- **成功判準**：匹配正確；僅見去標識摘要與摘錄；回覆後學生端轉 `replied` 且有 Notice；rematch 徽章正確；容量閘門生效；撤回後列表消失（直讀結果如實記錄）。
- **失敗判準**：看到未去標識內容或裝置資訊；越權讀取他人個案成功；撤回後仍出現在列表。
- **期望證據**：同 UA-U，另附與學生端共享 `handoff_id` 的事件序列（發送→授權→接案→回覆→撤回）。
- **依賴**：必須等 UA-U 完成遠端 Approve；rematch 接收環節讓位 UA-W2。

### UA-W2｜社工（第二人：註冊→待驗證→競爭／接收 rematch，合成）
- **角色 ID**：UA-W2
- **情境**：新註冊社工體驗驗證閘門；驗證後作為第二名社工驗證接案競爭與 rematch 接收。
- **測試身份與權限**：新註冊帳號（未驗證）；帶外驗證由操作者改測試 DB 執行並記錄為環境操作（或使用種子 `new.worker@unfold.local` 演示未驗證態）。
- **起始狀態**：worker-web 可到達；server 運行。
- **目標**：J8 全程（含待驗證態）＋J9 的競爭／接收支線。
- **步驟**：① 註冊（含語言／專長／容量表單），驗證自動登入後所有個案路由被擋、顯示 VerificationPending，個人資料仍可編輯；② 操作者帶外翻轉 `verified`（記錄為環境操作）；③ 重新整理後進隊列；④ 與 UA-W1 同時對同一個案 Claim（預期一方 201、另一方 409 `already_claimed` 且 UI 提示「just claimed by another worker」）；⑤ 在 UA-U rematch 後從隊列接走該案（核對歷史訊息串對新社工可見——設計如此，記錄觀察）；⑥ 回覆讓 UA-U 走 continue。
- **禁止操作**：同 UA-W1；帶外驗證一步**必須**由操作者執行，agent 不得自行改 DB。
- **合成輸入**：註冊資料（合成姓名／機構）；合成回覆。
- **成功判準**：未驗證態雙端（UI＋API）皆被擋；競爭接案有且只有一方成功；rematch 個案可被第二人接走並延續對話。
- **失敗判準**：未驗證可取閱個案；雙方同時 claim 成功；rematch 個案消失。
- **期望證據**：各步驟截圖／API 回應紀錄＋事件紀錄（含 401/403/409 證據）。
- **依賴**：UA-U 的遠端個案存在；UA-W1 配合競爭時序。

---

## 5. Agent 清單與模型路由表

「Pro／Flash」為**預算與推理層級標籤，非供應商保證型號**（依 model-routing.md）。

**誠實聲明（必寫）**：本報告作者 Agent 1 實際運行於 **moonshotai/kimi-k3（thinking: xhigh）**，屬「**推理層級近似 Pro**」，**並非供應商保證的 Pro 型號**；主 agent 為 **moonshotai/kimi-k3**。已啟動的模型無法由本報告事後更改；下表對主 agent 與 Agent 1 的建議**僅適用於下一輪會話／重跑**。其餘 agent 尚未啟動，「實際模型 ID／別名」留待啟動時由主 agent 核實填寫；若環境只支援 `reasoning`／`lite` 路由，應映射為 Pro／Flash 的**操作性近似**並如實標註。另注：被測產品 server 端的 GenAI 同樣預設 `kimi-k3`（`server/src/config.js`）——產品內模型與評估代理模型同名，但兩者角色與責任完全獨立，評估結論不構成對產品內模型品質的背書。

| agent_id | 任務／場景 | 建議 Pro/Flash | 判斷依據 | 實際模型 ID／別名（待啟動核實） | 升級觸發 | 是否可降級 | 預算／品質權衡 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 主 agent | 對接委託人、轉交報告、取得審批、派發與匯整 | Flash（下一輪） | 格式清晰的對話與轉交，不作獨立產品判斷 | 本輪：moonshotai/kimi-k3（已啟動，無法事後更改） | 多份子報告結論相互矛盾需跨報告歸納時升 Pro | 可，預設即 Flash | 低成本轉交足夠；矛盾匯整是主要品質風險 |
| Agent 1 旅程分析 | 跨文件＋三套件全部原始碼發現角色、流程、權限與路由；核實委託人十項主張 | Pro | 高跨來源整合、權限推理與「文件 vs 程式碼」核實；需制定全隊路由 | 本輪：moonshotai/kimi-k3（thinking: xhigh）＝推理層級近似 Pro，**非供應商保證 Pro** | 不適用（已按高推理啟動） | 若重跑且僅核對增量改動可評估 Flash＋人工覆核 | 首輪與核實輪用高推理換取發現完整度，合理 |
| Agent 2 MCP 判定 | 工具清點（三程序＋DB＋API）、可觀察性與必要性取捨 | Pro | 涉及資料暴露、超時操控手段與工程邊界判斷 | 待啟動核實 | 不適用 | 純工具清點部分可 Flash，必要性結論須 Pro 或人工覆核 | 三套件架構下判定錯誤代價更高，維持 Pro |
| Agent 3 流程監控 | 檢查點核對、事件有效性標籤 | Flash | 逐步核對、有明確檢查點 | 待啟動核實 | 日誌矛盾、權限爭議、跨程序時序爭議、監控失效判斷 | 可，預設即 Flash | 重複核對適合低成本 |
| Agent 4 交接評核 | H1–H6 的送達、忠實、可續性與撤回語義評分 | Pro | 跨角色＋跨程序證據比對；撤回後可見性屬私隱敏感 | 待啟動核實 | 不適用 | 僅結構化送達核對可 Flash，本案建議維持 Pro | 交接面擴大且撤回語義有爭議點，不宜省 |
| UA-S 中學生 | 引導理解、三層資料流回述、回退路徑、保護與告知缺口盤點 | Pro | 私隱文案理解與敏感缺口判斷 | 待啟動核實 | 不適用 | 只跑「錄音→儲存」單一路徑可 Flash | 涉及未成年人相關判斷，偏向 Pro |
| UA-U 大學生 | 雲端開啟下全主鏈＋例外分支＋超時情境、跨端狀態核對 | Pro | 多步情境、雙側（本機/伺服器）狀態核對、撤回／換人分支、去標識上雲核對 | 待啟動核實 | 若環境只支援每 agent 一模型，按最關鍵任務定 Pro | 拆成單步小任務後常規記錄步驟可 Flash | 全流程角色是證據主來源，品質優先 |
| UA-W1 社工 | 匹配核對、可見性邊界、回覆、容量閘門、撤回邊界記錄 | Flash→Pro | 操作步驟少（Flash 適用），但可見性／撤回直讀核對屬敏感交接（Pro） | 待啟動核實 | 發現疑似洩漏或邊界含糊時 | 每 agent 一模型時建議 Pro | 單一路徑成本低，但誤判可見性代價高 |
| UA-W2 社工（第二人） | 註冊／待驗證體驗、接案競爭、rematch 接收 | Flash | 路徑明確、成功判準機器可驗證（403/409/201） | 待啟動核實 | 競爭結果矛盾或時序爭議時升 Pro 覆核 | 可 | 判準明確，適合低成本 |
| developer（按需） | 僅當 Agent 2 判定需要 MCP 且委託人批准工程 | Pro | 工具契約與權限設計有安全風險 | 待啟動核實／未批准前不啟動 | 不適用 | 模板化代碼可 Flash 起草，仍須 Pro／reviewer 審 | 未批准不產生成本 |
| reviewer（按需） | 獨立審查 developer 產出 | Pro | 須與 developer 分離的獨立審查 | 待啟動核實／未批准前不啟動 | 不適用 | **不建議降級**；無 Pro 可用時須告知委託人並改人工審查 | 審查降級會架空整個工程關卡 |

---

## 6. 計劃與空白

**計劃覆蓋的路徑**
- J1–J10 全部主鏈正常路徑；J2 mic 拒絕／空轉寫／轉寫失敗／打字回退＋雲端同步來源標籤；J3 雲端/本機摘要；J4 有/無匹配＋來源標籤；J5 server 分析驅動提示、Not now snooze、review Not now；J6 等待旗標、三分支、撤回、兩種超時；J7 雲端開關（含 server 離線錯誤路徑）與刪除邊界；J8 註冊／待驗證／登入失敗；J9 匹配、競爭接案、容量、非本人個案；J10 資料修改與登出。
- 去標識化：英文識別資訊（應移除並驗證 server 端無殘留）＋中文識別資訊（預期**上雲洩漏**，記錄缺口）。
- 同意邊界：未開雲端同意時同步被 403 拒絕（server 單元測試已覆蓋，執行期複核）。
- 超時：以操作者調整設定／時鐘的環境手段觸發，記錄為環境操作。

**未覆蓋／無法覆蓋的路徑與風險**
1. 全部 GenAI 功能的**真實模型品質**——需受限 Moonshot 金鑰＋連網授權，否則整類標「無法測試」（fallback 路徑可測但不代表 GenAI 品質）。
2. 本機 demo 模式的回覆後分支——demo 個案無回覆入口，無法測試（設計已明示 demo 不會有真人回覆）。
3. 管理員驗證發放——無產品表面，無法測試；只能以環境操作替代並如實標註。
4. 雲端資料刪除——無功能，無法測試（記錄為缺口）。
5. 跨記錄連結的使用者可觀察性——無 UI，無法以使用者旅程測試（僅能 API 層核對，且 fallback 連結極保守）。
6. 粵語／英文轉寫準確率（同 v1）；真機麥克風與權限（同 v1）；臨床適切性（同 v1）。
7. 測試通過狀態：本輪靜態點算 app 20、server 77 個測試（與 VERIFY.md 主張一致），但**未執行**；VERIFY.md 的 21 步 curl 流程屬文件主張。
8. 代理模擬分數不代表市場、臨床或合規結論（同 v1）。

**v1 六題的處置狀態**
1. 「同機模擬作為交接證據」→ **已被新實作大部分解決**：雲端開啟時為真實後端中介交接；僅本機 demo 模式仍屬演示級，且 demo 已無回覆迴路。殘留問題見新問題 13。
2. ElevenLabs 受限金鑰 → **未解決**，維持需要；另見新問題 7（Moonshot 金鑰）。
3. UA-S 保留以記錄保護缺口 → **未解決**（實作仍無年齡/監護人區分）；建議維持保留。
4. 逐代理模型指定能力 → **未解決**（環境問題，維持原要求）。
5. 分數權重測試前確認 → **未解決**（v2 交接增至 6 條，權重更需先定）。
6. 合成輸入集審閱 → **未解決**（v2 合成集新增中文姓名上雲觀察項，更需審閱）。

**需委託人確認的新問題**
7. **Moonshot 測試金鑰與連網授權**：是否提供受限 `MOONSHOT_API_KEY` 與連網許可以測 GenAI 真實路徑？若否，全部 GenAI 品質維持「無法測試」，僅覆蓋 fallback 與降級行為。（註：`server/.env` 已存在但未讀；請確認該金鑰額度與用途，測試不會使用它。）
8. **測試環境授權**：是否授權在隔離環境啟動 server（本地埠＋獨立 DB）與兩個客戶端做端到端？本輪未執行任何程式。
9. **撤回後已接案社工仍可經 API 直讀個案**（`routes-worker.js:209` 無狀態檢查；VERIFY.md 步驟 21 同載）：設計決定還是缺陷？直接影響 Agent 4 撤回維度評分基準。
10. **雲端資料生命週期**：關閉同意／Delete everything／單條刪除均不刪除 server 已同步資料且無刪除 API——是否接受為演示級限制？（建議：接受但列阻斷觀察項，因與「可隨時關閉」的設定頁文案存在預期落差。）
11. **社工驗證的帶外流程**：模擬時由操作者直接改測試 DB 翻轉 `verified` 並記錄為環境操作（非產品行為）——是否接受此替代？
12. **需求基線文件**：Questionnaire（Q5/Q13/Q14 仍描述同機模擬、12 測試、GenAI 為未來工作）與根 README（未提 server）均滯後於程式碼——以哪份文件為需求基線？是否要求委託人先更新文件再進入模擬？
13. **demo 模式定位**：雲端關閉時個案只存本機且無回覆可能——模擬是否一律在雲端開啟＋測試 server 下進行，demo 模式僅驗證其如實標示（Demo mode Notice）？
14. **中文識別資訊上雲**：雲端整理開啟後，未去標識的中文姓名等會進入 server DB——是否同意將此列為**私隱阻斷觀察項**（不阻斷合成測試，但在評分中單列，不被其他高分沖淡）？

---

## 7. 審批欄

- **報告版本**：journey-report-v2（2026 年會話 run-001，Agent 1 產出；基線程式碼：git `598dcce`）。
- **與 v1 關係**：v2 取代 v1；十項缺口核實結果：已實作 9／部分 1／未實作 0／未知 0（詳卷首裁定表）。
- **請委託人選擇**：☐ 確認　☐ 要求修訂（請指明章節）　☐ 停止
- **是否作為下階段基線**：☐ 是，以 v2 為 Agent 2 與使用者 agents 的唯一基線　☐ 否，待修訂版
- **模型路由確認**：☐ 接受第 5 節建議與誠實聲明（含 moonshotai/kimi-k3（thinking: xhigh）現狀與「近似 Pro」標註）　☐ 要求調整
- **未獲明確確認前，不啟動 Agent 2、使用者 agents、任何測試或工程分支。** 本報告可作為本輪最終產物等待指示。
