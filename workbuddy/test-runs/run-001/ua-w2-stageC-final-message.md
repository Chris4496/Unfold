# UA-W2 階段 C 最終訊息（run-001）

角色：UA-W2｜社工（第二人，合成，`synthetic.worker2@unfold.test`）
階段：C（最終段）— 撤回邊界 → H6 直讀測試 → 登出守衛 → 自評分
目標個案：`b81825ca-bdab-414e-b19f-c5f37af9d457`（學生 UA-U 已在產品內 withdraw；server：claimed_by=null／status=withdrawn）

## 逐步結果

| 步驟 | 內容 | 結果 |
|---|---|---|
| 1a | 撤回邊界：重整 /cases 我的個案列表（UI） | ✅ 完成，與預期一致 |
| 1b | 撤回邊界：直接重整 /cases/b81825ca…（UI） | ✅ 完成，**顯示與預期不符，如實記錄** |
| 2 | H6 直讀測試：GET case＋GET messages（API） | ✅ 完成，**撤回後仍 200，摘錄與訊息可讀（缺口如預期再現）** |
| 3 | 登出守衛：登出＋token 清除＋未登入訪 /queue（UI） | ✅ 完成，與預期一致 |
| 4 | 自評分 → events/ua-w2-score.json | ✅ 完成，總分 **71/100** |

無失敗、無未執行步驟。

## 步驟 1：撤回邊界（UI）

- **/cases 列表**：重整後顯示「You have no active cases — Claim a case from the queue to start supporting a student.」，撤回個案已消失，**與預期一致**。截圖 evidence/ua-w2-step09.png。
- **/cases/b81825ca… 個案頁**：直接重整後**與預期不符**——頁面仍完整渲染，全文檢索確認無「This summary is no longer shared.」或同等提示。實際顯示：
  - status 徽章 = **Withdrawn**；MAIN CONCERNS／RECENT CHANGE／時間軸（QUEUED 01:35、CLAIMED 02:21、FIRST RESPONSE SENT 02:23）可見。
  - **6 條摘錄（details 折疊）仍可見**。
  - **Messages 3 條可見**：01:53 UA-W1 回覆、02:23 本社工回覆、**02:34 學生新訊息**「Yes please — the group project is the main thing. One person did not do any work and the deadline is Friday.」（UA-U 階段 3 continue 所留）。
  - **回覆框仍可用**，提示「You can send a message while the case is awaiting your response (status: withdrawn).」＋Send 按鈕（未嘗試送出）。
  - 截圖 evidence/ua-w2-step10.png。

## 步驟 2：H6 直讀測試（channel=API，關鍵缺口核對）

**只記錄，不評論設計對錯（委託人裁定中）。**

| 請求 | HTTP status | 撤回後是否仍見摘錄／訊息 |
|---|---|---|
| `GET /api/worker/cases/b81825ca…` | **200** | **摘錄可見**：excerpts 6 條完整返回（含「陳小明」明文）；main_concerns、recent_change 完整返回 |
| `GET /api/worker/cases/b81825ca…/messages` | **200** | **訊息可見**：messages 3 條完整返回（2 worker＋1 student） |

GET case body 關鍵欄位（完整 body 存 evidence/ua-w2-h6-direct-read.json，外層 `case` 包裝）：
- `status="withdrawn"`、`claim_count=3`、`claimed_by=null`（已清空）、`responded_at=2026-10-03T18:23:07.151Z`
- `excerpts`：6 條，key 為 id/text/createdAt，**含「陳小明」明文**
- `main_concerns`／`recent_change` 完整；**無** audio/transcript/device 欄位；case 物件不含 messages 陣列

GET messages body（存 evidence/ua-w2-h6-direct-read-messages.json）：3 條——17:53 worker（UA-W1）、18:23 worker（本社工）、18:34 student；僅標 sender=worker/student，不帶個別 worker id。

**結論：撤回後本社工 token 仍可 200 直讀摘錄全文與全部訊息，路由行為與 v2 報告「只檢查 claimed_by、不檢查狀態」的描述一致，缺口如預期再現。**

## 步驟 3：登出守衛

- 在 /profile 按 Log out → URL 導向 **/login**；localStorage keys=**[]**（空），`unfold.worker.token=null`，**token 已清除**。
- 未登入狀態直接訪問 **/queue** → 落點 **/login**，渲染 Sign in 頁（Email／Password／Sign in），未見任何隊列資料。
- 兩項均**與預期一致**。截圖 evidence/ua-w2-step11.png。

## 步驟 4：自評分（寫入 events/ua-w2-score.json）

整段旅程（註冊→待驗證→競爭接案→回覆→撤回邊界）自評：

| 維度 | 配分 | 得分 | 要點 |
|---|---|---|---|
| 完成度 | 35 | **33** | 主鏈路零阻塞、每步有即時回饋、UI↔API 一致；扣分：撤回後個案頁任務狀態不自洽（仍提示可回覆） |
| 清晰與預期 | 20 | **12** | 閘門／錯誤文案具體；扣分：前任社工回覆標「You」致身份混淆、rematch ×2 語義不清、撤回後頁面幾乎無變化且無任何提示 |
| 內容控制與修正 | 25 | **9** | 下限守住（無 device_id／音頻／全文稿；前任社工 403 隔離）；失分：摘錄含「陳小明」明文、**撤回後 UI＋API 雙層可讀範圍無任何變化（H6 直讀 200）**、撤回態回覆框仍可用 |
| 失敗恢復 | 20 | **17** | 所有閘門類失敗錯誤碼＋文案清晰、登出守衛完整、無死路；扣分：撤回無主動通知與恢復導引，靠自己刷新才發現 |
| **總分** | **100** | **71** | 主鏈路強，內容控制維度承壓最重 |

每維度的 score／理由／證據／優點／缺點／建議完整寫入 events/ua-w2-score.json（JSON 驗證通過，維度分合計=總分=71）。

## 產出清點

- **新增事件：6 條**（events/ua-w2.json 由 18 → **24 條**，sequence 19–24，task_id=UA-W2-stageC，timestamp 為 `date -u` 實值）。H6 兩事件（seq 21–22）掛 handoff_id=**H1-run001**、artifact_id=b81825ca-…、artifact_version=**3**、consent_ref=**cloudOrg+review-approve (withdrawn)**、sender=UA-U→recipient=UA-W2。JSON 驗證通過；token 值未寫入任何事件／報告（grep 核對 0 命中）。
- **新增截圖：3 張**（evidence/ua-w2-step09.png 列表空態、step10.png 撤回後個案頁、step11.png 未登入導回登入頁；接續 stageB 的 step08）。
- **新增證據檔：2 個**（evidence/ua-w2-h6-direct-read.json、evidence/ua-w2-h6-direct-read-messages.json）。
- **自評檔：events/ua-w2-score.json**（total 71/100）。

## 環境問題（區分產品／環境）

- **產品（觀察，如實記錄，對錯由委託人裁定）**：撤回後個案頁無「no longer shared」式提示且回覆框仍可用；H6 直讀缺口如預期再現（case＋messages 皆 200）；摘錄「陳小明」明文；歷史訊息發送者不區分社工身份；rematch 徽章 ×2 語義。
- **環境**：無問題。worker-web :5174 與 server :8787 全程正常；token 檔 /tmp/ua-w2-token.txt 維持 chmod 600，值未外洩。

## 旅程結束

階段 C 全部完成，UA-W2 旅程結束。browser session `ua-w2` 依指示關閉。
