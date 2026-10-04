# Skill 運作驗證報告：software-journey-evaluator（run-001）

> 這份是**給 skill 作者**的 meta 層報告：你的 skill 是否「以你預想的狀態運行」。產品發現另見 `final-summary.md`。

## 總結論

**核心機制全部如設計運作**，且本次 run 對 skill 做了一次真實壓力測試：審批關卡、角色分工、模型路由、事件契約、驗證器、有效性標籤、阻斷項單列、環境/產品故障分離——每項都有正向證據。同時發現 **5 個值得改進的設計空隙**（見 §3）。

## 1. 逐項驗證（設計意圖 → 實際行為）

| 設計 | 結果 | 證據 |
|---|---|---|
| Gate 1：報告未確認前不得啟動後續 | ✅ v1 呈交後完全停止；v1→v2 重大更改凍結重評 | gate-log #10/#11 |
| Gate 1 被「概括授權」通過時 | ⚠️ 按委託人指示通過，但 skill 無「概括授權」概念；Agent 3 如實評註效力受限 | gate-log #13/#16；agent3 §1.2 |
| 主 agent 不代替專職 agent | ✅ 主 agent 全程只做轉交/派發/匯集/留痕；F1–F4 錯誤被 Agent 3 抓出後認領不竄改 | gate-log #47 |
| Agent 2 不預設建 MCP | ✅ 31 步全判「不需要」、工程項 0、無工程啟動 | mcp-decision-card.md |
| 委託人主張≠已實作證據 | ✅ 十項主張逐項回碼核實（9 實作/1 部分） | journey-report-v2 裁定表 |
| Pro/Flash 為層級非型號＋誠實聲明 | ✅ 每份報告含實際路由與「近似」標註；環境不支援時留痕 | v2 §5；final-summary §2 |
| 事件契約＋example.py 驗證 | ✅ 110 條事件全過驗證器（每階段即時驗證） | 各階段 validator exit=0 |
| 交接不得私下假裝成功 | ✅ UA-W1 在 Approve 後才派、UA-W2 在 rematch 後；Agent 3 時序互證確認 | agent3 檢查點 4/5 |
| 無效結果不計分；部分有效不給貌似完整總分 | ✅ Agent 3 明確拒用自評分作任務分 | agent3-validity-audit.md |
| 阻斷項不被高分沖淡 | ✅ Agent 4 三項阻斷單列、H6=33 獨立呈現 | agent4-handoff-review.md |
| 產品故障 vs 環境故障分離 | ✅ 5 件環境故障（429/session 污染/攔截/getUserMedia/RN Web click）全部歸類正確，無一誤記為產品問題 | agent3 §7 核對 |
| 未實作功能記「無法測試」不假設成功 | ✅ 15+ 項逐條留痕 | final-summary §6 |
| 環境不支援時明示限制不捏造 | ✅ Agent 3 事後審核模式、即時監控缺失均已註明 | gate-log 開檔；agent3 標頭 |

## 2. 本次 run 對 skill 的壓力測試（計畫外收穫）

- **UA-S 主動停機請示**（發現 session 污染）：證明「證據不可信時停止」的紀律可被模型執行——這是 skill 最有價值的行為證據。
- **D1 繞道裁定**：skill 未明文規定「使用者繞道」（user workaround）的記錄方式，本次以「如實標記繞道＋成功判準記部分達成」處理，運作良好。
- **Agent 3 抓到主 agent 三個錯**（時標估算、事件數誤計、F1 漏核）：監控層對主 agent 的制衡**實證有效**。

## 3. 建議改進的設計空隙（給 skill 的修訂建議）

1. **「概括授權」沒有定義**：加入「委託人可預先概括授權通過關卡，但須逐關卡記錄為效力受限、結論可推翻」的明文條款（本次以 gate-log #13 即興處理）。
2. **使用者繞道（workaround）無記錄規範**：建議在 api_reference §3 增「繞道事件」標記欄位（如 `workaround: true`＋原路徑受阻原因），並在 §4 明確繞道路徑的成功判準降級規則。
3. **gate-log 時標規範**：主 agent 留痕應要求 `date` 實測（本次 F2：估算時標偏移 93 分鐘）。可在 SKILL.md 主 agent 職責加「留痕 timestamp 須實測」。
4. **階段性任務的完成申報核對**：UA-U「未執行項：無」漏報 J4（F1）——建議事件契約增「任務卡步驟↔事件覆蓋對照」要求，或由 Agent 3 的檢查點明文加入「申報 vs 覆蓋核對」（本次 Agent 3 主動做到了，可內建）。
5. **handoff_id 覆蓋率**：H3/H4 未掛 ID（F6）——契約可改為「凡跨角色/跨程序資料流動皆須掛 handoff_id」，不只「角色交接」。

## 4. 環境層備註（非 skill 問題）

openai-codex 被擋 → kimi-k3 唯一路由；modelScope 無 session 級覆寫（臨時放行近似）；agent-browser `--session-name`≠隔離、字面命令被子代理環境攔截（改用二進位路徑）。這些已沉澱為本 run 的操作手冊（見各 UA 最終訊息 §環境）。
