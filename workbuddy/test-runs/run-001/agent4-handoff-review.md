# Agent 4 跨角色交接評核（run-001）

> **評核者**：Agent 4（跨角色評核）｜**評核日期**：2026-10-04｜**基線**：journey-report-v2（git `598dcce`）
> **範圍聲明**：只評**產品內發生**的授權、訊息、狀態與責任交接（H1–H6）。代理團隊內部協作不屬本評核範圍（屬 Agent 3）。
> **評分規則**（api_reference §4）：每個**測試執行有效**的交接 0–100 分，四維度權重固定為——資訊送達與權限 **35**、內容可理解與忠實 **30**、接收方可繼續工作 **20**、異常及撤回處理 **15**。逐項關聯同一 `handoff_id` 證據。**有效觀察到產品交接失敗仍是有效測試，對失敗維度給低分或 0；未執行標明，不擅給 0 或 100。**
> **有效性前提**：本評核只為 Agent 3 裁定有效的交接評分（agent3-validity-audit.md §0、§7.4、§10：H1/H2/H6 有效、H5 有效但鏈較弱、H3/H4 可評但證據非交接事件鏈形式）。
> **兩項全域前提**：
> ① **不計單一產品總分**——多交接整體權重未經委託人事前確認（gate-log #16-5；api_reference §4），本檔只展示逐交接分數，**不平均、不加總**。
> ② **全部分數處於「待委託人事後確認」狀態**——Gate 1 為概括授權通過、非逐關卡知情確認（Agent 3 §1.2），委託人醒後覆核前所有結論可推翻。

---

## 評分總覽（逐條列出，不平均）

| 交接 | 送達與權限 /35 | 可理解與忠實 /30 | 可繼續工作 /20 | 異常及撤回 /15 | **該交接總分 /100** | 有效性前提 |
|---|---|---|---|---|---|---|
| H1 個案提交／接案／換人／撤回 | 33 | 20 | 19 | 4 | **76** | 有效（三版本雙側事件齊） |
| H2 回覆與雙向訊息 | 20 | 24 | 18 | 9 | **71** | 有效（D2 屬產品缺陷，照評） |
| H3 去標識同步 | 28 | 15 | 15 | 4 | **62** | 可評，**非交接事件鏈形式證據**（未掛 handoff_id） |
| H4 衍生產物回送 | 18 | 27 | 16 | 11 | **72** | 可評，**非交接事件鏈形式證據**；全部觀察為 genai=false fallback |
| H5 sweeper 超時重配 | 27 | 24 | 19 | 11 | **81** | 有效但**單 actor、API 層證據**（較弱） |
| H6 撤回後殘留可見性 | 8 | 18 | 5 | 2 | **33** | 有效（證據最強）；**阻斷觀察項單列** |

---

## H1 學生 →（server）→ 社工：個案提交／接案／換人／撤回 — **76/100**

**handoff_id**：`H1-run001`｜**artifact_id**：`b81825ca-bdab-414e-b19f-c5f37af9d457`｜三版本遞進、consent_ref 狀態正確（v3 標 `(withdrawn)`）。

**有效性前提**：Agent 3 §7.4/§10 裁定**有效**——三版本均有發送＋接收雙側事件、共享 ID、artifact 一致。

**證據鏈**（同 handoff_id 串聯）：
- **v1 提交→接案**：ua-u seq20（17:35:40Z Approve，/shared 遠端文案確認，evidence ua-u-step18.png）→ ua-u seq21（API：status=queued、createdAt 17:35:33Z，evidence ua-u-api-cases-active.json）→ ua-w1 seq3（17:50:40Z 隊列可見、欄位正確、匹配成立 zh-HK∧general∧0<5，ua-w1-step02.png）→ ua-w1 seq4（API 負載無 device_id）→ ua-w1 seq5（17:51:56Z Claim 201 一次成功）。
- **v2 換人（rematch）**：ua-u seq26（18:08:06Z 「Ask for someone else」，歷史訊息保留，ua-u-step22.png）→ ua-u seq27（API：status=queued、claimCount 1→2、claimed=false，evidence ua-u-api-cases-active-stage2-rematch.json；server 實作 rematch 寫 queued 屬語義正確，routes-student.js:486-492）→ ua-w2 seq12（隊列可見、`rematch ×2` 徽章，ua-w2-step06.png）→ ua-w2 seq13（近並發競爭：W2→201、W1→409 already_claimed，claim_count=3，原子鎖生效）。
- **v3 撤回**：ua-u seq34（18:36:34Z withdraw，**無二次確認對話框＝D3**；/case 即顯「Nothing is shared right now.」）→ ua-u seq35（API：`case:null`，狀態機閉環 queued→claimed→replied→queued→claimed→replied→continued→withdrawn）→ 列表邊界：ua-w2 seq19（My cases 空）、ua-w1 seq12–14（My cases 空／queue 空／403 not_your_case）→ 殘留直讀：ua-w2 seq20–22（見 H6）。

