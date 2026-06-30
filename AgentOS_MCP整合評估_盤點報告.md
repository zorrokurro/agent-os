# AgentOS × MCP 整合評估盤點報告

> 盤點日期：2026-06-24
> 目標：評估加入 MCP（Model Context Protocol）支援的可行性、工作量與現有缺口

---

## 一、現有架構盤點

### 1. ToolRouter 實作方式

**現狀：ToolRouter 尚未實作於程式碼中。**

`ROADMAP.md:31` 提到：

> `ToolRouter` 已經寫好並可解析 DISPATCH 格式，但 Hermes 的 system prompt 還沒改成強制輸出該格式。等 Fusion-Loop 大腦需要呼叫底層 Agent 工具時會回頭接上。

但在實際程式碼中搜尋不到任何 `ToolRouter` 類別或模組。目前承擔「工具路由」職責的是 **Orchestrator** 模組：

| 組件 | 檔案 | 職責 |
|------|------|------|
| `TaskAnalyzer` | `electron/services/orchestrator/task-analyzer.ts` | 關鍵詞匹配，將使用者 prompt 分配到對應 Agent |
| `Orchestrator` | `electron/services/orchestrator/orchestrator.ts` | 管理 Controller Map、執行 DAG 任務圖、彙整結果 |
| `AgentController` 介面 | `controllers/opencode-controller.ts:8-10` | 統一介面：`execute(task: Task, context?: string): Promise<string>` |

**工具註冊方式：** 硬編碼於 `Orchestrator` constructor（`orchestrator.ts:25-27`）：

```typescript
this.controllers.set('opencode', new OpenCodeController())
this.controllers.set('hermes', new HermesController())
this.controllers.set('filesystem', new FilesystemController())
```

**路由邏輯：** `TaskAnalyzer` 使用關鍵詞表（`task-analyzer.ts:24-48`）做字串匹配：

| 關鍵詞群組 | 目標 Agent | 用途 |
|---|---|---|
| `檔案, file, directory, 讀取檔案, write file...` | `filesystem` | 檔案操作 |
| `寫程式, code, debug, bug, refactor, typescript...` | `opencode` | 程式碼任務 |
| `研究, query, search, analyze, summarize...` | `hermes` | 研究/查詢 |
| （無匹配） | `hermes`（預設） | fallback |

**支援的呼叫格式：** 目前僅支援純文字 prompt → Task 物件，無 tool-call / function-call / JSON 格式。Task 結構為：

```typescript
interface Task {
  id: string
  description: string
  assignedAgent: 'opencode' | 'hermes' | 'filesystem' | 'ump'
  dependencies: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  error?: string
}
```

---

### 2. aiRouter.ts 路由邏輯

**檔案：** `electron/services/aiRouter.ts`（192 行）

**核心入口：** `aiChat(model, messages, opts)`（第 9-18 行）

```
if model.startsWith('api:') → callApiProvider()（雲端）
else → callOllama()（本機）
```

**雲端分流（`callApiProvider`，第 29-49 行）：**

| Provider | API Endpoint | 認證方式 |
|----------|-------------|---------|
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `Bearer` token |
| `anthropic` | `https://api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version` |
| `openai` | `https://api.openai.com/v1/chat/completions` | `Bearer` token |

- Anthropic 使用獨立的 `fetchAnthropic()` 函式（第 51-93 行），回傳 `parsed.content[0].text`
- OpenRouter / OpenAI 共用 `fetchOpenAICompatible()`（第 95-136 行），回傳 `parsed.choices[0].message.content`

**本機分流（`callOllama`，第 20-27 行）：**

- 委託給 `ollama.ts` 的 `chat()` 函式
- 連接本地 Ollama API（`/api/chat`）
- 支援串流（NDJSON）與非串流模式

**模型列表（`listApiModels`，第 138-169 行）：**

- OpenRouter：動態從 API 拉取，格式為 `api:<model-id>`
- OpenAI：動態拉取，過濾 `gpt` 類模型
- Anthropic：硬編碼列表（`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`）

**IPC 入口（`main.ts:237-243`）：**

```typescript
ipcMain.handle('ai-chat', async (_e, { model, messages, baseUrl }) => {
  return await aiChat(model, messages, {
    ollamaUrl: baseUrl || store.get('ollamaUrl'),
    apiProvider: store.get('apiProvider'),
    apiKey: store.get('apiKey'),
  })
})
```

另有獨立的 `openrouter-chat` handler（`main.ts:474-511`），使用 Electron `net.request` 繞過 `aiRouter.ts`。

---

### 3. UMP Hub 的 IPC 實作模式

