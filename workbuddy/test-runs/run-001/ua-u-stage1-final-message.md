# UA-U｜大學生（合成）— 階段 1 最終訊息

> run-001／journey_version=v2-approved／role=UA-U。階段 1 範圍：建立記錄 → 同步核對 → 提示 → 批准分享。**本階段不做自評分。**
> 全部輸入為合成資料（data_classification=synthetic）。

## 0. 重要前置：attempt-1 污染與重跑

- 首次執行使用 `agent-browser --session-name ua-u`，該旗標**非真正隔離**，與 UA-S 共用 default browser session，狀態互染（環境/工具問題，非產品問題）。
- 依編排指示：attempt-1 截圖保留為 `evidence/ua-u-attempt1-step01–09.png`；attempt-1 期間 events/ua-u.json **尚未建立**，無檔可複製（ua-s 側的 `events/ua-s.attempt1-polluted.json` 為 UA-S 自己保留的檔案）。
- **階段 1 全部步驟已用 `agent-browser --session ua-u`（真正隔離 context）從頭重跑**。重跑起始已驗證隔離成立：localStorage 全空、無 device token、自動導向 /onboarding，無任何先前狀態殘留。以下全部結果均來自重跑後的乾淨 session。

## 1. 逐步結果

| 步驟 | 結果 | 摘要 |
| --- | --- | --- |
| 0 onboarding＋勾選閘門 | ✅ 完成 | 三步走完；第 3 步未勾選時 Start disabled，勾選後可完成（ua-u-step01–03） |
| 0 開啟 Cloud organisation＋裝置註冊 | ✅ 完成 | 開關生效；device token **取得成功**（64 字元，值不回報）；curl 驗證 token 可用（ua-u-step04–05） |
| 1 建立 2 條同主題記錄 | ✅ 完成 | coursework ×2（Today/Yesterday）；saved 頁顯示雲端簡短回應，來源標籤「(not AI)」（fallback 如實標示）（ua-u-step06） |
| 1 主頁核對（2 條） | ✅ 符合預期 | 無支援提示；GET /api/analysis approaching=false、genai=false（ua-u-step07） |
| 2 再建 3 條（總 5 條、跨 3 本地日、3 主題） | ✅ 完成 | group＋英文識別資訊（A few days ago）、sleep（Today）、粵語＋陳小明（Yesterday）（ua-u-step08） |
| 3 同步核對（API） | ✅ 完成（發現預期缺口） | 詳見 §2 |
| 4 主頁核對提示（雲端開啟） | ⚠️ **缺陷 D1：提示被壓制** | 詳見 §3；經 supervisor 裁定以方案 A（使用者繞道）繼續 |
| 4 Not now → snooze → +2 條 → 提示重現 | ✅ 完成（繞道路徑） | snoozeUntilCount=5+2=7；6 條不出現、7 條重現（ua-u-step11/12） |
| 5 /prompt 解釋＋聲明 | ✅ 完成 | 來源標籤「Pattern check on this phone.」；含「not a clinical judgement」聲明（ua-u-step13） |
| 5 /review：編輯兩句、TokenRow、摘錄核對 | ✅ 完成 | TokenRow=[PERSON][SCHOOL][ADDRESS][PHONE]；摘錄無英文識別字串；含「陳小明」（缺口）（ua-u-step14–17） |
| 6 Approve sharing → /shared 遠端文案 | ✅ 完成 | 遠端個案文案確認（非 Demo mode）（ua-u-step18） |
| 6 curl /api/cases/active | ✅ 完成 | 個案 ID 與狀態見 §4 |

未執行項：無（階段 1 指定步驟全部執行；步驟 4 的「server rules 驅動提示」因 D1 客觀上無法出現，已如實記錄而非跳過）。

## 2. 去標識核對結果（GET /api/entries，5 條全同步）

- **英文識別資訊：無洩漏** ✅。「Ms Chan」「Westview Secondary」「88 Harbour Road」「9123 4567」在 server 端全部替換為 `[PERSON]`/`[SCHOOL]`/`[ADDRESS]`/`[PHONE]`，逐條 grep 無殘留；tokens 欄位正確記錄 4 類 token。
- **中文姓名：預期洩漏 → 產品缺口** ⚠️。「陳小明」原樣上雲（與 v2 報告 §1 風險 4 一致）。且該句進入個案摘錄（buildDraft 取每條首句），**社工端個案載體同樣可見「陳小明」**——缺口影響範圍由同步層延伸到分享層。
- **genai 旗標：5 條全 false** ✅（GenAI fallback 模式，與 server /api/health 的 configured:false 一致）；來源標籤在 saved 頁如實顯示「(not AI)」。
- 附帶觀察：粵語記錄 server fallback 分類 topics=[]（關鍵字規則不覆蓋中文），不影響本階段主鏈但值得記錄。