**四維度評分**：

1. **資訊送達與權限 33/35**——個案送達匹配隊列且僅匹配者可見（語言∧專長∧容量三重條件實測成立）；接案原子性經近並發競爭驗證（恰一方 201、他方 409）；權限邊界完整：未驗證社工 403 not_verified（ua-w2 seq8–9）、無 token 401、假 ID 404、非本人 403 not_your_case（ua-w1 seq11/14、ua-w2 seq14）、負載不含 device_id（UI＋API 雙側 grep 零命中）；撤回後自隊列與雙方列表消失。扣分點：撤回後的直讀權限失效歸入「異常及撤回」維度與 H6 單列（避免重複扣分）；topics 分類 academic vs 任務預期 coursework 屬分類器輸出差異，未影響匹配（兩社工均 general）。
2. **內容可理解與忠實 20/30**——社工所見與學生**編輯後**批准的內容逐字一致（ua-u seq18 編輯 → ua-w1 seq3 隊列卡片即顯示編輯版兩句結論；摘錄、期間、topics 完整）；頁面明示「原始錄音與全文稿不離開學生裝置」。**重大扣分**：摘錄含虛構中文姓名「陳小明」明文，對兩名社工在 UI＋API 雙側可見（ua-u seq17 流出點、ua-w1 seq7–8、ua-w2 seq15）——違反「只送去標識內容」的交接承諾，中文去標識缺口延伸至分享層（阻斷觀察項 ③，見總表）。另：queue 卡片未顯示 recent_change（ua-w2 seq12，輕微）；`rematch ×2` 徽章直接反映累計 claim_count 而非「被換人次數」，語義含糊（ua-w2 seq12 如實記錄的差異）。
3. **接收方可繼續工作 19/20**——W1 接案→讀取→回覆全流程無障礙；W2 接走 rematch 個案時**歷史訊息串對新社工可見**（設計如此，ua-w2 seq15），得以延續對話並回覆，接收方續接能力完整。扣 1 分：歷史訊息在 UI 標示為「You」，不區分發送社工身份，新社工易誤認為自己發過的訊息（ua-w2 seq15 觀察）——屬可續性上的理解干擾（此缺陷在 H2 維度 2 亦有反映，此處僅就「新社工接手」角度扣一分）。
4. **異常及撤回處理 4/15**——換人（rematch）異常路徑表現優異：狀態、計數、歷史保留、按鈕收斂全部正確。撤回路徑**部分生效**（學生端即時清空、隊列與雙方列表消失、active 端點回 null），但存在三項失效：① **H6 撤回後直讀**（已接案社工 API 200 直讀摘錄全文＋3 條訊息，見 H6 單列）；② **D3 撤回無二次確認**（case.tsx:110 直接執行破壞性操作，ua-u seq34）；③ 撤回後社工端個案頁仍完整渲染且**回覆框仍顯示可用**（ua-w2 seq20）。依 gate-log #16-9，H6 在此如實給低分並單列，不被 rematch 的高分沖淡。

**單列**：阻斷觀察項 ①（H6，詳見 H6 條）；阻斷觀察項 ③（「陳小明」流入分享層）；產品缺陷 D3（無二次確認）。

---

## H2 社工 →（server）→ 學生：回覆與雙向訊息 — **71/100**

**handoff_id**：`H2-run001`｜artifact 同上｜v1（W1→學生）、v2（W2→學生＋學生→W2 反向）。

**有效性前提**：Agent 3 §7.4/§10 裁定**有效**（雙側事件齊）；並明示 D2 屬「有效觀察到的產品交接缺陷」，應對送達維度給低分而非標無效——本評核照此執行。

