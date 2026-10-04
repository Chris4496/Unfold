# skill-lane 最終報告：software-journey-evaluator 文件修訂

## 修改區塊清單

### 檔案一：`workbuddy/software-journey-evaluator/SKILL.md`（3 處）

1. **「角色與職責」主 agent 一條**（修訂 3）：加入「關卡與流程留痕的 timestamp 必須以實際指令（如 `date`）取得，不得估算」。
2. **「工作流與停止關卡 → A. 旅程報告，必須先停」**（修訂 1）：在步驟 3 之後新增一段概括授權條款——委託人可預先對多個關卡作概括授權；主 agent 逐關卡記錄為「概括授權通過（效力受限）」；以此通過的結論一律標「待委託人事後確認，可推翻」，覆核前不得稱為正式確認。
3. **「工作流與停止關卡 → C. 角色模擬、監控、交接評核」**（功能 A＋B）：原步驟 9（彙總）順延為步驟 11，中間插入：
   - 步驟 9 **C-探索階段（探索型角色扮演）**：先驗證型、後探索型、分屬不同 agent；Agent 1 須在旅程報告新增 Persona 卡章節；隔離規則（禁讀旅程報告／程式碼／repo 文件／預期值、只用產品 UI、全新環境身份）；產出敘事旅程日誌＋摩擦點清單，不給數字分、標代理推斷。
   - 步驟 10 **C-圓桌階段（使用者 agents 聚集討論）**：位置在 Agent 4 評核之後、最終匯總之前；參與者、書面多輪 round-robin 形式、resume 原 session、主 agent 只做信使、四條討論紀律，產出格式指向 api_reference。
   - 步驟 11 補一句：探索與圓桌產出以代理推斷與未驗證假設身份列入，不與實測證據混同。

### 檔案二：`workbuddy/software-journey-evaluator/references/api_reference.md`（6 處）

1. **§1 Agent 1 的審批前報告**（功能 A）：新增第 5 項「Persona 卡」（格式指向「C-探索階段」章節，明示不含程式碼、報告內容、任務步驟或預期值），原 5–7 項順延為 6–8。
2. **§3 事件紀錄契約第一段**（修訂 2＋5）：handoff 句由「涉及角色交接時」擴為「凡跨角色或跨程序的資料流動」，含單向流動（同步上雲、衍生產物回送），不限雙向交接；新增可選欄位 `workaround: true` 與 `workaround_reason`（原路徑受阻原因）。
3. **§3 檢查點清單**（修訂 4）：Agent 3 新增固定檢查點「任務卡步驟 ↔ 事件覆蓋對照」——逐步核對事件、核對子代理完成申報與覆蓋實際一致，防止漏做誤報。
4. **§4 使用者與交接分數首段**（修訂 6＋2 後半）：自評分拆為 (a) 執行品質分（現行四維度、0–100，並加入繞道降級規則：成功判準降為「部分達成」，不得視為原路徑通過）；(b) 使用者體驗推斷（不給數字分，逐條標「代理推斷，非真人 UX 證據」）。
5. **新增 §5、§6，舊 §5 順延為 §7**（功能 A＋B）：見下方新增章節標題；§7 最終匯總清單加入探索階段與圓桌階段產出，並註明兩者與實測證據分列。
6. **舊 §6 順延為 §8**（僅改標題編號，內容不變）。

## 新增章節標題

- `## 5. C-探索階段：Persona 卡與探索型角色扮演`（api_reference.md）
- `## 6. C-圓桌階段：使用者 agents 聚集討論`（api_reference.md）
- SKILL.md 未新增章節標題；兩個新階段以 C 節編號步驟 9、10 的粗體小標呈現（維持原有 1–11 連續編號結構）。

## 自查：六項修訂＋兩功能落地情況

| 項目 | 落地位置 | 狀態 |
| --- | --- | --- |
| 1. 概括授權條款 | SKILL.md A 節步驟 3 後新段 | ✅ |
| 2. 使用者繞道 `workaround`＋`workaround_reason`＋降級規則 | api_reference §3 首段、§4 (a) 段 | ✅ |
| 3. 留痕時標實測（`date`） | SKILL.md 主 agent 職責 | ✅ |
| 4. 覆蓋對照檢查點 | api_reference §3 檢查點清單末 | ✅ |
| 5. handoff_id 擴展（含單向） | api_reference §3 首段 | ✅ |
| 6. 自評分拆 (a)/(b) | api_reference §4 首段 | ✅ |
| A. C-探索階段（Persona 卡＋隔離規則＋產出） | SKILL.md C 節步驟 9；api_reference §1 第 5 項＋新增 §5 | ✅ |
| B. C-圓桌階段（位置／參與者／形式／信使／紀律／產出格式） | SKILL.md C 節步驟 10；api_reference 新增 §6；§7 匯總清單同步 | ✅ |

其他核對：兩檔無 `run-001` 字樣（通用性）；繁體中文與原有語氣、標點（「」／、／；／／）一致；`scripts/example.py` 零改動；未 commit、無暫存檔案。

## 規格含糊處的自行取捨

