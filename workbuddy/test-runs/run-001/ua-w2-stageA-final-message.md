# UA-W2｜社工（第二人，合成）— 階段 A 最終回報

- **run_id**：run-001
- **journey_version**：v2-approved
- **task_id**：UA-W2-stageA
- **範圍**：階段 A「註冊 → 待驗證閘門核對」（J8 前半段），完成後停止，等待操作者帶外翻轉 verified。

## 一、逐步結果

| # | 步驟 | 結果 |
|---|------|------|
| 1 | /register 註冊（合成資料，觀察表單行為） | ✅ 完成 |
| 2 | 自動登入核對＋token 匯出（/tmp/ua-w2-token.txt，chmod 600） | ✅ 完成 |
| 3 | 待驗證閘門 UI 核對（/queue、/cases、/profile） | ✅ 完成 |
| 4 | 待驗證閘門 API 核對（GET /api/worker/queue，channel=API） | ✅ 完成 |
| 5 | 重複註冊核對（POST /api/workers/register 同 email） | ✅ 完成 |
| 6 | 階段 A 停止，等操作者翻轉 verified | ⏸ 等待操作者（未執行階段 B） |

無失敗步驟、無未執行步驟（除按計劃停止的階段 B）。

## 二、註冊結果

- **成功**。註冊 email：**`synthetic.worker2@unfold.test`**（供操作者翻轉 verified 用）。
- UI network log：`POST /api/workers/register → 201` → `POST /api/workers/login → 200`（自動登入）→ `PATCH /api/workers/me → 200`（語言／專長／容量落庫）。
- 提交後自動登入成立：頂欄顯示「Synthetic Worker Two」＋ `unverified` 徽章；localStorage 存在 key `unfold.worker.token`（值不回報），已匯出至 /tmp/ua-w2-token.txt（-rw-------）並以 /api/workers/me 驗證可用。
- server 端 /api/workers/me 核對：`verified=false`、`languages=[zh-HK, en]`、`expertise=[general]`、`max_active=3`、`organisation=Test NGO（合成）`，與表單輸入完全一致。
- 表單行為觀察：預設勾 zh-HK＋general、容量預設 5；容量欄位 min=1 max=20，填 25 時 HTML5 `rangeOverflow=true`（原生驗證擋提交），上限行為正常。

## 三、VerificationPending 雙端核對（J8 核心判準）

### UI（channel=UI）
| 路由 | 結果 |
|------|------|
| /queue | ✅ 被擋：URL 停留 /queue，渲染 VerificationPending 頁（h1「Verification pending」，點名帳號未驗證，提示可先到 Profile 更新偏好），無任何隊列資料（截圖 ua-w2-step03.png） |
| /cases | ✅ 被擋：URL 停留 /cases，同樣渲染 VerificationPending，無個案列表（截圖 ua-w2-step04.png） |
| /profile | ✅ 仍可進入且表單可編輯：顯示 VERIFICATION=pending verification，偏好表單與 server 一致；未實際儲存修改（截圖 ua-w2-step05.png） |

### API（channel=API）
| 請求 | 預期 | 實際 |
|------|------|------|
| GET /api/worker/queue（Bearer token） | 403 not_verified | ✅ HTTP 403 `{"error":"not_verified"}` |
| GET /api/worker/cases/active（順帶核對） | 403 not_verified | ✅ HTTP 403 `{"error":"not_verified"}` |

**雙端閘門結論：未驗證態 UI（RequireVerified）與 API（requireVerifiedWorker）皆正確攔截，個人資料頁按設計保持可用，符合 UA-W2 卡成功判準「未驗證態雙端（UI＋API）皆被擋」。**

## 四、重複註冊核對

- 請求：`POST /api/workers/register`，JSON body 同原註冊資料（同 email）。
- 預期 409；**實際 HTTP 409 `{"error":"email_already_registered"}`**，與 J8 記載一致。前端 Register.jsx 備有對應錯誤文案分支。

## 五、操作者待辦（階段 B 前置）

- 請在測試 DB 將 **`synthetic.worker2@unfold.test`** 的 `verified` 旗標翻轉為 true（帶外驗證，記錄為環境操作）。
- 本 agent 的 browser session `ua-w2` 保持開啟（現停留 /profile，登入態有效）；token 存於 /tmp/ua-w2-token.txt（chmod 600）供階段 B curl 使用。

## 六、證據清單

- 事件紀錄：`events/ua-w2.json`，**11 筆**（sequence 1–11 單調遞增、timestamps 單調、evidence_ref 均指向實存檔案或 "none"，已以腳本驗證）。
- 截圖 **5 張**：
  - ua-w2-step01.png — 空白註冊表單（預設值）
  - ua-w2-step02.png — 填妥的合成資料（提交前）
  - ua-w2-step03.png — 註冊後落 /queue → VerificationPending
  - ua-w2-step04.png — /cases → VerificationPending
  - ua-w2-step05.png — /profile 可編輯（pending verification）

## 七、環境問題

- **產品問題：無。** 所有預期行為（201/200/403/409、閘門、表單驗證）與 CONTRACT／J8 一致。
- **環境問題：無新增。** 按任務指示直接使用 agent-browser 二進位路徑（`--session ua-w2`），未觸發已知的字面 `agent-browser` 命令攔截坑；5174 proxy → 8787 正常。
