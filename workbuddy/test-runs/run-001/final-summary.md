# Unfold 軟件旅程評估：最終匯總（run-001）

> 依 `references/api_reference.md` §5 格式由主 agent 匯集。主 agent 只匯集、指明來源、列出矛盾，未臨場替換任何子代理結論。**全部結論處於「待委託人事後確認」狀態**（Gate 1 為睡前概括授權，見審批紀錄）。

## 1. 評估日期、版本與審批紀錄

- 評估期間：2026-10-03 晚 ～ 2026-10-04 清晨（run-001）
- 基線報告：`journey-report-v2.md`（基線程式碼 git `598dcce`）；v1 因產品重大更改（委託人新增十項功能）依技能凍結，由 v2 取代
- 審批紀錄（全部留痕於 `gate-log.md`，共 50+ 事件）：
  - v1 呈交後停止於 Gate 1（合規）；v1→v2 凍結重評（合規）
  - **Gate 1（v2）＝委託人睡前概括授權通過（gate-log #13/#16），非逐關卡知情確認，效力受限**：§6 問題 7–14 由主 agent 從嚴代決（無 key 不連網、阻斷觀察項、不計單一總分等），逐條留痕、委託人可推翻
  - Agent 2 判定「不需要 MCP」（31 步全判）→ 工程分支依技能跳過，無需工程批准；事後核對無任何工程啟動
  - Agent 3 對關卡效力的評註：全結論在委託人覆核前處「可推翻」狀態

## 2. 實際使用的模型／路由

| 角色 | 路由表建議 | 實際執行 | 偏離說明 |
|---|---|---|---|
| 主 agent | Flash（下輪） | moonshotai/kimi-k3（本會話） | 已啟動無法事後更改 |
| Agent 1（v1） | Pro | kimi-k3:high（researcher） | 推理層級近似 Pro，非保證型號 |
| Agent 1（v2） | Pro | kimi-k3:xhigh（worker） | 改派 worker：researcher 的 web 工具契約在本環境觸發終態錯誤 |
| Agent 2 | Pro | kimi-k3:xhigh（worker） | 近似 Pro |
| Agent 3 | Flash | kimi-k3:high（worker） | **依 model-routing.md 升級觸發**（存在日誌矛盾：attempt1 污染、D1 繞道）從 Flash 調整，gate-log #45 留痕 |
| Agent 4 | Pro | kimi-k3:xhigh（worker） | 近似 Pro |
| UA-S / UA-U / UA-W1 | Pro | kimi-k3:xhigh（worker） | 近似 Pro |
| UA-W2 | Flash | kimi-k3:xhigh（worker） | **偏離**：為統一管道未降級；判準機器可驗，品質風險低，留痕 |
| developer／reviewer | Pro | 未啟動（工程項 0） | — |

環境約束：openai-codex 被 Cloudflare 阻擋（事件 #4）；委託人指示本子代理只用 moonshotai/kimi-k3；pi-subagents 無 session 級 modelScope，以「臨時放行→派出→還原」近似（事件 #7/#8）。

## 3. 實際執行的角色與任務

4 個使用者 agent（UA-S、UA-U×3 階段、UA-W1×2、UA-W2×3）＋1 個補充情境（UA-SUPP）＋1 個補測（UA-SUPP-2）；共 110 條契約事件，**全部通過技能自帶 `scripts/example.py` 驗證**；截圖 60+ 張、API 證據 30+ 份。
Agent 3 有效性裁定：任務級 有效 2（UA-W2、UA-SUPP）／部分有效 3（UA-S、UA-U、UA-W1）／無效 0；artifact 級無效 2（兩份 attempt1 污染留檔，處理正確）。

## 4. 逐項分數（全部「待委託人確認」；不計單一總分——權重未事前確認）

使用者 agent 自評（執行品質，非產品分）：UA-S 88、UA-U 88、UA-W1 89、UA-W2 71。
**Agent 4 交接評核**（H1–H6，逐條不平均）：

| 交接 | 送達/35 | 忠實/30 | 可續/20 | 異常撤回/15 | 總分 |
|---|---|---|---|---|---|
| H1 個案提交/接案/換人/撤回 | 33 | 20 | 19 | 4 | **76** |
| H2 回覆與雙向訊息 | 20 | 24 | 18 | 9 | **71** |
| H3 去標識同步 | 28 | 15 | 15 | 4 | **62** |
| H4 衍生產物回送 | 18 | 27 | 16 | 11 | **72** |
| H5 sweeper 超時重配 | 27 | 24 | 19 | 11 | **81** |
| H6 撤回後殘留可見性【阻斷】 | 8 | 18 | 5 | 2 | **33** |

## 5. 嚴重阻斷觀察項（單列，不被其他分數沖淡；定性留給委託人）