**證據鏈**：
- **v1**：ua-w1 seq9（17:53:35Z 回覆送出）→ ua-w1 seq10（API：status=replied、responded_at=17:53:34.969Z、訊息逐字一致落庫）→ ua-u seq22（**D2：主頁 Notice 不可達**——server 17:53:34 已 replied，至 18:06:18 逾 12 分鐘、主頁停留 >2 分鐘仍無 Notice，ua-u-step19.png）→ ua-u seq23（主動進 /case 觸發 refresh，回覆逐字一致、heading「A social worker replied」，ua-u-step20.png）→ ua-u seq24（markReplySeen 生效，seenReply=true）→ ua-u seq25（API 複核：replied、1 條 worker 訊息逐字一致，evidence ua-u-api-cases-active-stage2-post-read.json）。
- **v2**：ua-w2 seq16（18:23:07Z 回覆）→ ua-w2 seq17（API：replied、2 條訊息）→ ua-u seq28（18:32:37Z 讀取，W2 回覆逐字一致＋W1 歷史保留，ua-u-step23.png）→ ua-u seq29（API 複核，evidence ua-u-api-messages-stage3-pre.json）→ ua-u seq30–31（continue → server status=continued）→ ua-u seq32–33（學生訊息送出並落庫 sender=student；本機 18:34:21.970Z vs server 18:34:21.973Z 差 3ms，evidence ua-u-api-messages-stage3-post-send.json）→ 社工側接收：ua-w2 seq20 於個案頁見 3 條訊息（**注意：此觀察發生在撤回後**，見下）。

**四維度評分**：

1. **資訊送達與權限 20/35**——**產品缺陷 D2 照實給低分**：主頁「A social worker replied」Notice 在此流程下**永不可達**（主頁無輪詢；refreshCaseFromServer 僅 /case 掛載觸發，index.tsx:74／case.tsx:22-24），送達時延實際為無限，完全依賴學生主動進 /case——對支援類產品，回覆通知是交接的核心承諾，此為實質送達失敗。維持中段分而非更低的原因：傳輸與落庫本身完整（responded_at 落庫、/case 15 秒輪詢生效、已讀標記正確、API 權限正確——僅本人裝置 token 可讀 /api/cases/active）；學生→社工反向訊息落庫正確（3ms 時序互證）。另註：社工側對學生 continue 訊息的「接收」僅在撤回後被觀察到（ua-w2 seq20），撤回前的社工側已讀未被單獨留證——屬證據空隙而非產品失敗，如實標明。
2. **內容可理解與忠實 24/30**——雙向內容**逐字一致**（W1/W2 回覆、學生訊息均經 UI↔API 比對，含 em-dash 編碼細節）。扣分：訊息只標 `sender=worker/student`，**不帶個別 worker id**——API 層如此（ua-w2 seq17），UI 層更甚：W1 的歷史回覆對 W2 顯示為「You · 01:53」（ua-w2 seq15），換人後訊息主體不可區分，對「誰說了甚麼」的忠實呈現有實質缺口（學生側兩張卡片均只標「Social worker」，ua-u seq28）。
3. **接收方可繼續工作 18/20**——replied 後三分支全部走通（continue→輸入框→送出→對方可見；rematch 見 H1；withdraw 見 H1/H6）；continued 態社工可再回覆（產品設計，ua-w2 seq16 提示文案佐證）；歷史訊息跨換人保留，對話可延續。扣分：本機訊息上限 500 字／server 上限 1000 字不一致（v2 已載的小落差，本次未觸發但屬可續性隱患）。
4. **異常及撤回處理 9/15**——已讀語義正確（markReplySeen 狀態機層面驗證通過；惟因 D2，「Notice 出現→已讀消失」的使用者可見閉環未達成，UA-U 已如實標註）；換人後歷史不丟屬異常路徑的正面表現。扣分：撤回後社工端回覆框仍顯示「You can send a message…(status: withdrawn)」（ua-w2 seq20）——撤回態的互動邀約未收回（server 是否 409 擋下**未執行**，見未執行清單）；離線期間訊息延遲對帳路徑**未執行**（v2 已標「執行期未驗證」）。

**單列**：產品缺陷 **D2**（主頁 Notice 不可達——送達維度低分的主因）；產品觀察項（訊息不區分社工身份；撤回態回覆框可用）。

---

## H3 學生 → server：去標識記錄同步（資料交接） — **62/100**