**架構模式：** Electron `ipcMain.handle()` ↔ `ipcRenderer.invoke()` ↔ `contextBridge` ↔ React 前端

#### 3.1 electron/main.ts — 後端 IPC 註冊

UMP Hub 初始化（`main.ts:660-664`）：

```typescript
const umpHub = new MemoryHub()
await umpHub.initialize()
umpHubInstance = umpHub
```

主要 IPC channels（`main.ts:660-770`）：

| Channel | 功能 | 對應方法 |
|---------|------|---------|
| `ump-discover-scan` | 掃描 Agent | `umpDiscovery.scan()` |
| `ump-discover-unregistered` | 取得未註冊 Agent | `umpDiscovery.getUnregistered()` |
| `ump-discover-register-all` | 註冊所有未註冊 Agent | `umpDiscovery.registerAllUnregistered()` |
| `ump-discover-consolidate` | 整合 Agent 記憶 | `umpDiscovery.consolidateMemories()` |
| `ump-bridge-connect` | 連接橋接器 | `umpBridge.connect()` |
| `ump-bridge-import` | 匯入記憶 | `umpBridge.importAllMemories()` |
| `ump-bridge-export` | 匯出記憶 | `umpBridge.exportAllMemories()` |
| `ump-bridge-sync` | 完整同步 | `umpBridge.fullSync()` |
| `ump-hub-search` | 搜尋記憶 | `umpHub.searchByContent()` |
| `ump-hub-stats` | 取得統計 | `umpHub.getStatistics()` |
| `ump-hub-all` | 取得所有記憶 | `umpHub.getAll()` |
| `ump-exchange-register` | 註冊 Agent | `umpExchange.registerAgent()` |
| `ump-add-memory` | 新增記憶 | `umpHub.addMemory()` |
| `ump-conversations` | 取得對話 | `umpHub.getConversationsForMemory()` |
| `ump-session-messages` | 取得對話訊息 | `umpHub.getSessionMessages()` |
| `ump:create-task` | 建立任務 | `umpHub.createTask()` |
| `ump:get-tasks` | 取得任務 | `umpHub.getTasks()` |
| `ump:update-task` | 更新任務狀態 | `umpHub.updateTaskStatus()` |

#### 3.2 electron/preload.ts — Context Bridge 橋接

透過 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露所有方法（`preload.ts:113-140`）：

```typescript
umpDiscoverScan: () => ipcRenderer.invoke('ump-discover-scan'),
umpHubSearch: (query, opts) => ipcRenderer.invoke('ump-hub-search', query, opts),
umpCreateTask: (title, content, target, source) => ipcRenderer.invoke('ump:create-task', ...),
// ... 共 20+ 個 UMP 相關方法
```

#### 3.3 src/types/electron.d.ts — TypeScript 型別宣告

完整定義 `window.electronAPI` 介面（`electron.d.ts:19-156`），包含所有 UMP 方法的參數與回傳型別。例如：

```typescript
umpHubSearch: (query: string, opts?: UmpSearchOptions) => Promise<unknown[]>
umpConversations: (agentName: string, limit?: number) =>
  Promise<Array<{ session: Session; messages: Message[] }>>
umpCreateTask: (title: string, content: string, target: string, source: string) =>
  Promise<Task>
```

#### 3.4 三處對應關係

```
main.ts (ipcMain.handle)          preload.ts (ipcRenderer.invoke)      electron.d.ts (型別)
─────────────────────────         ─────────────────────────────         ─────────────────────
'ump-hub-search'        ←→       umpHubSearch: (query, opts)          → Promise<unknown[]>
'ump:create-task'       ←→       umpCreateTask: (t, c, tgt, src)      → Promise<Task>
'ump-conversations'     ←→       umpConversations: (name, limit)       → Promise<{session, messages}[]>
...（共 20+ channels）           ...（對應方法）                        ...（對應型別）
```

---

### 4. 四個內建 Agent 的呼叫方式

#### 4.1 Hermes

| 項目 | 內容 |
|------|------|
| **Manifest** | `agents/hermes/manifest.json` — `runtime.type: "external"` |
| **Controller** | `HermesController`（`hermes-controller.ts`） |
| **呼叫方式** | 建立 UMP Task → 輪詢等待結果（每 3 秒，最長 60 秒） |
| **傳參** | `hub.createTask(title, content, 'Hermes', 'AgentOS-Orchestrator')` |
| **回傳** | `task.result` 字串 |
| **健康檢查** | `GET http://127.0.0.1:8642/health` |
| **進程管理** | `agent-manager.ts` 偵測 `hermes-agent` / `python3` 進程 |