1. **H6 撤回後直讀**：撤回後最後接案社工仍可 200 直讀摘錄全文（含中文姓名明文）與全部訊息；UI 個案頁完整渲染、無「不再共享」提示、回覆框仍可用。失守面精確限於「最後接案者直接存取」（`routes-worker.js:209` 只檢查 claimed_by 不檢查狀態）。
2. **中文識別資訊上雲並流入分享層**：`deidentify.ts` 僅英文正則；「陳小明」原樣上雲→進入個案摘錄→兩名社工 UI/API 可見→撤回後仍可讀。另：中文敏感內容對規則引擎不可見（欺凌披露 topics=[]）。
3. **雲端資料無刪除生命週期**：關閉同意／Delete everything／單條刪除均不刪 server 已同步資料，無刪除 API；開啟雲端亦不回填既有記錄（G6）。

## 6. 已證實的優點與缺點（產品）

**優點（執行期實證）**：三層同意各自獨立且 server 強制（未同意 403）；社工雙端驗證閘門（UI+API）；接案原子鎖（201/409）；容量閘門 409＋對照 201；越權 401/403/404 正確；撤回後列表邊界即時正確；sweeper 兩種超時行為符合 CONTRACT（115s 實測落窗）；J4 伺服器路徑引用 2/2 逐字且無匹配誠實回答；genai=false 旗標全程誠實；英文識別資訊去標識無洩漏。

**缺點/缺陷（附證據等級）**：
- **D1（重大）**：`setEventTime` 不再同步 eventAt → server 背景分析永遠看不到跨天 → 雲端開啟時支援提示被壓制（端到端核實＋curl 證據）。
- **D2（重大）**：主頁「A social worker replied」Notice 不可達（refresh 僅 /case 掛載觸發）——回覆通知閉環斷裂。
- **D3**：Withdraw sharing 無二次確認（破壞性操作）。
- H6（阻斷項 1）；撤回後個案頁回覆框仍可用。
- 訊息不區分社工身份（UI 標「You」、API 無 worker id）；rematch 徽章顯示 ×2（=claim_count）語義；J4 fallback 相關性排序雜訊；學生訊息上限本機 500/server 1000、註冊容量 20/server 100 不一致；privacy 頁與 onboarding 未涵蓋雲端資料流（G2/G5）；文件（Questionnaire/README）滯後於程式碼；JWT_SECRET dev 預設、CORS `*`、裝置 token 永不過期（部署風險）。

**無法測試（逐項留痕，不給分）**：全部 GenAI 真實品質（無 key 不連網）；雲端刪除（無功能）；管理員驗證發放（無產品表面）；demo 模式回覆後分支（無入口）；跨記錄連結 UI（無消費端）；J4 UI 來源標籤段；雲端日摘要 UI；未同意 403 執行期複核；J3 刪除邊界、J7 server 離線開關、Delete everything 邊界；轉寫準確率；臨床適切性；真機行為。

## 7. 建議（按影響與修正成本排列）

1. **阻斷項先行**：H6 直讀加狀態檢查（一行級修改，`routes-worker.js:209` 加 `status` 白名單）＋撤回後 UI 隱藏內容並禁用回覆框——無論定性為設計或缺陷，與設定頁「可隨時撤回」的用戶預期衝突。
2. **去標識擴展至中文**（姓名/地址/電話常見格式）或在雲端開關文案明示中文識別資訊不保護；server 端考慮二次去標識。
3. **D1 修復**：`setEventTime` 後觸發重新同步（或在 server 接受客戶端 eventAt 更新）。
4. **D2 修復**：主頁掛載時也觸發 `refreshCaseFromServer`（或全域輪詢）。
5. **D3**：撤回加二次確認。
6. 雲端資料生命週期：關閉同意時提供「同時刪除雲端副本」選項（新 API）＋開啟時回填既有記錄。
7. 訊息附 worker 身分；rematch 徽章語義改為 rematch 次數；訊息上限與註冊容量前後端對齊。
8. 文件更新（README/Questionnaire 補上 server/worker-web 與 77+20 測試現況）；部署前處理 JWT_SECRET/CORS/token 輪換。

## 8. 仍需真人研究／專業審查的假設

代理模擬分數不代表市場、臨床或合規結論：未成年人保護安排（監護人同意流程應如何設計）、提示文案的臨床適切性、社工專業工作流程、GenAI 輸出品質（本輪全 fallback）、真實採用率——均需有資格人士驗證。

## 9. 來源與重跑方式

- 來源：`gate-log.md`（50+ 事件）、`journey-report-v2.md`、`mcp-decision-card.md`、`agent3-validity-audit.md`、`agent4-handoff-review.md`、5+2 份事件檔（110 條，validator 全過）、各 agent 最終訊息、60+ 截圖與 30+ API 證據（`evidence/`）
- 重跑：`workbuddy/test-runs/run-001/env/` 內的啟動參數（8787/獨立 DB/MOONSHOT_API_KEY= 強制 fallback/短超時變體）＋各 UA 任務卡（v2 §4）＋同一技能；模型路由表見 §2
- 保留的矛盾（不捏合）：Agent 3 vs Agent 4 對 H5 信心與 H6 形式定位的差異（見 agent4 §保留差異）；UA-U 的 F1 申報不實 vs J4 補測結果（互補不互斥）
