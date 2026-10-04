# UA-U｜大學生（合成）— 階段 2 最終回報

Run: run-001 ｜ Case: b81825ca-bdab-414e-b19f-c5f37af9d457 ｜ Session: ua-u（保持開著，停在 /case）

## 逐步結果

| # | 步驟 | 結果 |
|---|------|------|
| 1 | 回主頁等待觀察 Notice「A social worker replied」 | **完成 — Notice 未出現**（詳下） |
| 2 | 進 /case 核對狀態、社工回覆內容、markReplySeen | **完成**（全部符合預期） |
| 3 | curl /api/cases/active 核對 server 狀態 | **完成**（replied、1 條 worker 訊息） |
| 4 | 選「Ask for someone else」→ rematch → curl 複核 | **完成**（server 回隊列、claimCount 1→2） |
| 5 | 不選 continue、不 withdraw、保持 session | **完成**（停於 /case「Waiting for a reply」） |

## Notice 有無出現與時延

- **未出現**。server 端 17:53:34 已 replied；本人 18:03:54 回主頁，停留 >2 分鐘（18:04:51、18:06:18 兩次複查），主頁始終只顯示「View shared summary」按鈕，無 Notice（截圖 ua-u-step19.png）。**時延實際為無限**。
- 原因（程式碼層面核實）：主頁無輪詢；Notice 顯示條件依賴本機 store `openCase.status==='replied' && !seenReply`（app/index.tsx:74），而 `refreshCaseFromServer` 僅由 /case 掛載時觸發（app/case.tsx:22-24，每 15 秒輪詢）。使用者停在主頁或 /shared 時本機狀態永不刷新 → **主頁 Notice 在此流程下不可達**。回覆只能在主動進 /case 後看到。已記為產品觀察項/缺陷候選（events seq 22）。

## markReplySeen 驗證結果

- **生效**。進 /case（18:06:33）掛載即觸發 refresh：本機 status queued→replied；/case 的 useEffect 立即對 seenReply=false 個案執行 markReplySeen，localStorage 核實 `seenReply=true`。
- 回主頁（18:07:10）Notice 不出現（截圖 ua-u-step21.png）——已讀標記的狀態機層面驗證通過。
- 附註：因上述 Notice 不可達問題，「Notice 出現→已讀消失」的使用者可見閉環未實際發生。

## 社工回覆內容核對

- /case heading「A social worker replied」，社工卡內容與預期**逐字一致**：「Thank you for sharing this. It sounds like the group project situation has been weighing on you. Would you like to tell me more about what happened?」（截圖 ua-u-step20.png；API /messages 亦核對一致，createdAt=2026-10-03T17:53:34.969Z）。
- 讀取前後 server 狀態不變（GET 無副作用）。

## rematch 後 server 狀態

- 18:08:06 點「Ask for someone else」。
- **status=queued**（注意：非任務書字面預期的 `rematch`——server routes-student.js:486-492 的 rematch 轉換實作為 status='queued'、claimed_by=NULL、claim_count+1；實際語義=回隊列，正確）。
- **claimCount：1 → 2**；claimed=false；waitingNoWorker=false；messages=1（worker 歷史保留）；updatedAt=2026-10-03T18:08:06.853Z 與點擊時間一致。
- 本機 store 同步：status=queued、claimCount=2、seenReply=true；/case 顯示「Waiting for a reply」+ 僅剩 Withdraw sharing（截圖 ua-u-step22.png）。

## 事件與截圖

- **事件：新增 6 條**（seq 22–27，檔案總計 27 條，sequence 單調遞增已驗證）。讀回覆事件（22–25）掛 handoff_id=H2-run001、artifact_version=1、sender=UA-W1→UA-U；rematch 事件（26–27）掛 handoff_id=H1-run001、artifact_version=2、sender=UA-U→UA-W2；consent_ref 均為 cloudOrg+review-approve。
- **截圖：新增 4 張**（ua-u-step19/20/21/22.png）+ 5 份 API JSON 證據（cases-active ×3、messages ×2，均存 evidence/）。

## 環境問題

- **產品**：① 主頁 Notice 不可達（上述，缺陷候選，非本階段新發現的操作障礙但為本階段核心觀察）；② 任務書預期字面 status=rematch 與 server 實作（rematch→queued）不符——屬預期表述問題，產品行為語義正確。
- **環境**：無新問題。沿用已知繞道：agent-browser 對 RN Web Pressable 用 JS dispatchEvent 點擊（stage 1 已記錄）；未呼叫字面 `agent-browser` 命令，全程用 AB binary 路徑；token 值未外洩（僅以長度 64 核實存在）。

## 階段 3 待辦（提醒，非本階段執行）

等 UA-W2 接案回覆後：進 /case 讀新回覆 → 選 continue（或依任務書）→ 對話 → withdraw。session ua-u 保持開著，停在 /case「Waiting for a reply」。