#### 4.2 OpenCode

| 項目 | 內容 |
|------|------|
| **Manifest** | `agents/opencode/manifest.json` — `runtime.type: "binary"` |
| **Controller** | `OpenCodeController`（`opencode-controller.ts`） |
| **呼叫方式** | HTTP API（port 5001）— 建立 session → 發送 message → 提取結果 |
| **傳參** | `POST /session/{id}/message` with `{ parts: [{ type: 'text', text: prompt }] }` |
| **回傳** | Response `parts` 中的 `text` 內容 |
| **自動啟動** | 若未運行，自動 spawn `opencode serve --port 5001` |
| **認證** | Basic Auth（`OPENCODE_SERVER_PASSWORD` + `OPENCODE_USERNAME`） |

#### 4.3 OpenHuman

| 項目 | 內容 |
|------|------|
| **Manifest** | `agents/openhuman/manifest.json` — `runtime.type: "binary"` |
| **Controller** | ❌ 無（僅透過 AgentManager 管理） |
| **呼叫方式** | `agent-manager.ts` 的 `startAgent('openhuman')` — spawn 執行檔 |
| **偵測** | 進程名稱匹配 `OpenHuman.exe` / `openhuman.exe` |
| **設定** | `~/.openhuman` 目錄存在即判定已安裝 |
| **限制** | 無 Orchestrator 整合，無法被任務系統自動呼叫 |

#### 4.4 Headroom

| 項目 | 內容 |
|------|------|
| **Manifest** | ❌ 無 manifest.json |
| **Controller** | ❌ 無 |
| **狀態** | `agents/headroom/` 包含完整 Rust 專案（Cargo.toml, crates/） |
| **限制** | 完全未接線，無法被任何系統呼叫 |

---

## 二、MCP 整合評估

### 1. MCP 標準介面與 AgentOS 現有 ToolRouter 的差異

**MCP（Model Context Protocol）** 是 Anthropic 主導的開放協議，定義了 LLM 與外部工具/資源之間的標準化通訊格式。

#### MCP 核心概念

| 概念 | 說明 |
|------|------|
| **傳輸層** | JSON-RPC 2.0 over stdio（子程序）或 SSE（HTTP 串流） |
| **三種能力** | `tools`（可呼叫的函式）、`resources`（可讀取的資料）、`prompts`（預設提示模板） |
| **角色** | MCP Client（發起請求）↔ MCP Server（提供能力） |
| **生命週期** | initialize → initialized → 正常通訊 → shutdown |

#### 與 AgentOS 現有架構的差異

| 維度 | AgentOS 現狀 | MCP 標準 |
|------|-------------|---------|
| **工具定義** | 硬編碼於 Orchestrator constructor | 動態 discovery（`tools/list`） |
| **呼叫格式** | 自訂 `Task` 物件 + `AgentController` 介面 | JSON-RPC 2.0（`tools/call`） |
| **傳輸層** | Electron IPC（`ipcMain.handle`） | stdio / SSE / Streamable HTTP |
| **工具發現** | 無（編譯時確定） | 運行時動態查詢 |
| **資源存取** | 無 | MCP resources（`resources/list`, `resources/read`） |
| **提示模板** | 無 | MCP prompts（`prompts/list`, `prompts/get`） |
| **錯誤處理** | try/catch + EventEmitter | JSON-RPC error codes |
| **型別系統** | TypeScript interface | JSON Schema |

---

### 2. AgentOS 應扮演的角色與工作量評估

#### (a) MCP Client：讓 AgentOS 連接外部 MCP Server

**目標：** 讓 AgentOS 的內建 Agent（Hermes、OpenCode 等）可以使用外部 MCP Server 提供的工具（如 Notion API、GitHub API、檔案系統等）。

**架構設計：**

```
使用者 prompt
     ↓
Orchestrator / TaskAnalyzer
     ↓
MCP Client Manager（新建）
     ↓ JSON-RPC over stdio/SSE
外部 MCP Server（Notion、GitHub、filesystem 等）
     ↓
結果回傳給 Agent
```

**所需工作：**

| 工作項目 | 說明 | 預估工作量 |
|---------|------|-----------|
| MCP SDK 整合 | 引入 `@modelcontextprotocol/sdk`，實作 Client 連線管理 | 中 |
| MCP Client Manager | 管理多個 MCP Server 連線、工具 discovery、工具呼叫 | 中 |
| 工具註冊橋接 | 將 MCP tools 轉換為 AgentOS 內部 tool 格式，注入 Orchestrator | 中 |
| UI 設定介面 | 設定頁面新增 MCP Server 管理（新增/刪除/啟停） | 中 |
| IPC 橋接 | 在 main.ts 註冊 MCP 相關 IPC handlers，preload 暴露方法 | 小 |
| 錯誤處理 / 重連 | MCP Server 崩潰時的重連、超時處理 | 小 |
| SSE 傳輸支援 | 除了 stdio 外，支援 SSE 傳輸（HTTP 遠端 Server） | 中 |