1. **功能 B 未指明落檔位置**：比照功能 A 的做法——流程位置、參與者、形式、信使角色與紀律寫入 SKILL.md C 節；產出格式（共識發現／爭議並存／未驗證假設／分角色優先級投票）寫入 api_reference 新增章節。
2. **修訂 1 嚴格限定在 SKILL.md A 節**：未同步改 api_reference §3 的關卡事件段（該段原本就要求關卡留痕），避免超出指定位置。
3. **新章節插入位置**：插在舊 §4 與舊 §5 之間（舊 §5/§6 順延為 §7/§8），使「最終匯總」維持在圓桌之後的敘事順序；§1 亦新增 Persona 卡項並順延編號。
4. **SKILL.md C 節呈現方式**：兩個新階段作為編號步驟 9、10（原 9 順延為 11），而非獨立小節，以保持原檔 1–N 連續步驟的結構慣例。
5. **「角色與職責」使用者 agents 一條未改**：規格指定功能 A 落於工作流 C 節；C 節步驟 9 已界定驗證型／探索型分工，足以消解「依已批准任務卡」與探索型開放式目標之間的表面張力。
6. **handoff 伴生欄位維持原 5 個必填**：單向流動亦填 `sender_role_id`／`recipient_role_id`（接收方填實際接收的程序或角色），與現行 validator 完全相容。

## 驗證

- `python3 scripts/example.py /tmp/skill-lane-validator-check.json`（自建含 `workaround` 新欄位＋單向 handoff 的兩筆合成事件）→ `Valid synthetic event records: 2`，exit=0，證明新欄位可選相容、validator 無需改動。
- `grep` 自查：六項修訂與兩功能的關鍵詞均在目標檔目標節出現；兩檔無 run-001 殘留。
- `git diff --stat`：僅兩個指定檔被我修改（run-001 目錄下的既有變更與未追蹤檔為先前實跑留下，非本次改動）；`git diff --cached` 為空，無暫存；未 commit。

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "僅修改指定的兩個檔案（SKILL.md 3 處、api_reference.md 6 處）；六項修訂與兩項新功能均落在規格指定章節；scripts/example.py 與其他檔案零改動；未寫入 run-001 專屬內容"
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "提供逐檔修改區塊清單、新增章節標題、八項自查對照表、validator 相容實測（exit=0）、grep 關鍵詞驗證、git diff/status 證據"
    }
  ],
  "changedFiles": [
    "workbuddy/software-journey-evaluator/SKILL.md",
    "workbuddy/software-journey-evaluator/references/api_reference.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "python3 scripts/example.py /tmp/skill-lane-validator-check.json",
      "result": "passed",
      "summary": "含 workaround 新欄位與單向 handoff 的 2 筆合成事件通過現行 validator（Valid synthetic event records: 2, exit=0），證明新欄位可選相容"
    },
    {
      "command": "grep 關鍵詞自查（概括授權／workaround／覆蓋對照／單向流動／執行品質分／使用者體驗推斷／Persona 卡／C-探索階段／C-圓桌階段／date）＋ run-001 殘留檢查",
      "result": "passed",
      "summary": "所有關鍵詞落在目標檔目標節；兩檔無 run-001 字樣"
    },
    {
      "command": "git status --porcelain / git diff --stat / git diff --cached --stat",
      "result": "passed",
      "summary": "我方僅改兩個指定檔；example.py 無 diff；暫存區為空；未 commit（run-001 既有變更非本次改動）"
    }
  ],
  "validationOutput": [
    "Valid synthetic event records: 2（exit=0）",
    "git diff --stat: SKILL.md +8 行區塊、api_reference.md +55 行區塊；scripts/example.py 無 diff",
    "grep: SKILL.md 概括授權×1、Persona 卡×1、C-探索/圓桌×2、date×1；api_reference workaround×2 處、覆蓋對照×1、單向流動×1、Persona 卡×3、C-探索/圓桌×3；run-001 殘留 0"
  ],
  "residualRisks": [
    "功能 B 落檔位置為規格未明言處，已比照功能 A 處理（SKILL.md 記流程、api_reference 記產出格式），如委託人另有偏好可微調",
    "SKILL.md「角色與職責」使用者 agents 一條仍寫「依已批准任務卡」，與探索型開放式目標的表面張力由 C 節步驟 9 界定化解，未改該條以守範圍",
    "run-001 目錄下先前的未追蹤檔與 gate-log.md 修改保持原樣，未納入本次任何提交"
  ],
  "noStagedFiles": true,
  "diffSummary": "SKILL.md：主 agent 職責加時標實測、A 節加概括授權段、C 節插入步驟 9/10（探索＋圓桌）原 9 順延 11；api_reference.md：§1 加 Persona 卡項、§3 擴 handoff＋繞道欄位＋覆蓋對照檢查點、§4 自評分拆＋繞道降級、新增 §5/§6 兩章、舊 §5/§6 順延 §7/§8 並更新匯總清單",
  "reviewFindings": [
    "no blockers"
  ],
  "manualNotes": "六項修訂與兩功能皆已落字並通過 validator 相容實測；規格含糊處（功能 B 落檔、新章節插入位置、呈現方式）已在上節逐條說明取捨；未 commit，等 reviewer 驗收。"
}
```
