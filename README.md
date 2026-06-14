# AgentOS

**Windows 上的 AI Agent 生命週期管理器**

安裝、執行、協調你的 AI agents — 無需技術背景。

---

## 截圖

### GitHub 安裝器 — 貼上任何 GitHub 網址，一鍵安裝
![GitHub 安裝器](docs/screenshot-github-installer.png)

### Notebook — AI 筆記本，支援來源匯入與大綱生成
![Notebook](docs/screenshot-notebook.png)

### LLM Council — 多 Agent 議事，五個角色辯論，主席綜合結論
![LLM Council](docs/screenshot-llm-council.png)

### Agent Orchestrator — 輸入任務，自動分配給最適合的 Agent
![Orchestrator](docs/screenshot-orchestrator.png)

---

## 功能

### 🔧 GitHub 安裝器
貼上任何 GitHub 專案網址，自動分析技術棧（Node.js / Python），執行 git clone + 依賴安裝，一鍵完成。

### 🗂️ Notebook
多筆記本管理，Markdown 即時預覽。支援 PDF、網址、文字來源匯入。內建 AI 功能：
- **筆記對話** — 針對筆記內容提問
- **摘要生成** — 一鍵生成重點摘要
- **大綱生成** — 整合所有筆記與來源，生成階層式大綱
- **標籤提取** — AI 自動分析關鍵字並加入標籤
- **Obsidian 同步** — 雙向自動同步到 Obsidian Vault

### 🏛️ LLM Council
多 Agent 議事系統。五個角色（Builder、Optimizer、Curator、News、Supervisor）從不同角度分析問題，Chairman 綜合輸出最終建議。

### 🎯 Agent Orchestrator
輸入任務，系統自動分析並分配給最適合的 Agent 執行。透過 UMP Hub 橋接 Hermes、OpenCode 等 Agent 協作。

### 🧠 UMP 統一記憶協議
SQLite 共享記憶層，讓所有 Agent 共用同一份記憶資料庫。支援跨 Agent 任務橋接與即時任務佇列。

### 🤖 Discord 整合
透過 Discord Bot 遠端控制 AgentOS：
- `!task 任務內容` — 建立任務給 Hermes
- `!research 查詢內容` — 建立研究任務
- `!status` — 查詢目前任務狀態
- 任務完成後自動推送通知到頻道

### 📚 Agent 收藏庫
管理本機安裝的 AI Agent，支援從 GitHub 匯入、啟動、停止、查看日誌。

### 🔬 研究模式
從新聞、學術論文、YouTube、GitHub 等多個來源同步搜尋，自動生成結構化報告。

### 🧠 Fusion-Loop 大腦

AgentOS 內建多模型合成推理系統，作為所有任務的統一入口。

#### Fusion（橫向展開）
同一個任務同時交給多個本地模型（qwen3:8b + gemma3:9b），由 Judge 模型分析共識、矛盾與盲點後合成最終答案，突破單一模型的視角限制。

#### Self-Refinement Loop（縱向收斂）
合成草稿完成後，由 Critic 模型評估準確性、完整性、清晰度、可行性，不達標則交給 Refiner 修改，最多迭代 3 輪直到收斂。

#### Orchestrator（工具調度）
Fusion-Loop 大腦透過 DISPATCH 格式把任務分配給底層工具（OpenCode、Obsidian、Discord、其他 Agent），自己只負責決策，不執行。

#### 技術細節
- 本地推理：Ollama（`192.168.176.1:11434`）
- 記憶寫入：UMP Hub SQLite（IPC `ump-add-memory`）
- 前端入口：`BrainChat` → `BrainService` → `FusionLoopOrchestrator`

---

## 安裝

### 前置需求

| 軟體 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+（推薦 20） | 核心執行環境 |
| npm | 9+ | 套件管理 |
| Ollama | 最新版 | 本地 AI 模型（可選） |
| Python | 3.8+ | Hermes 任務監聽器（可選） |
| Git | 最新版 | GitHub 安裝器必要 |

### 快速開始

```bash
git clone https://github.com/zorrokurro/agent-os.git
cd agent-os
npm install
npm run dev
```

### 設定 OpenRouter（AI 功能必要）

1. 前往 [openrouter.ai](https://openrouter.ai) 申請 API Key
2. 開啟 AgentOS → 設定 → AI 提供者設定
3. 填入 API Key 和模型 ID（例如：`openai/gpt-4o-mini`）

### 設定 Discord Bot（可選）

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications) 建立 Bot
2. 開啟 Message Content Intent
3. 開啟 AgentOS → 設定 → Discord 區塊填入 Token 和頻道 ID

### 啟動 Hermes 任務監聽器（可選）

如果你有安裝 Hermes，啟動橋接服務：

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
│   ├── UMP Hub — SQLite 共享記憶層
│   ├── Research Engine — 多來源搜尋
│   ├── Council Service — 多模型議事
│   ├── Discord Service — Bot 整合
│   ├── Obsidian Service — Vault 雙向同步
│   └── GitHub Installer — 一鍵安裝任何 GitHub 專案
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

## 相關專案

- [Hermes](https://github.com/zorrokurro/hermes) — 多 Agent 協作系統，可與 AgentOS 橋接

---

## 授權

MIT License