**總工作量：** 約 **中～大**（2-4 週，視熟悉程度）

**難點：** Electron 主程序中 spawn 子程序（stdio 傳輸）需注意 Windows 下的 process 管理、編碼問題。

#### (b) MCP Server：讓 AgentOS 能力被外部 Client 呼叫

**目標：** 讓 Claude Desktop、Notion、或其他 MCP Client 可以呼叫 AgentOS 的功能（UMP 記憶查詢、Fusion-Loop 推理、Agent 管理等）。

**架構設計：**

```
外部 MCP Client（Claude Desktop 等）
     ↓ JSON-RPC over stdio
AgentOS MCP Server（新建）
     ↓
直接呼叫現有服務（MemoryHub、Orchestrator、aiRouter 等）
     ↓
結果回傳
```

**所需工作：**

| 工作項目 | 說明 | 預估工作量 |
|---------|------|-----------|
| MCP Server 實作 | 基於 `@modelcontextprotocol/sdk` 的 Server 類別 | 中 |
| Tool 定義 | 將 UMP Hub、Orchestrator、aiRouter 等包裝為 MCP tools | 中 |
| Resource 定義 | 將記憶、Agent 狀態等暴露為 MCP resources | 小 |
| Prompt 定義 | 將常用工作流包裝為 MCP prompts | 小 |
| stdio 傳輸 | 實作 stdio transport，讓外部 Client 可透過子程序連接 | 中 |
| 安全沙箱 | 限制外部 Client 可存取的工具範圍（避免任意檔案操作） | 中 |
| 配置與啟動 | MCP Server 的配置檔、自動啟動、與 Electron 的整合 | 中 |

**總工作量：** 約 **中**（1.5-3 週）

**優勢：** AgentOS 的核心服務（MemoryHub、Orchestrator 等）已有良好的模組化，包裝為 MCP tools 相對直接。

---

### 3. IPC 架構對接 MCP 協議的技術障礙

#### 障礙 1：stdio 傳輸在 Electron 主程序中的子程序管理

**問題：** MCP 的 stdio 傳輸需要 `child_process.spawn()` 並透過 stdin/stdout 進行 JSON-RPC 通訊。在 Electron 主程序中：

- Windows 下子程序的 stdio 管道可能有編碼問題（UTF-8 vs 系統編碼）
- 子程序的生命週期需與 Electron 應用同步（避免 zombie process）
- Electron 的 `app.on('will-quit')` 需正確關閉所有 MCP 連線

**解決方向：** 在 `main.ts` 中建立 `McpClientManager` 單例，統一管理所有 MCP 子程序的生命週期，於 `app.on('will-quit')` 時逐一關閉。

#### 障礙 2：渲染程序無法直接存取 stdio

**問題：** React 前端透過 IPC 間接呼叫，但 MCP stdio 傳輸需要直接操作 process stdin/stdout。渲染程序無法直接 spawn 子程序。

**解決方向：** MCP Client 必須完全在主程序中運作，前端僅透過 IPC 發送請求、接收結果。這與現有架構一致（所有重型運算都在 main.ts）。

#### 障礙 3：SSE 傳輸的 HTTP 服務器衝突

**問題：** 如果 AgentOS 同時作為 MCP Client（連接外部 SSE Server）和 MCP Server（提供 SSE endpoint），可能需要在主程序中啟動 HTTP 伺服器。目前 Electron 主程序中已有 Ollama（port 11434）、OpenCode（port 5001）、Hermes（port 8642）等服務，需避免 port 衝突。

**解決方向：** 使用動態 port 分配，或統一由一個 HTTP 伺服器代理所有 MCP SSE 連線。

#### 障礙 4：安全性——外部 Client 存取本地資源

**問題：** MCP Server 暴露的功能（記憶查詢、Agent 管理、檔案操作）若無存取控制，任何能連接 stdio 的 Client 都能完全存取。

**解決方向：** 實作工具白名單機制，依據 Client 身份過濾可用工具。至少需提供「唯讀 / 完整」兩種權限等級。

---

## 三、缺口清單（依優先度排序）

