# AgentOS

**Windows 上的 AI Agent 生命週期管理器**

安裝、執行、協調你的 AI agents — 無需技術背景。

![AgentOS Screenshot](docs/orchestrator.png)

---

## 功能

### 🎯 Agent Orchestrator
輸入任務，系統自動分析並分配給最適合的 Agent 執行。支援 Hermes、OpenCode、Filesystem 多個 Agent 協作。

### 🗂️ Notebook
多筆記本管理，Markdown 即時預覽。內建 AI 功能：
- **筆記對話** — 針對筆記內容提問
- **摘要生成** — 一鍵生成重點摘要
- **標籤提取** — AI 自動分析關鍵字並加入標籤

### 🏛️ LLM Council
多 Agent 議事系統。五個角色（Builder、Optimizer、Curator、News、Supervisor）從不同角度分析問題，Chairman 綜合輸出最終建議。

### 🧠 UMP 統一記憶協議
SQLite 共享記憶層，讓所有 Agent 共用同一份記憶資料庫。支援跨 Agent 任務橋接。

### 📚 Agent 收藏庫
管理本機安裝的 AI Agent，支援從 GitHub 匯入、啟動、停止、查看日誌。

### 🔬 研究模式
從新聞、學術論文、YouTube、GitHub 等多個來源同步搜尋，自動生成結構化報告。

---

## 安裝

### 前置需求

| 軟體 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+（推薦 20） | 核心執行環境 |
| npm | 9+ | 套件管理 |
| Ollama | 最新版 | 本地 AI 模型（可選） |
| Python | 3.8+ | Hermes 任務監聽器（可選） |

### 快速開始

```bash
git clone https://github.com/zorrokurro/agent-os.git
cd agent-os
npm install
npm run dev
```

### 設定 OpenRouter（AI 功能必要）

1. 前往 [openrouter.ai](https://openrouter.ai) 申請 API Key
2. 開啟 AgentOS → 設定
3. 在 AI Provider 欄位填入 API Key

### 啟動 Hermes 任務監聽器（可選）

如果你有安裝 [Hermes](https://github.com/zorrokurro/hermes)，可以啟動橋接服務讓 AgentOS 與 Hermes 溝通：

```bash
python task_listener.py
```

---

## 架構

```
AgentOS (Electron)
├── Frontend (React + TypeScript + Tailwind)
├── Backend (Electron Main Process)
│   ├── Agent Manager — Agent 生命週期管理
│   ├── Orchestrator — 任務分析與分配
│   ├── UMP Hub — SQLite 共享記憶層 (port 7700)
│   ├── Research Engine — 多來源搜尋
│   └── Council Service — 多模型議事
└── task_listener.py — Hermes 橋接服務
```

---

## 技術棧

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Electron, Node.js
- **資料庫**: SQLite (UMP Hub)
- **AI**: OpenRouter API, Ollama
- **打包**: electron-builder

---

## 開發

```bash
# 開發模式
npm run dev

# 型別檢查
npm run typecheck

# 打包
npm run build
```

---

## 授權

MIT License

---

## 相關專案

- [Hermes](https://github.com/zorrokurro/hermes) — 多 Agent 協作系統，可與 AgentOS 橋接