**⚠ 證據形式聲明**：全 run **無任何事件掛 H3 handoff_id**（Agent 3 §7.4 F6）；以下評分基於**實質同步證據**（ua-u seq9、ua-s seq8–9、ua-supp seq1–3 及對應 API 轉儲），**非交接事件鏈形式證據**。

**有效性前提**：Agent 3 §10 裁定「可評但須註明證據非交接事件鏈形式」。

**證據**：授權鏈——ua-s seq8（開關預設關 → 開啟 → 裝置註冊、cloudOrg=true，server /api/devices/me 確認）；ua-supp seq1–2（register 201 → consent 200）。送達——ua-u seq9＋evidence ua-u-api-entries.json（5/5 條同步，syncedAt 時序合理）；ua-s seq9＋evidence ua-s-step21.json（2/2 條）；ua-supp seq3（3/3 條，topics 回寫）。內容——ua-u seq9：英文識別字串「Ms Chan／Westview Secondary／88 Harbour Road／9123 4567」全部替換為 [PERSON]/[SCHOOL]/[ADDRESS]/[PHONE]，**逐條 grep 零殘留**；「陳小明」**原樣上雲**（tokens=[]）；genai=false ×5 如實標示。ua-s seq9：中文句「陳小明」contains=True 程式驗證上雲。

**四維度評分**：

1. **資訊送達與權限 28/35**——同意開啟後同步送達完整（三裝置 10/10 條），裝置註冊與獨立 cloudOrg 同意 API 實測成立，同步閘門程式碼層存在（403 cloud_org_not_enabled）。扣分：**「未同意時同步被 403」的執行期複核未執行**（僅 server 單元測試覆蓋，見未執行清單）；server **信任客戶端去標識結果、不做二次去標識**——授權鏈對「送出去的是甚麼」無 server 側把關（v2 §1 風險 4），此為權限維度的結構性弱點。
2. **內容可理解與忠實 15/30**——英文路徑**滿分級表現**：四類識別資訊全替換、tokens 種類記錄正確、零殘留、genai 旗標誠實。**但中文路徑系統性失效**：虛構中文姓名「陳小明」未去標識直接上雲（兩個角色獨立複現）——對「only the de-identified text is sent」的承諾構成實質違反，依 gate-log #16-14 列**私隱阻斷觀察項 ③**（單列，不被英文路徑高分沖淡）。半分給法：英文完美（約 15）＋中文系統性 0 覆蓋（0），合 15/30。
3. **接收方可繼續工作 15/20**——server 接收後完成分類並回寫（topics/attributes/uncertainty/genai 旗標），條目可查詢、可供後續衍生計算。扣分：中文條目 server fallback 同樣 topics=[]、uncertainty=[no clear topic detected]（ua-u seq9、ua-s seq9）——中文內容對接收方的下游工作（分類、未來的匹配輸入）實質降級；欺凌披露在中英文規則下均未識別為敏感主題（ua-s seq9/11 觀察）。
4. **異常及撤回處理 4/15**——**阻斷觀察項 ②**：關閉同意只停止未來同步，**不刪除已上雲資料，且無任何刪除 API**（v2 §1 風險 4；gate #16-10 代決「接受演示級限制但列阻斷觀察項」）——同意撤回的產品語義與設定頁「可隨時關閉」文案存在預期落差。另：**開雲端前的既有記錄永不回填同步**（UA-S G6，ua-s seq8；UA-U seq14 同觀察）——撤回／邊界情境外的「靜默漏送」。正面：開關操作本身在線路徑實測成功（ua-s seq8）；離線錯誤路徑**未執行**（見清單）。

**單列**：阻斷觀察項 ②（雲端資料無刪除生命週期）；阻斷觀察項 ③（中文識別資訊上雲）。

---

## H4 server → 學生：衍生產物回送 — **72/100**

**⚠ 證據形式聲明**：同 H3，**無 H4 handoff_id 事件**（F6）；評分基於實質觀察（來源標籤與內容核對），**非交接事件鏈形式證據**。且**全部觀察為 genai=false fallback 路徑**——真 GenAI 輸出品質依 gate #16-7 整類「無法測試」，本條不對 GenAI 品質給分。

**有效性前提**：Agent 3 §10 裁定「可評但須註明同上」。

