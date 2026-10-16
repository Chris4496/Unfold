# 交給其他模型／agent

從 `README.md` 和 `SKILL.md` 開始，按相對路徑讀所需 references。資料夾名稱不影響使用；Skill 名稱仍是 software-journey-evaluator。任何能閱讀 Markdown 的模型都可執行，不依賴 Codex、特定模型／供應商、API 金鑰或全域設定。

可用的起始指令：

> 依此資料夾 SKILL.md 工作，產品是我指定的項目。Agent 1 先讀有授權的代碼／文件，提出產品理解、將建立幾個使用者 agent、每人的背景／處境／動機／目標與情境，再交我確認。核對本輪執行條件，列限制、處理選項與結論影響，再確認我的選擇；兩關明確確認前不要派角色。「完成整輪」不能跳過這兩關。不跑全面功能驗收、不修改產品。角色自然使用後完成觀察、交接分析、圓桌及報告，最後統一整理每輪獨立的靜態 Dashboard。不讀 archive，不要求我先填產品介紹或研究規格。

Python 3.9+ 標準庫輔助可選：`prepare` 整理來源，`validate-report` 檢查 schema 2 的人數／角色提案，`validate-start` 檢查兩關紀錄與逐項選擇。它們不執行模型、啟動角色、測試產品或提供 server；結構通過不證明人類批准真實，須核對原始訊息。

角色需要 UI 操作能力與沒有分析歷史的獨立會話。能力不足先呈限制、選項及影響供用戶決定；不能事後補批。替代輸入只能按用戶同意的方式執行，例如打字代替原本會說出的話，不安排 mic 失敗情境。

分享新版時只需 `README.md`、`SKILL.md`、`PORTABLE.md`、`references/`、`scripts/`、`tests/` 與 `assets/`。不帶 archive、test-runs、瀏覽器資料或產品源碼。測試資料需另外明確指定才讀。
