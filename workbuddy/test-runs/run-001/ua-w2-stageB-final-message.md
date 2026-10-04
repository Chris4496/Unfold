# UA-W2 階段 B 最終訊息（run-001）

角色：UA-W2｜社工（第二人，合成，`synthetic.worker2@unfold.test`）
階段：B — 驗證後隊列 → 競爭接案 → 403 補測 → 接走 rematch 個案 → 回覆
目標個案：`b81825ca-bdab-414e-b19f-c5f37af9d457`

## 逐步結果

| 步驟 | 內容 | 結果 |
|---|---|---|
| 1 | 驗證後重進 /queue（UI） | ✅ 完成 |
| 2 | 競爭接案（API 近並發，UA-W2 先發） | ✅ 完成，結果與編排預期一致 |
| 3 | 403 not_your_case 補測（API，UA-W1 token） | ✅ 完成 |
| 4 | 個案頁核對：歷史訊息可見性＋可見性邊界（UI） | ✅ 完成 |
| 5 | 送出合成回覆＋curl 複核落庫 | ✅ 完成 |
| 6 | 階段 B 停止，session 保持開啟 | ✅ 已停止（停在 /cases/b81825ca…） |

無失敗、無未執行步驟。

## 步驟 1：驗證後隊列

- 操作者帶外翻轉已生效：`GET /api/workers/me` → `verified=true`。
- /queue 可正常進入（h1=Case queue，不再是 VerificationPending），顯示 Active cases: 0 / 3。
- 目標個案可見，欄位：period「Notes from Thu 1 Oct to Sun 4 Oct」、status=Queued、language=zh-HK、**0.8h waiting**（API waitingHours=0.76）、topics=[academic, group, sleep]、main_concerns「Coursework deadlines and a one-person group project are wearing me down」、Queued 4 Oct 2026 01:35、Claim 按鈕。
- **rematch 徽章：顯示 rematch ×2**（任務預期 ×1；數字與 API claim_count=2 一致，徽章可能直接反映累計接案次數而非 rematch 次數）。如實記錄為與任務描述的差異，未自行補救。
- API 複核：status=queued、claim_count=2。recent_change 欄位存在於 API 但 UI 卡片未顯示。
- 截圖：evidence/ua-w2-step06.png。

## 步驟 2：競爭接案（兩個 status code）

| 請求 | HTTP status | body 摘錄 |
|---|---|---|
| UA-W2（先發） | **201** | `status=claimed`、`claim_count=3`、`claimed_at=2026-10-03T18:21:52.283Z`、`responded_at=null`（完整 body 存 /tmp/w2-claim.json） |
| UA-W1（+0.05s） | **409** | `{"error":"already_claimed"}`（存 /tmp/w1-claim.json） |

與編排預期完全一致（UA-W2 先發得案）；原子接案鎖生效，claim_count 由 2 遞增為 3。

## 步驟 3：403 not_your_case 補測

- UA-W1 token `GET /api/worker/cases/b81825ca…` → **HTTP 403**，body=`{"error":"not_your_case"}`（存 /tmp/w1-getcase.json）。
- 與預期完全一致：所有權轉移後前任社工無法再讀取個案。

## 步驟 4：歷史訊息可見性觀察（個案頁 UI）

- **歷史訊息串對新接案社工可見（設計如此，記為觀察）**：Messages 區可見 UA-W1 於 01:53 的回覆「Thank you for sharing this. It sounds like the group project situation has been weighing on you. Would you like to tell me more about what happened?」。
- **額外觀察（產品層）**：UI 將前任社工的回覆標示為「You · 4 Oct 2026, 01:53」，不區分發送社工身份；API messages 端點亦僅標 `sender=worker`、不帶個別 worker id。新接案社工易把前任回覆誤認為自己發的，建議記為產品觀察項。
- **可見性邊界（與前任核對一致）**：6 條摘錄（details 折疊）可見；頁面無 device_id 字樣、無 audio 元素、無全文稿／逐字稿。Excerpt 2 展開可見「陳小明」明文（已知缺口）。
- 截圖：evidence/ua-w2-step07.png（Excerpt 2 展開態）。

## 步驟 5：送出合成回覆＋複核

- UI 送出：「Thanks for waiting. I'm a different social worker and I've read the earlier message. How would you like to continue?」→ 頁面狀態轉 **Replied**，FIRST RESPONSE SENT = 4 Oct 2026 02:23，Messages 顯示 2 條。
- curl 複核：`GET case` → status=**replied**、claim_count=3、responded_at=2026-10-03T18:23:07.151Z；`GET …/messages` → **2 條**（17:53 UA-W1 回覆＋18:23 本社工回覆，sender 均為 worker）。
- 截圖：evidence/ua-w2-step08.png。

## 個案當前狀態（階段 B 結束時）

`b81825ca-bdab-414e-b19f-c5f37af9d457`：status=**replied**、claim_count=**3**、持有人=**UA-W2**、messages=**2**、responded_at=2026-10-03T18:23:07.151Z。等待 UA-U 階段 3（continue→withdraw）由編排接手。

## 產出清點

- **新增事件：7 條**（events/ua-w2.json 由 11 → 18 條，sequence 12–18，task_id=UA-W2-stageB）。接案事件掛 handoff_id=H1-run001、artifact_version=2、sender=UA-U→UA-W2；回覆事件掛 handoff_id=H2-run001、artifact_version=2、sender=UA-W2→UA-U。JSON 驗證通過。
- **新增截圖：3 張**（ua-w2-step06/07/08.png，接續 stageA 的 step01–05）。
- browser session `ua-w2` 保持開啟（停在 /cases/b81825ca…）。token 檔 /tmp/ua-w2-token.txt、/tmp/ua-w1-token.txt 均維持 chmod 600，值未寫入任何報告。

## 環境問題（區分產品／環境）

- **產品（觀察，非阻塞）**：rematch 徽章顯示 ×2 與任務預期 ×1 不符（疑徽章直接顯示 claim_count）；歷史訊息發送者不區分社工身份（UI 標「You」、API 僅標 sender=worker）；「陳小明」摘錄明文可見（已知缺口，與前任核對一致）。
- **環境**：無問題。操作者帶外 verified 翻轉生效；兩端服務（:5174／:8787）全程正常。
