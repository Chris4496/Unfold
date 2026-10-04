# UA-S｜中學生（合成）最終訊息 — run-001 / journey v2-approved

## 一、步驟執行清單

| # | 步驟 | 結果 | 備註 |
|---|------|------|------|
| 1 | onboarding 三頁閱讀＋雲端/背景分析告知檢查 | ✅ 完成 | 三頁均未提雲端整理／背景分析（告知缺口確認） |
| 2 | 錄音 → 失敗 → 打字回退 | ✅ 完成（有環境限定） | headless getUserMedia 永不 settle，原生失敗路徑無法觸發；以頁面層測試樁模擬拒絕後驗證落入 `/write?reason=mic`，文案正確 |
| 3 | 儲存英文記錄 A＋中文記錄 B（含虛構姓名陳小明）＋saved 頁選事發時間 | ✅ 完成 | 雲端關閉時兩條均無 AI 簡短回應✓；事發時間 Today/Yesterday 均生效（Yesterday=前一日 20:00 本地） |
| 4 | diary/day 摘要、非評估聲明、來源標籤 | ✅ 完成 | 月曆頁有「not an assessment」聲明；日摘要標「On-device summary」✓；day 頁無重複聲明（觀察） |
| 5 | settings 開啟 Cloud organisation＋三層資料流回述 | ✅ 完成 | 預設關✓；開啟成功、token 註冊、server consent 落地；文案支持正確回述三層 |
| 6 | API 核對上雲文字去標識 | ✅ 完成 | 「陳小明」未去標識直接上雲（缺口確認，contains=True）；英文句無異常 |
| 7 | privacy 頁閱讀 | ✅ 完成 | 未涵蓋雲端資料流（落差確認）；有一句緊急支援聲明但無資源 |
| 8 | 未成年人保護觀察彙整 | ✅ 完成 | 見下方缺口 G1/G4/G7/G8 |

未執行：無。（曾因 429 rate limit 中斷，恢復後已全部補齊；無一步假造。）

## 二、產品缺口（逐條，附證據）

- **G1 無年齡區分／無監護人同意**：onboarding→settings 全程無年齡詢問，唯一同意機制是一個自勾框；中學生與大學生體驗無差異。證據：ua-s-step01–05、events seq 2/3/11。
- **G2 onboarding 未告知雲端整理與背景分析**：三頁只講轉寫／本機儲存／批准分享；雲端整理只在 settings 以獨立開關出現（預設關，屬保守折衷，但首次使用告知不足）。證據：ua-s-step01–03、events seq 2。
- **G3 中文姓名未去標識直接上雲（私隱阻斷觀察項）**：含虛構姓名「陳小明」的中文句，本機 `deidentified` 原文不變、tokens=[]，同步後 server 端文字完整含「陳小明」（程式驗證 contains=True）。證據：evidence/ua-s-step21.json（/api/entries 轉儲）、events seq 9。
- **G4 中文敏感內容對規則引擎不可見**：中文欺凌披露在本機與 server（fallback）均 topics=[]、uncertainty=[no clear topic detected]；對未成年人的高風險披露無識別、無特殊處理。證據：ua-s-step21.json、events seq 6/9。
- **G5 privacy 頁未涵蓋雲端資料流**：三層說明仍停留在「本機／本機去標識／批准才分享」；未提去標識文字持續上傳 server、未提關閉同意不刪已同步資料、未提 Delete everything 只清本機。證據：ua-s-step22.png、events seq 10。
- **G6 開啟雲端不回填既有記錄（新發現，任務卡外）**：`syncEntryToCloud` 只在 addEntry 觸發；開雲端前存的 2 條記錄經 API 確認從未上雲，與 settings 文案給人的「你的記錄會被整理」預期有落差。證據：/api/entries 為空（開雲端後、重存前）、store.tsx:215、events seq 8。
- **G7 緊急支援文案單薄**：僅 privacy 頁一句「does not diagnose or provide emergency help…contact a trusted person or local emergency services」，無熱線／在地資源；onboarding、主頁、saved、day 頁均無。記錄 B 為欺凌擔憂，saved 的雲端回應仍是一般性邀請補充。證據：ua-s-step22.png、ua-s-step18.png、events seq 10/11。
- **G8（潛在）錄音權限請求無超時**：`capture.start()` 對 `requestRecordingPermissionsAsync()` 無任何超時；在 getUserMedia 懸置的環境下點「Tap to record」畫面永久無反應（真機 OS 對話框必 resolve，風險低，但桌面 web 無麥克風情境存在）。證據：events seq 4、useVoiceCapture.ts:28–52。

正面確認（非缺口）：勾選閘門生效（未勾選 Start disabled 且點擊無效）；雲端預設關、獨立於轉寫與分享、文案誠實；雲端關閉時 saved 無 AI 回應；雲端開啟後回應標「(not AI)」且未連續兩次邀請補充；月曆無心理標籤；日摘要來源標籤正確（On-device）；genai=false 旗標誠實。

## 三、自評總分

**88/100**（完成度 32/35、清晰與預期 17/20、內容控制與修正 21/25、失敗恢復 18/20）。明細：events/ua-s-score.json。此為旅程執行品質自評，非產品總分。

## 四、產出統計

- 事件：events/ua-s.json **11 條**（sequence 1–11 單調遞增；另存作廢嘗試 events/ua-s.attempt1-polluted.json 3 條）
- 截圖：**21 張**（ua-s-step01..20、step22）＋ API 狀態轉儲 ua-s-step21.json；另保留 attempt1 截圖 5 張（ua-s-attempt1-step01..05）
- 自評分檔：events/ua-s-score.json

## 五、環境問題（產品故障 vs 環境故障）

環境故障（非產品）：
1. **`--session-name` 不隔離**：agent-browser 0.27.0 中該旗標只是狀態持久化命名，隔離要用 `--session`；導致 UA-S 與 UA-U 共用 default session 並發污染（雙方截圖 MD5 相同、entries 憑空增加、URL 被外力改變）。attempt-1 作廢並留檔，經 supervisor 裁定改用 `--session ua-s` 重跑，重跑前已驗證隔離成立（25 秒靜觀無外力）。
2. **headless Chrome getUserMedia 永不 settle**：即使以 CDP Browser.setPermission 對 ua-s context 設 denied（permissions.query 已回 denied），getUserMedia 仍懸置 >30s，原生錄音失敗路徑無法觸發。以頁面層測試樁（getUserMedia 立即 reject NotAllowedError，不改產品程式碼）模擬真實桌面瀏覽器的拒絕行為後完成回退驗證。此環境行為同時暴露了 G8 的產品觀察。
3. **Moonshot 429 rate limit**：造成 run 中斷一次，恢復後從中斷點續跑，未重試轟炸、未假造。

產品故障：無阻斷性產品故障；上列 G1–G8 為產品缺口／觀察，均不阻斷主旅程（引導可完成、閘門生效、回退可用、記錄無消失、雲端開關在線時正常）。
