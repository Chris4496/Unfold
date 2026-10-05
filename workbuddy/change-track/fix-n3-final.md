# fix-n3-final — docs-N lane：文件測試計數更新（run-002 N3）

## 1. 實際點算結果

**方法**：分兩步驗證——
1. 文字點算：計算各測試檔中「行首（可含縮排）的 `test(`」出現次數（`grep -cE '^\s*test\('`），排除 `.test(`（RegExp 方法呼叫）造成的誤計。
2. 執行驗證：實際跑 `npm test`，以 node test runner 回報的 `tests / pass` 數字核對。

| 範圍 | 檔案 | 點算數 |
|---|---|---|
| server (`unfold/server/src/*.test.js`，`node --test`) | auth 5, consent 8, db 2, genai 30, routes-student 20, routes-worker 16, routes-workers 2, sweeper 6 | **89**（`server/test/` 為空目錄，無額外檔案） |
| client (`unfold/src/**/*.test.ts`，`tsx --test`) | deidentify 8, organise 3, pcm 6, support 1, api 11 | **29** |

執行核對：
- client `npm test` → `tests 29, pass 29, fail 0` ✅
- server `npm test` → `tests 89, pass 89, fail 0` ✅

**注意（點算陷阱）**：若用 `\btest\(` 計算，client 會誤得 31——`unfold/src/lib/organise.test.ts` 第 16/18 行有兩處 `new RegExp(...).test(shared)` 的 RegExp 方法呼叫，並非測試定義。server 各檔剛好無此模式，故兩種算法同為 89。正確數字以 runner 為準：**client 29 / server 89**。

## 2. 修改明細（僅改數字，未 commit）

### `/Users/luo/MmM/unfold/README.md`（1 行）
- L87（Tests 段，Client 行）：`28 unit tests` → `29 unit tests`
- L88（Server 行）：原文已是 `89 tests`，與實際一致，**無需改動**。

### `/Users/luo/MmM/unfold/docs/Interim_Progress_Report_Questionnaire.md`（3 行）
- L55（Q13 現況描述）：`The client carries 28 unit tests and the server 77` → `31…89` 初改後再修正為 `29 unit tests and the server 89`
- L63（Q15 里程碑 M4）：`28 client and 77 server unit tests pass` → `29 client and 89 server unit tests pass`
- L79（Q19 資源段）：`(28 client tests, 77 server tests)` → `(29 client tests, 89 server tests)`

（過程說明：第一輪編輯曾依 `\btest\(` 誤值寫入 31，經 runner 核對發現後已全部改為 29，最終檔案中無 31 殘留。）

## 3. 其他過時數字檢查

- `grep -nE '\b(28|77)\b'` 於兩份文件：**修改後 0 筆匹配**（exit=1），無遺漏。
- 另檢查 `\b31\b`（防止第一輪誤值殘留）：0 筆匹配。
- Questionnaire 內其他含 test 的行（L41 問卷題目、L95 user testing 時程）均非計數描述，無需改動。
- 覆蓋範圍描述：README L87 client 列出的 de-identification / classification / prompt rules / transcript handling / API client 對應 deidentify、organise（topic/attribute 偵測即 classification）、support、pcm、api 各檔，仍成立；README L88 server 覆蓋描述與 8 個測試檔主題相符。均未改動。

## 4. 殘留風險

- 無。文件數字（29/89）與 `npm test` runner 實際回報一致；`server/test/` 空目錄若未來加入測試，文件需再同步。
