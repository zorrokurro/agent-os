# Roadmap

這份文件記錄 AgentOS 的開發方向，幫助你判斷專案是否符合你的需求、是否值得關注。

時程不是承諾，AgentOS 目前是個人維護的專案，優先順序會隨開發者的實際需求調整。

---

## 已完成

- [x] Fusion-Loop 大腦：多模型合成推理（Fusion）+ 自我精煉（Self-Refinement Loop）
- [x] 雙 Provider 架構：本地 Ollama 與雲端 API（OpenRouter / Anthropic / OpenAI）可同時設定、各角色獨立選擇
- [x] UMP Hub：本地 SQLite 共享記憶層，跨 Agent 讀寫
- [x] GitHub 一鍵安裝：貼連結自動分析 + clone + 安裝
- [x] 系統 Agent 掃描：偵測本機已安裝的 pip / npm / docker / 自訂目錄 agent
- [x] Notebook：類 NotebookLM 介面，AI 生成內容內嵌對話串
- [x] LLM Council：多模型投票辯論
- [x] Discord 整合：遠端下任務、收通知

---

## 規劃中

### 手機遠端控制
透過手機 App（或現有 Discord bot 擴充）在不在電腦前時也能對 AgentOS 下任務、看結果。對需要長時間離開主機（旅行、外出工作）的使用情境特別重要。

### UMP Hub 多人共享
目前 UMP Hub 是單機 SQLite，未來規劃讓多個人共用一個記憶層，適合小團隊或工作室場景——多人協作時 Agent 的記憶跟任務歷史能互通，而不是每人各自孤立。

### Hermes Orchestrator 完整接線
`ToolRouter` 已經寫好並可解析 DISPATCH 格式，但 Hermes 的 system prompt 還沒改成強制輸出該格式。等 Fusion-Loop 大腦需要呼叫底層 Agent 工具時會回頭接上。

---

## 探索中（方向未定）

### Agent 市集
讓其他開發者發布的 Agent 能被所有 AgentOS 用戶一鍵安裝，類似套件管理器的概念。目前還在評估：
- 需要怎樣的索引/發布機制（中央 registry？GitHub topics 慣例？）
- 跨平台相容性怎麼處理 —— 目前開發環境只有 Windows，無法驗證 macOS / Linux 上的 Agent 相容性
- 品質與安全把關機制

歡迎在 [Issues](https://github.com/zorrokurro/agent-os/issues) 討論這個方向，你的使用情境會幫助這個功能的設計。

### 跨平台支援
目前僅支援 Windows。macOS / Linux 支援需要社群協助測試與適配，個人開發者單靠 Windows 環境無法驗證。

---

## 怎麼影響 Roadmap

- 開 Issue 描述你的使用情境跟需求
- 如果你在用 macOS / Linux，回報相容性問題對跨平台支援特別有幫助
- 想參與某個方向的開發，見 [CONTRIBUTING.md](CONTRIBUTING.md)