## 3. 提示時機與來源（含重大產品發現 D1）

- **缺陷 D1（已端到端核實，supervisor 已知情並裁定）**：雲端整理開啟時支援提示**永不出現**。缺陷鏈：① app `setEventTime`（store.tsx:218-222）只更新本機 state，**從不重新同步 eventAt**；② server 端所有 entry 的 event_at=createdAt（同日）；③ server 背景分析要求 days.size≥2（由 event_at 推導，genai.js:508）→ 永遠 approaching=false（curl 確認）；④ 主頁 index.tsx:79 雲端分析可得時**優先於本機規則** → 提示被壓制（5 條記錄達本機閾值仍無提示，截圖 ua-u-step09）。**程式碼推論（非執行驗證）**：真 GenAI 路徑同樣以 event_at 推導 day，預期同樣受影響。
- **繞道後的提示行為（方案 A，全 UI 操作）**：關閉 Cloud organisation → 本機規則驅動提示出現（來源=**on-device**）；Not now → snoozeUntilCount=7 → 新增 2 條 → 提示準時重現（snooze 邏輯正確）。
- **判準記錄**：提示時機與來源記「**部分達成**」——提示可出現且時機正確，但僅 on-device 路徑；server rules 驅動路徑因 D1 被壓制。依指示不記為通過，亦不自評分。
- 附帶觀察：雲端關閉期間建立的記錄 6、7 永不補上雲（無 backfill 機制）。

## 4. 個案與遠端文案

- **個案 ID：`b81825ca-bdab-414e-b19f-c5f37af9d457`**
- **當前狀態：`queued`**（claimCount=0、waitingNoWorker=false、messages=0、createdAt=2026-10-03T17:35:33Z）
- /shared 文案確認為遠端個案版：「Only the summary was shared. Your recordings and full transcripts stay on this phone. **A verified social worker can now pick up the summary** and reply here.」——**非** Demo mode ✅；本機 case `remote=true`。
- 個案內容：兩句結論為我編輯後的合成措辭；摘錄 6 條（取最近 6 條，最舊一條被排除——設計如此）；摘錄無英文識別字串、含「陳小明」（缺口）。
- handoff：handoff_id=H1-run001、artifact_version=1、consent_ref=cloudOrg+review-approve、sender=UA-U、recipient=UA-W1（已寫入事件）。

## 5. 證據與事件統計

- 事件：**21 條**（events/ua-u.json；sequence 1–21 單調遞增；2 條分享相關事件含 handoff 欄位；全部 evidence_ref 指向實存檔案或 "none"）。
- 截圖：**18 張**（evidence/ua-u-step01–18.png）＋ API 證據 3 份（ua-u-api-entries.json、ua-u-api-analysis.json、ua-u-api-cases-active.json）。attempt-1 另存 9 張（ua-u-attempt1-step01–09.png）。
- device token：**取得成功**（僅回報成功與否）。

## 6. 環境問題（區分產品/環境）

**產品問題（被測產品）**
1. **D1（重大）**：eventAt 不再同步 → 雲端開啟時支援提示被壓制（詳 §3）。
2. 中文識別資訊未去標識上雲並流入個案摘錄（預期缺口，已核實）。
3. 雲端關閉期間建立的記錄無補同步機制。
4. server fallback 關鍵字不覆蓋中文（粵語記錄 topics=[]）。
5. buildDraft 摘錄固定取最近 6 條（設計取捨，記為觀察）。

**環境/工具問題（非產品）**
1. `agent-browser --session-name` 非真正隔離導致 attempt-1 與 UA-S 互染——已改用 `--session` 重跑解決。
2. agent-browser 的 click 對部分 React Native Web Pressable（Not now、See options、See what will be shared、Edit）不觸發 handler；改用 JS `dispatchEvent` 點擊成功。已核實產品 handler 本身正常（dispatch 後狀態正確變更），屬自動化操作繞道。
3. Expo web 首次打包較慢（預期內）；fill 在頁面切換瞬間偶有競態，已以「fill 後 snapshot 驗證再 Save」規避，未造成資料錯誤。

## 7. 交接給後續階段

- 階段 2/3 與 UA-W1/UA-W2 請使用個案 ID `b81825ca-bdab-414e-b19f-c5f37af9d457`（狀態 queued）。
- 我的 browser session（`--session ua-u`）保持開著，停留在 /shared 頁；localStorage 內有完整 7 條本機記錄（5 條已上雲）與 draft/case 狀態。
- 注意：UA-W1 接案後，學生端主頁 Notice 與 /case 輪詢依賴遠端個案，雲端目前已重新開啟，後續階段可直接進行。
