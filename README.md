# AgentOS

> 本地優先的 AI Agent 編排平台 — 在 Windows 上安裝、管理、串接多個 AI Agent，免寫程式碼。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg)](https://github.com/zorrokurro/agent-os/releases)
[![Electron](https://img.shields.io/badge/Electron-React%2BTypeScript-47848F.svg)](#技術棧)

AgentOS 讓你像裝軟體一樣安裝 AI Agent：貼一個 GitHub 連結，剩下的交給 AgentOS。內建 Fusion-Loop 大腦（多模型合成推理）、UMP Hub（跨 Agent 共享記憶）、可同時切換本地模型與雲端 API，全部跑在你自己的電腦上。

---

## 為什麼選 AgentOS

| | AgentOS | LangChain / LangGraph | AutoGPT 系列 | Ollama 單獨使用 |
|---|---|---|---|---|
| 安裝方式 | 點兩下安裝、GitHub 連結匯入 | 寫 Python 程式 | clone + 設定 .env | 命令列 |
| 多 Agent 協作 | ✅ 內建 Orchestrator + UMP Hub | 需自行架設 | 部分支援 | ❌ |
| 本地 + 雲端混用 | ✅ 同一介面切換 | 需自行寫切換邏輯 | 通常二選一 | 僅本地 |
| 多模型合成推理 | ✅ Fusion-Loop 大腦 | 需自行實作 | ❌ | ❌ |
| 圖形介面 | ✅ 完整 GUI | ❌ 純程式 | 部分有網頁介面 | ❌ |
| 跨 Agent 記憶共享 | ✅ UMP Hub (SQLite) | 需自行架設向量資料庫 | ❌ | ❌ |
| 目標用戶 | 非工程師也能用 | 開發者 | 開發者 | 開發者 |

AgentOS 的定位不是取代 LangChain 這類開發框架，而是**給不想寫程式碼的人一個能跑多 Agent 系統的桌面應用**。如果你已經會寫 Python 串 Agent，可能不需要 AgentOS；如果你想要「裝一個東西就能用」，這是為你做的。

---

## 核心功能

### 🧠 Fusion-Loop 大腦
![Fusion-Loop 大腦](docs/screenshots/fusion-loop-brain.webp)

AgentOS 內建多模型合成推理系統，作為所有任務的統一入口。

- **Fusion（橫向展開）**：同一個任務同時交給多個模型（本地或雲端皆可），由 Judge 模型分析共識、矛盾與盲點後合成最終答案
- **Self-Refinement Loop（縱向收斂）**：合成草稿完成後，Critic 模型評估準確性、完整性、清晰度、可行性，不達標則交給 Refiner 修改，最多迭代 3 輪
- **雙 Provider 架構**：本地模型（Ollama）與雲端 API（OpenRouter / Anthropic / OpenAI）可同時設定，每個角色（Panel A/B、Judge、Critic、Refiner）獨立選擇要用哪個

### 📦 一鍵 Agent 安裝
![GitHub 安裝器](docs/screenshot-github-installer.png)

貼上 GitHub 連結，AgentOS 自動分析 repo 結構、偵測技術棧（Node / Python）、安裝依賴。也支援掃描本機已安裝的 Agent（pip / npm / docker / 自訂目錄）一鍵納入管理。

### 📓 Notebook
![Notebook](docs/screenshot-notebook.png)

類似 NotebookLM 的筆記與資料來源整合介面。匯入 PDF / 網址 / 文字，AI 生成的摘要、大綱、標籤直接內嵌在對話串裡，不用切換分頁尋找結果。

### 👥 LLM Council
![LLM Council](docs/screenshot-llm-council.png)

多個模型同時針對一個問題投票、辯論，取得比單一模型更穩健的結論。

### 🔀 Orchestrator
![Orchestrator](docs/screenshot-orchestrator.png)

任務調度層，將工作分配給對應的 Agent 或工具執行，而非讓單一模型獨自完成所有事情。

### 🗄️ UMP Hub（記憶協議）
跨 Agent 共享的本地 SQLite 記憶層，所有 Agent 的對話、任務、推理過程都能互相讀取，不是各自孤立的黑盒子。

### 其他
- **Discord 整合**：透過 Discord bot 遠端下任務、收通知
- **收藏庫**：管理已安裝 Agent 的啟動/停止/日誌/設定
- **研究模式**：深度資料蒐集與分析任務

---

## 生態系

| 專案 | 說明 |
|---|---|
| [Ollama](https://ollama.com) | AgentOS 的本地推理引擎，需自行安裝 |
| [OpenRouter](https://openrouter.ai) | 雲端 API 路由，支援數百種模型 |
| 你的 Agent | 任何符合 `manifest.json` 規範（見 [docs/agent-manifest-schema.json](docs/agent-manifest-schema.json)）的專案都能被 AgentOS 匯入管理 |

想把你的 Agent 專案做成可被 AgentOS 一鍵安裝？參考 [manifest schema](docs/agent-manifest-schema.json)，加上 `manifest.json` 即可被自動偵測。

---

## 安裝

### 下載

前往 [Releases](https://github.com/zorrokurro/agent-os/releases) 下載最新版 `AgentOS-Setup.exe`，雙擊安裝。

### 需求

- Windows 10 / 11
- [Ollama](https://ollama.com) 運行中（本地模型用，可選 — 純雲端 API 模式不需要）
- 若使用雲端 API：OpenRouter / Anthropic / OpenAI 的 API Key

### 從原始碼建置

```bash
git clone https://github.com/zorrokurro/agent-os.git
cd agent-os
npm install
npm run build
```

需求：Node.js 18+、npm 9+、Python（部分 Agent 依賴）、Git

---

## 技術棧

- **前端**：React 18 + TypeScript + Vite + Tailwind
- **桌面框架**：Electron
- **記憶層**：SQLite（sql.js，in-process，無需外部資料庫）
- **本地推理**：Ollama
- **雲端 API**：OpenRouter / Anthropic / OpenAI
- **打包**：electron-builder（NSIS installer）

---

## 架構

```
┌─────────────────────────────────────────┐
│  Renderer（React）                       │
│  Fusion-Loop 大腦 / Notebook / Library   │
└───────────────┬───────────────────────────┘
                 │ IPC
┌───────────────┴───────────────────────────┐
│  Electron Main Process                    │
│  AIRouter（Ollama ↔ 雲端 API 統一路由）   │
│  UMP Hub（SQLite 共享記憶）               │
│  Installer（GitHub clone / 系統掃描）     │
└───────────────┬───────────────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
     Ollama   OpenRouter  已安裝 Agents
```

---

## 貢獻

歡迎 PR 和 Issue。詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT
