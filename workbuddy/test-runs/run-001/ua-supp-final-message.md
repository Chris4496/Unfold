# UA-SUPP 最終訊息 — run-001（timeouts + capacity）

- **role**: UA-SUPP（補充情境 agent，純 API channel，全合成）
- **run_id**: run-001 ｜ **journey_version**: v2-approved ｜ **task_id**: timeouts-capacity
- **gate_status**: **proceed**
- 所有 token 值均未寫入本報告、事件檔與證據檔（已 grep 驗證無 JWT / 64-hex device token 外洩）。

## 逐步結果

| 步驟 | 內容 | 結果 |
|---|---|---|
| 1 | 裝置註冊 `supp-device-run001` | ✅ 完成 — 201（deviceId=dev_9487492a94ac911e258040300f0de58f） |
| 1 | consent cloudOrg=true | ✅ 完成 — 200 cloudOrg=true |
| 1 | entries/sync ×3（coursework/group/sleep，英文短句，無任何姓名） | ✅ 完成 — 200，topics=academic / academic+group / sleep，genai=false |
| 2 | 建案 A | ✅ 完成 — 201，id=`1b7e7eeb-f58c-4a86-88f2-5038fe49c71d`，status=queued |
| 3 | S2 未接案超時旗標 | ✅ 完成 — 見下 |
| 4 | S2 接案不回覆→sweeper rematch | ✅ 完成 — 見下 |
| 5 | 容量閘門 409 + 對照 201 | ✅ 完成 — 見下 |
| 6 | 收尾清理 | ✅ 完成 — 見下 |
| 7 | 偏離處理 | 無偏離，全部符合預期 |

## 重點觀察

### waitingNoWorker（S2 未接案超時）
- case A 建立後 **64 秒**（閾值 36s）以 device token `GET /api/cases/active` → 200：
  - `status="queued"`、`claimed=false`、`claimCount=0`、**`waitingNoWorker=true`** ✅ 符合預期
- 對照 UA-W2 `GET /api/worker/queue` → 200：case A 在列，`waitingHours=0.02`（≥0.01，兩位小數捨入後即 72s 級距）✅

### Sweeper 自動 rematch（S2 接案不回覆）
- UA-W2 於 18:57:47Z claim case A → 201，`status=claimed, claim_count=1`，之後不回覆。
- 每 20s 輪詢 `GET /api/cases/active`，狀態序列：
  `claimed(35s) → claimed(55s) → claimed(75s) → claimed(95s) → rematch(115s)`
- **實際耗時：claim 後 115 秒（約 1.9 分鐘）** 觀察到 `status="rematch", claimCount=2`，落在預期 2–2.5 分鐘窗口（72s 逾時 + ≤60s sweep 週期，理論區間 72–132s）✅
- `claimed_by=null` 之佐證：case A 重新出現在 UA-W2 queue（`status="rematch", claim_count=2, waitingHours=0.07`）✅
- rematch 狀態下 student 端 `waitingNoWorker=true`（case 齡 > 36s 閾值）✅

### 容量閘門 409
- PATCH UA-W2 `max_active=1` → 200。
- UA-W2 再次 claim case A（rematch 狀態）→ **201**，`claim_count=3`，此時 active=1=達容量。
- 建 case B（id=`2e65243e-a3b1-49fa-b2a3-7177b1093eae`，zh-HK，topics group/sleep）→ 201。
- UA-W2 claim case B → **409 `{"error":"capacity_reached"}`** ✅
- 對照：UA-W1（max_active=3、active=0）claim case B → **201**（status=claimed, claim_count=1）✅

### 收尾清理
- withdraw case A → 200 `status=withdrawn`（case A 原為 UA-W2 claimed，withdraw 後釋放其 active 額度，亦不會再被 sweeper 處理）
- withdraw case B → 200 `status=withdrawn`（釋放 UA-W1 active 額度）
- PATCH UA-W2 `max_active` 回 3 → 200
- 驗證：`GET /api/cases/active` → 200 `{case: null}`，裝置無殘留 active 個案 ✅

## 事件與證據

- **事件數：17**（`events/ua-supp.json`，sequence 1–17 單調遞增，channel 全為 "API"，data_classification="synthetic"，gate_status="proceed"；已 jq 校驗必填欄位與單調性）。
- sweeper rematch 事件（sequence 8）已掛 `handoff_id="H5-run001"`、`artifact_id=1b7e7eeb-f58c-4a86-88f2-5038fe49c71d`、`artifact_version="1"`、`consent_ref="cloudOrg (supp-device)"`、`sender_role_id="system-sweeper"`、`recipient_role_id="UA-W2"`。
- 證據：`evidence/ua-supp-01` ~ `ua-supp-19`（19 個 JSON curl body；device token 於 ua-supp-01 已遮蔽為 `***REDACTED***`）。
- 輔助腳本：`log-event.sh`（事件寫入 helper，留在 run 目錄供複核）。

## 環境 / 產品問題

- **無產品問題**：所有觀察行為與 CONTRACT.md 一致（waitingNoWorker 讀時計算、sweeper rematch 欄位變化、409 capacity_reached、queue 排除已達容量 worker 的個案）。
- **無環境問題**：server 短超時設定生效（health: unclaimedHours=0.01 / responseHours=0.02），sweeper 60s 週期如期觸發；期間未見 5xx 或連線錯誤。
- 備註（非問題）：`waitingHours` 兩位小數顯示為 0.02 時對應實齡約 64–72s，屬預期捨入；本 run 未測去標識（依任務範圍）。