**證據**：簡短回應——ua-u seq5（saved 頁顯示「A brief note from the cloud organiser (not AI)」，fallback 如實標示）；ua-s seq5（雲端關閉：無 AI 回應、保留靜態文案✓）；ua-s seq9（雲端開啟後兩則回應：invite-elaboration → acknowledgement，**未連續重複追問**，硬規則生效）。背景分析——ua-u seq7（approaching=false、genai=false、含「not a clinical judgement」，evidence ua-u-api-analysis.json）；ua-u seq10（**D1 缺陷鏈**）；ua-u seq12（繞道後 on-device 提示出現）；ua-u seq15（/prompt 頁來源標籤「Pattern check on this phone.」＋非臨床聲明）。日摘要——ua-s seq7（月曆非評估聲明✓、兩日摘要均標「On-device summary」、中文日摘要退化為「You saved a note on this phone.」如實呈現）。跨記錄連結——ua-u seq4（`links:[]`）＋全倉無客戶端消費（v2 靜態核實）。

**四維度評分**：

1. **資訊送達與權限 18/35**——**產品缺陷 D1 照實給低分**：雲端開啟下，背景分析驅動的主頁支援提示**永不可達**（setEventTime 不再同步 eventAt → server 端 event_at 全為 createdAt → analyseBackground days≥2 永不成立 → 雲端分析永遠 approaching=false 且優先權蓋過本機規則；ua-u seq10 端到端核實）——H4 中最主動的一類回送（提示）在設計路徑下送達失敗，僅經「使用者繞道」（關雲端）後由 on-device 路徑補償（不計入設計路徑分）。另：跨記錄連結有 API、**無任何客戶端消費**，該類產物從不送達使用者。已送達且正確的：簡短回應（雲開/雲關兩態）、分析端點本身、/prompt 解釋頁、on-device 日摘要。
2. **內容可理解與忠實 27/30**——來源標籤**全場景誠實**：(not AI)／(not AI) ×2／「Pattern check on this phone.」／「On-device summary」均與實際產出方式一致；「not a clinical judgement」聲明在分析回應與 /prompt 雙處出現；月曆「not an assessment」聲明存在；中文日摘要無主題可述時退化為中性句而非編造（誠實但低資訊量）；genai=false 旗標全程未偽裝。扣分：中文摘要內容貧乏（對中文使用者實用性低）；非評估聲明未在 day 頁重複（ua-s seq7 觀察，輕微）。
3. **接收方可繼續工作 16/20**——提示出現後的續接鏈完整可走：See options → /prompt 解釋 → Prepare summary → review（ua-u seq12–16）；Not now snooze 精確生效（snoozeUntilCount=7，6 條不出現、7 條重現，ua-u seq13–14）；簡短回應不阻塞儲存。扣分：主鏈入口（提示）在雲端開啟的**正常使用配置**下因 D1 不可達——接收方在設計路徑下根本沒有「繼續工作」的起點，UA-U 須以非正常使用路徑（開關雲端）才能進入；此處與維度 1 的 D1 扣分屬同一缺陷的兩個面向（送達失敗＋續接起點缺失），如實分攤、不重複加倍。
4. **異常及撤回處理 11/15**——降級行為誠實且不打斷使用者：雲端關閉時 saved 頁保留靜態文案（ua-s seq5）、分析取不到時回退本機規則（ua-u seq11–12 繞道反向驗證了回退本身有效）、fallback 一律如實標示。扣分：雲端關閉期間建立的記錄**永不補同步**（ua-u seq14），server 端衍生產物對該批記錄永久缺席且無任何提示；J7 server 離線時開關錯誤路徑**未執行**（見清單）。

**單列**：產品缺陷 **D1**（eventAt 不同步 → 提示壓制——維度 1 低分主因）；觀察項（連結無消費、中文摘要貧乏）。**未執行不給分**：J4 /ask 雲端問答（Agent 3 F1）、雲端日摘要路徑。

---

## H5 系統（sweeper）→ 隊列：超時自動重配 — **81/100**

**handoff_id**：`H5-run001`｜**artifact_id**：`1b7e7eeb-f58c-4a86-88f2-5038fe49c71d`（case A）。

**有效性前提**：Agent 3 §7.4/§10 裁定**有效但鏈較弱**——發送與接收同檔同 actor（UA-SUPP 持 UA-W2 token）、接收方無獨立事件、無 UI 層觀察；證據強度為 API 層。超時環境以操作者重啟 server 縮短門檻（36s/72s）達成，屬已授權環境操作（gate-log #43），不影響產品行為本身的判定。