| # | 缺口 | 優先度 | 工作量 | 理由 |
|---|------|--------|--------|------|
| 1 | **ToolRouter 實作** | 🔴 高 | 中 | ROADMAP 中提到已完成但實際不存在。沒有 ToolRouter，Orchestrator 只能靠關鍵詞匹配，無法支援結構化的 tool-call 格式。這是 MCP Client 整合的前置需求。 |
| 2 | **MCP Client 模組** | 🔴 高 | 大 | 讓 AgentOS 可以連接外部 MCP Server（Notion、GitHub 等），大幅擴展可用工具生態。需引入 `@modelcontextprotocol/sdk`、實作 Client Manager、工具橋接。 |
| 3 | **MCP Server 模組** | 🟡 中 | 中 | 讓 AgentOS 的能力（UMP Hub 查詢、Orchestrator 推理）可被 Claude Desktop 等外部 Client 呼叫。提升 AgentOS 作為「Agent 操作系統」的定位。 |
| 4 | **Hermes System Prompt 改造** | 🟡 中 | 小 | 讓 Hermes 強制輸出 DISPATCH 格式，使 ToolRouter 可以解析並路由到底層 Agent。ROADMAP 明確提到此為待辦。 |
| 5 | **AgentController 標準化** | 🟡 中 | 小 | 目前 `AgentController` 介面僅定義 `execute(task, context)`，缺乏 tool description、input schema 等 MCP 所需的結構化中繼資料。需擴展介面。 |
| 6 | **OpenHuman / Headroom 接線** | 🟡 中 | 中 | 兩個內建 Agent 完全未接入 Orchestrator。OpenHuman 需要 Controller，Headroom 需要從 Rust 專案编译並建立 manifest。 |
| 7 | **TaskAnalyzer 智慧化** | 🟢 低 | 中 | 目前使用純關鍵詞匹配，容易誤判。可改用 LLM 分析或 embedding 相似度匹配，提升路由準確率。 |
| 8 | **MCP 工具 UI 管理介面** | 🟢 低 | 中 | 設定頁面新增 MCP Server 的新增/刪除/啟停/測試功能，讓非技術用戶也能管理 MCP 連線。 |
| 9 | **跨平台支援** | 🟢 低 | 大 | 目前僅支援 Windows。macOS/Linux 需要社群協助測試。與 MCP 整合無直接關係，但會影響 MCP Server（stdio）在不同平台的相容性。 |
| 10 | **安全沙箱機制** | 🟢 低 | 中 | MCP Server 暴露的功能需要存取控制。最低限度需實作工具白名單與權限等級。 |
| 11 | **UMP Hub 多人共享** | ⚪ 未定 | 大 | ROADMAP 規劃中，目前為單機 SQLite。與 MCP 整合無直接關係，但若要讓多個 MCP Client 共用記憶層，需先解決。 |
| 12 | **手機遠端控制** | ⚪ 未定 | 大 | ROADMAP 規劃中。可與 MCP Server 結合——手機 App 作為 MCP Client 呼叫 AgentOS 功能。 |

---

## 四、總結與建議

### 現狀評估

AgentOS 目前是一個功能豐富的 Electron 桌面應用，核心架構包含：
- **UMP Hub**：本地 SQLite 記憶層（成熟）
- **Orchestrator**：關鍵詞路由 + DAG 任務執行（基礎但可用）
- **aiRouter**：雙 Provider 架構（Ollama + 雲端 API）
- **4 個 Agent**：Hermes（已接線）、OpenCode（已接線）、OpenHuman（未接線）、Headroom（未接線）

### MCP 整合可行性

| 方向 | 可行性 | 建議優先度 |
|------|--------|-----------|
| MCP Client | ✅ 高（現有架構易於擴展） | 先做（打通外部工具生態） |
| MCP Server | ✅ 高（核心服務已模組化） | 後做（擴展被呼叫能力） |

### 建議實施順序

1. **Phase 1**（1-2 週）：實作 ToolRouter + 改造 Hermes prompt → 建立結構化工具呼叫基礎
2. **Phase 2**（2-4 週）：實作 MCP Client → 連接外部 MCP Server 生態
3. **Phase 3**（1-3 週）：實作 MCP Server → 讓 AgentOS 能力被外部呼叫
4. **Phase 4**（持續）：UI 管理介面、安全機制、跨平台

### 風險提示

- MCP 協議仍在快速演進（目前為 2025 年初），API 可能有 breaking changes
- Electron 的子程序管理在 Windows 上有已知的坑（路徑長度、編碼、UAC）
- 現有 ToolRouter 實作與 ROADMAP 描述不一致，需先確認開發者意圖