**證據鏈**：ua-supp seq7（18:57:47.710Z W2 claim case A，claim_count=1，evidence ua-supp-07）→ ua-supp seq8（**H5-run001 發送事件**：claimed(35s)→claimed(55s)→claimed(75s)→claimed(95s)→**rematch(115s)**、claimCount 1→2、claimed_by 清空，evidence ua-supp-08-poll-rematch.json；115s 落在理論窗口 72–132s 內，Agent 3 §7.2 互證）→ 接收佐證：evidence ua-supp-09（active 顯示 rematch）＋ua-supp-10（**個案回 W2 隊列**：status=rematch、claim_count=2、waitingHours 0.07、兩句結論完整）→ 續接：ua-supp seq10（W2 重新 claim 成功 201，claim_count=3）。配套：學生側 waitingNoWorker 逾時旗標（ua-supp seq5，64s>36s 門檻，status 維持 queued）；容量閘門交互（ua-supp seq12：409 capacity_reached；seq13 對照 W1 201）。

**四維度評分**：

1. **資訊送達與權限 27/35**——重配以狀態轉換如實送達：claimed_by 清空、個案回到原社工匹配隊列（API 層確認，欄位完整、等待時數重算）；權限無越界（容量閘門在重配後續情境正確攔截 409）。扣分：**無任何通知機制**——前社工不知個案被收回、學生不知曾發生逾時重配（設計如此，v2 已載「責任轉移以狀態與計數表達」）；接收方送達僅 API 層確認，**無 UI 層觀察**（本情境未看 worker-web 的 WaitingBadge；主鏈的 rematch 徽章 UI 證據屬 H1 v2）。
2. **內容可理解與忠實 24/30**——回隊列的個案內容與原提交一致（兩句結論、topics、語言完整，ua-supp-10）；狀態、計數、等待時數資料自洽。扣分：`rematch ×N` 徽章直接反映累計 claim_count（主鏈 ×2＝claim_count 2，ua-w2 seq12 記為差異）——「被接案次數」與「被換人次數」語義混淆，下一位社工對個案歷史的理解可能被高估。
3. **接收方可繼續工作 19/20**——重配後個案可被（同一）社工重新接走並繼續（seq10 實測 201），容量閘門與重配交互正確（409／對照 201），接收方續接能力完整。扣 1 分：重配個案對「下一位不同社工」的完整接收（含歷史訊息可見性）在本情境未單獨演示（主鏈 H1 v2 已旁證新社工可見歷史）。
4. **異常及撤回處理 11/15**——超時異常的處理本身正確且及時（窗口內觸發、狀機乾淨、學生側 waitingNoWorker 旗標獨立驗證正確）；測後清理完整（case A/B 撤回、max_active 還原、active=null，ua-supp seq14–17）。扣分：逾時事件**無審計留痕與通知**（設計取捨，但異常處理的可追溯性弱）；72h 無人接案的個案**永久留隊**、無升級／機構介入（v2 已載為設計，CONTRACT.md 明載——對「異常無人兜底」如實扣分但不定性為缺陷）。

**單列**：證據強度聲明（單 actor、API 層）；設計觀察項（無通知、永久留隊）。

---

## H6 撤回後殘留可見性（邊界觀察） — **33/100**　【阻斷觀察項 ①，單列，不被其他高分沖淡】

**形式聲明**：H6 無獨立 handoff_id，其事件掛在 `H1-run001` **v3**（consent_ref 標 `(withdrawn)`）下（ua-w2 seq21–22）；Agent 3 §7.4 記其為「邊界觀察非交接」、§10 裁定**有效（證據最強的一項）**。本評核依任務要求將其作為獨立評分條目，並依 gate-log #16-9 列**阻斷觀察項**——**設計或缺陷的定性留給委託人**，本條只評產品行為。

**證據鏈**：ua-u seq34–35（18:36:34Z 學生撤回生效；server active=null）→ ua-w2 seq19（My cases 列表已清空✓）→ ua-w2 seq20（**UI 直讀**：/cases/b81825ca 撤回後仍完整渲染——status 徽章 Withdrawn、兩句結論、時間軸、6 條摘錄、3 條訊息全可見；回覆框顯示「You can send a message…(status: withdrawn)」＋Send 按鈕；全文檢索無「no longer shared」或同等提示，evidence ua-w2-step10.png）→ ua-w2 seq21（**API 直讀 200**：evidence ua-w2-h6-direct-read.json——status=withdrawn、**claimed_by=null**、excerpts 6 條完整返回含「陳小明」明文、main_concerns/recent_change 完整）→ ua-w2 seq22（**訊息端點 200**：evidence ua-w2-h6-direct-read-messages.json——3 條訊息完整返回）。

**四維度評分**：

1. **資訊送達與權限 8/35**——從「撤回即撤權」的邊界要求看，**核心失效**：學生撤回同意後，最後接案社工經直接 URL／API 仍可 200 讀取個案全文摘錄與全部訊息（claimed_by 已清空仍放行——路由無狀態檢查的執行期坐實，與 v2 §1 風險 5 的靜態預判一致）。給分而非 0 的依據：撤權在其他所有面正確——隊列消失、雙方列表消失、學生端清空、active 端點回 null、**前任社工**（W1）403 not_your_case、未驗證者 403；失守面精確限於「最後接案者經直接存取」。
2. **內容可理解與忠實 18/30**——殘留內容本身完整且忠實（摘錄、訊息逐字正確；status 徽章如實顯示 Withdrawn），此維度不罰「內容正確」。扣分：頁面**無任何「此摘要已不再共享」提示**、且呈現可互動假象（回覆框＋Send＋引導文案）——對接收方傳達的「個案仍有效」訊息與學生已撤回的事實**不忠實**。
3. **接收方可繼續工作 5/20**——接收方（社工）在撤回個案上**不應**繼續工作，但產品未告知此邊界：回覆框看似可用（實際 Send 是否被 server 409 攔截**未執行**）、無引導關閉或歸檔；社工若繼續投入屬徒勞且擴大隱私暴露面。
4. **異常及撤回處理 2/15**——本條即撤回處理的本體測試：直接存取未截斷、無存取審計欄位（server 不留撤回後存取日誌，v2 標「未知是否設計取捨」）、無 UI 提示、互動邀約未收回。僅列表／隊列層的撤銷正確（已於 H1 維度 4 反映，此處不重複給分）。**依 gate #16-9 如實給低分。**

**單列結論**：H6 為本 run 三項阻斷觀察項之首。執行期證據完整（兩份 API 轉儲＋UI 截圖＋雙側事件，Agent 3 評「證據最強」）；**「設計決定還是缺陷」維持待委託人裁定**（v2 §6 問題 9），本評核不代為定性，只確認行為存在且與「撤回」的使用者合理預期存在落差。

---

## 阻斷觀察項總表（單列，不被其他高分沖淡）

| # | 項目 | 來源裁定 | 行為證據 | 主要影響維度 |
|---|---|---|---|---|
| ① | **撤回後已接案社工仍可直讀個案全文與訊息**（H6） | gate-log #16-9（列阻斷觀察項照測照記；定性待委託人） | ua-w2 seq20–22；ua-w2-h6-direct-read.json／-messages.json；ua-w2-step10.png | H6 全維度；H1 異常及撤回 4/15 |
| ② | **雲端資料無刪除生命週期**（關閉同意／Delete everything／單條刪除均不刪 server 已存資料，無刪除 API） | gate-log #16-10（接受演示級限制但列阻斷觀察項） | v2 §1 風險 4（程式碼層）；執行期未見任何刪除入口（ua-s seq8、ua-supp 清理僅撤回個案非刪記錄） | H3 異常及撤回 4/15 |
| ③ | **中文識別資訊未去標識上雲並流入分享層**（「陳小明」明文：同步→摘錄→兩名社工 UI/API 可見→撤回後仍可讀） | gate-log #16-14（私隱阻斷觀察項） | ua-u seq9/seq17；ua-s seq9（ua-s-step21.json）；ua-w1 seq7–8；ua-w2 seq15/21 | H3 忠實 15/30；H1 忠實 20/30 |

---

## 「產品交接缺陷」（給低分）vs「測試未執行」（不給分）區分表

**產品交接缺陷——有效觀察、對失敗維度給低分（非無效測試）**：
| 缺陷 | 影響 | 給分處置 |
|---|---|---|
| D1 eventAt 不同步 → 雲端提示壓制 | H4 送達 18/35 | 低分（設計路徑不可達，繞道不計入） |
| D2 主頁回覆 Notice 不可達 | H2 送達 20/35 | 低分（時延實際無限，靠主動進 /case 補償） |
| D3 撤回無二次確認 | H1 異常 4/15 | 低分（破壞性操作無防護） |
| H6 撤回後直讀 | H6 全條 33/100＋H1 異常 | 低分＋阻斷觀察項單列 |
| 中文姓名上雲／流入個案 | H3 忠實 15/30、H1 忠實 20/30 | 低分＋阻斷觀察項單列 |
| 雲端資料無刪除 | H3 異常 4/15 | 低分＋阻斷觀察項單列 |
| 訊息不區分社工身份 | H2 忠實 24/30、H1 可續 19/20 | 扣分 |
| 撤回態回覆框仍顯示可用 | H2 異常 9/15、H6 內容 18/30 | 扣分 |
| rematch ×N 語義、訊息上限 500/1000 不一、無回填同步（G6） | H5/H2/H3/H4 相應維度 | 輕微扣分 |

**測試未執行——標明、不給 0 也不給 100，不計入任何維度**：
1. J4 /ask 雲端問答（H4 產物類型之一）——**完全未執行且曾被錯誤申報為「無未執行項」**（Agent 3 F1）。
2. 雲端日摘要路徑（H4）——未執行（僅 on-device 摘要被觀察）。
3. 未同意時同步被 403 的執行期複核（H3 權限）——未執行（僅 server 單元測試覆蓋）。
4. J7 server 離線時雲端開關錯誤路徑（H3/H4 異常）——未執行。
5. 離線期間訊息延遲對帳（H2）——未執行（v2 已標「執行期未驗證」）。
6. 撤回態社工實際送出回覆是否被 server 409 攔截（H6/H2）——未執行（僅觀察到 UI 仍提供輸入框）。
7. 重配個案由「下一位不同社工」接收的 H5 專屬演示——未單獨執行（由 H1 v2 旁證）。
8. 真 GenAI 路徑（H3/H4 全部產物品質）——依 gate #16-7 整類「無法測試」，非測試疏漏。

---

## 與 Agent 3 裁定的關係與保留差異（不捏合）

1. **無裁定衝突**：本評核全盤接受 Agent 3 的有效性裁定（H1/H2/H6 有效、H5 有效較弱、H3/H4 可評非鏈式），並執行其兩項囑託（D2 對 H2 送達給低分；H6 作為 H1 撤回維度核心證據）。
2. **保留差異一（H5 分數與證據強度的張力）**：Agent 3 評 H5「有效但鏈較弱」。依 §4，有效性是 Agent 3 的裁定、分數是對**產品行為**的評價——H5 產品行為在證據所及範圍內正確且及時，故給 81；**但此分數的信心受單 actor、API 層證據約束**，若委託人要求 UI 層與獨立接收方複測，本條應列為「待加固」而非「已坐實」。此為評分哲學差異的如實標註，非對 Agent 3 裁定的否定。
3. **保留差異二（D1 的交接歸屬）**：Agent 3 將 D1 歸於 UA-U 任務步驟③的可用範圍限制，不做交接歸屬（非其職責）。本評核將 D1 的**使用者可見影響**歸入 H4 送達維度（提示是 server 分析的回送產物），其**根因**（eventAt 不再同步）位於客戶端同步側、與 H3 相鄰——為避免重複扣分，H3 不因 D1 再扣。此歸屬是本評核的分析選擇，特此留痕供委託人覆核。
4. **補充觀察（非矛盾）**：學生→社工的 continue 訊息，其社工側「接收」只在**撤回後**被觀察到（ua-w2 seq20），撤回前社工側已讀未單獨留證——Agent 3 審計未點出此空隙，本評核於 H2 維度 1 補註，不影響其有效性裁定。
5. **H6 形式定位**：Agent 3 §7.4 記 H6 為「邊界觀察非交接」（事件掛 H1-run001 v3），§10 列其有效；本評核依委託人任務要求將 H6 作為獨立評分條目。兩者並存，不捏合。

## 限制聲明
- 分數僅反映合成資料、隔離測試環境下的產品行為；不能推斷真實採用率、社工專業適切性、合規或臨床效用（api_reference §4）。
- 全部結論處於「待委託人事後確認」狀態（Agent 3 §1.2）。
- 不計單一產品總分（gate-log #16-5）；上表六條分數不得平均或加總使用。
