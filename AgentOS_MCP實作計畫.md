# AgentOS MCP 實作計畫

> 產出日期：2026-06-24
> 基於完整程式碼盤點，提供可直接執行的任務清單

---

## 一、MCPController（MCP Client）實作步驟

### 目標
讓 AgentOS 內建 Agent 可以呼叫外部 MCP Server（Notion、GitHub、filesystem 等）提供的 tools。

### 依賴安裝

```
npm install @modelcontextprotocol/sdk
```

MCP SDK 版本：`1.29.0`（已確認 npm registry 可用）。專案使用 `"module": "ESNext"` + `"type": "module"`，MCP SDK 支援 ESM import。

---

### 步驟 1：建立 `electron/services/mcp/client.ts`（MCP Client Manager）

**新建檔案**，核心職責：管理多個 MCP Server 連線、tool discovery、tool呼叫。

```typescript
// 需要實作的介面與類別

export interface McpServerConfig {
  id: string                    // 唯一識別碼
  name: string                  // 顯示名稱
  transport: 'stdio' | 'sse'   // 傳輸方式
  command?: string              // stdio: 執行檔路徑
  args?: string[]               // stdio: 呼叫引數
  env?: Record<string, string>  // stdio: 環境變數
  url?: string                  // SSE: HTTP URL
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>  // JSON Schema
}

export class McpClientManager {
  private connections: Map<string, Client>  // MCP Client instances
  private tools: Map<string, McpToolInfo>  // 全域 tool 索引

  async connectServer(config: McpServerConfig): Promise<void>
  async disconnectServer(serverId: string): Promise<void>
  async listTools(serverId: string): Promise<McpToolInfo[]>
  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>
  async listAllTools(): Promise<McpToolInfo[]>  // 跨所有 Server
  async shutdown(): Promise<void>  // 關閉所有連線
}
```

**連線流程（stdio）：**
1. `spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })`
2. 建立 `StdioClientTransport`（from `@modelcontextprotocol/sdk/client/stdio.js`）
3. 建立 `Client` 實例，呼叫 `client.connect(transport)`
4. 呼叫 `client.listTools()` 取得工具列表
5. 呼叫 `client.callTool({ name, arguments })` 執行工具

**連線流程（SSE）：**
1. 建立 `SSEClientTransport`（from `@modelcontextprotocol/sdk/client/sse.js`）
2. 建立 `Client` 實例，呼叫 `client.connect(transport)`
3. 同上

**子程序生命週期管理：**
- 註冊 `app.on('before-quit')` 鉤子，逐一呼叫 `disconnectServer()`
- 子程序崩潰時自動重連（最多 3 次，指數退避）
- 使用 `ChildProcess.kill()` 確保清理

**錯誤處理：**
- 連線失敗：回傳 `{ success: false, error: string }`
- Tool 呼叫失敗：回傳 MCP error code + message
- 超時：設定 30 秒預設超時

---

### 步驟 2：建立 `electron/services/mcp/mcp-controller.ts`（Orchestrator 整合）

**新建檔案**，實作現有 `AgentController` 介面。

```typescript
import { AgentController } from '../orchestrator/controllers/opencode-controller'
import { Task } from '../orchestrator/task-analyzer'
import { McpClientManager } from './client'

export class McpController implements AgentController {
  constructor(private mcpManager: McpClientManager) {}

  async execute(task: Task, context?: string): Promise<string> {
    // 1. 從 task.description 解析 tool name + args（或用 LLM 解析）
    // 2. 從 mcpManager.listAllTools() 找到對應 tool
    // 3. 呼叫 mcpManager.callTool(serverId, toolName, parsedArgs)
    // 4. 回傳結果字串
  }
}
```

**Orchestrator 接線：**
修改 `electron/services/orchestrator/orchestrator.ts` 第 25-27 行：

```typescript
// 現有：
this.controllers.set('opencode', new OpenCodeController())
this.controllers.set('hermes', new HermesController())
this.controllers.set('filesystem', new FilesystemController())

// 改為：
this.controllers.set('opencode', new OpenCodeController())
this.controllers.set('hermes', new HermesController())
this.controllers.set('filesystem', new FilesystemController())
this.controllers.set('mcp', new McpController(mcpManager))  // 新增
```

**TaskAnalyzer 擴展：**
修改 `electron/services/orchestrator/task-analyzer.ts`：

1. `AgentType`（第 1 行）新增 `'mcp'`：
   ```typescript
   export type AgentType = 'opencode' | 'hermes' | 'filesystem' | 'ump' | 'mcp'
   ```

2. `KEYWORD_RULES`（第 24-48 行）新增 MCP 路由規則：
   ```typescript
   {
     keywords: ['notion', 'github', 'slack', 'linear', 'jira', 'google calendar',
                '使用工具', '呼叫工具', 'use tool', 'call tool'],
     agent: 'mcp',
   },
   ```

3. `getAgentName`（第 143-151 行）新增：
   ```typescript
   mcp: 'MCP 外部工具',
   ```

---

### 步驟 3：修改 `electron/main.ts` — 新增 MCP IPC handlers

**在 UMP section 之後（約第 770 行後）、Notebook section 之前** 新增 MCP 區塊：

```typescript
// === MCP (Model Context Protocol) ===
import { McpClientManager } from './services/mcp/client'
import { McpController } from './services/mcp/mcp-controller'

const mcpManager = new McpClientManager()
// 載入已儲存的 MCP Server 設定
const savedMcpServers = store.get('mcpServers') as McpServerConfig[] || []
for (const server of savedMcpServers) {
  if (server.enabled) {
    await mcpManager.connectServer(server).catch(e =>
      console.error(`[MCP] 連線失敗 ${server.id}:`, e)
    )
  }
}

ipcMain.handle('mcp:list-servers', () => {
  return store.get('mcpServers') || []
})

ipcMain.handle('mcp:add-server', (_, config: McpServerConfig) => {
  const servers = (store.get('mcpServers') as McpServerConfig[]) || []
  servers.push(config)
  store.set('mcpServers', servers)
  if (config.enabled) {
    return mcpManager.connectServer(config).then(() => ({ success: true }))
      .catch(e => ({ success: false, error: String(e) }))
  }
  return { success: true }
})

ipcMain.handle('mcp:remove-server', (_, serverId: string) => {
  const servers = (store.get('mcpServers') as McpServerConfig[]) || []
  store.set('mcpServers', servers.filter(s => s.id !== serverId))
  return mcpManager.disconnectServer(serverId).then(() => ({ success: true }))
})

ipcMain.handle('mcp:toggle-server', async (_, serverId: string, enabled: boolean) => {
  const servers = (store.get('mcpServers') as McpServerConfig[]) || []
  const server = servers.find(s => s.id === serverId)
  if (server) {
    server.enabled = enabled
    store.set('mcpServers', servers)
    if (enabled) {
      await mcpManager.connectServer(server)
    } else {
      await mcpManager.disconnectServer(serverId)
    }
  }
  return { success: true }
})

ipcMain.handle('mcp:list-tools', async (_, serverId?: string) => {
  if (serverId) {
    return mcpManager.listTools(serverId)
  }
  return mcpManager.listAllTools()
})

ipcMain.handle('mcp:call-tool', async (_, serverId: string, toolName: string, args: Record<string, unknown>) => {
  try {
    const result = await mcpManager.callTool(serverId, toolName, args)
    return { success: true, result }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('mcp:server-status', () => {
  return mcpManager.getStatus()
})
```

**store schema 擴展（第 35-83 行）：**
在 store defaults 中新增：
```typescript
mcpServers: [] as McpServerConfig[],
```

**app quit 清理（第 1096-1108 行）：**
在 `before-quit` handler 中新增：
```typescript
await mcpManager.shutdown()
```

---

### 步驟 4：修改 `electron/preload.ts` — 暴露 MCP IPC 方法

**在 Obsidian Sync section 之後（第 220 行後）** 新增：

```typescript
// MCP (Model Context Protocol)
mcpListServers: () => ipcRenderer.invoke('mcp:list-servers'),
mcpAddServer: (config: Record<string, unknown>) => ipcRenderer.invoke('mcp:add-server', config),
mcpRemoveServer: (serverId: string) => ipcRenderer.invoke('mcp:remove-server', serverId),
mcpToggleServer: (serverId: string, enabled: boolean) => ipcRenderer.invoke('mcp:toggle-server', serverId, enabled),
mcpListTools: (serverId?: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
mcpCallTool: (serverId: string, toolName: string, args: Record<string, unknown>) => ipcRenderer.invoke('mcp:call-tool', serverId, toolName, args),
mcpServerStatus: () => ipcRenderer.invoke('mcp:server-status'),
```

---

### 步驟 5：修改 `src/types/electron.d.ts` — 新增 MCP 型別宣告

**在 `window.electronAPI` 介面內（第 155 行 `obsidianWatchStop` 之後）** 新增：

```typescript
// MCP (Model Context Protocol)
mcpListServers: () => Promise<McpServerConfig[]>
mcpAddServer: (config: McpServerConfig) => Promise<{ success: boolean; error?: string }>
mcpRemoveServer: (serverId: string) => Promise<{ success: boolean }>
mcpToggleServer: (serverId: string, enabled: boolean) => Promise<{ success: boolean }>
mcpListTools: (serverId?: string) => Promise<McpToolInfo[]>
mcpCallTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }>
mcpServerStatus: () => Promise<McpServerStatus[]>
```

**在檔案底部（第 212 行 `SystemAgent` 之後）** 新增 MCP 型別：

```typescript
export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  error?: string
}
```

---

### 步驟 6：前端 UI — MCP Server 管理頁面

**新建檔案**：`src/components/McpPage.tsx`

功能：
- MCP Server 列表（顯示名稱、連線狀態、工具數量）
- 新增 Server 表單（選擇 transport type、填入 command/url/args）
- 啟停開關
- Tool 列表檢視（每個 tool 顯示 name、description、input schema）
- Tool 測試呼叫（填入 JSON 參數、執行、顯示結果）

**修改 `src/App.tsx`**：在路由中加入 `/mcp` 頁面。

---

### MCP Client 實作工作量估算

| 任務 | 預估工時 | 備註 |
|------|---------|------|
| 安裝 `@modelcontextprotocol/sdk` | 0.5h | `npm install` + 驗證 ESM import |
| `client.ts` — McpClientManager | 8h | stdio 連線、SSE 連線、tool discovery、tool call、重連、生命週期 |
| `mcp-controller.ts` — McpController | 3h | 解析 task → tool name + args → callTool |
| `main.ts` — IPC handlers | 3h | 7 個 IPC channels + store schema + quit cleanup |
| `preload.ts` — bridge methods | 1h | 7 個方法 |
| `electron.d.ts` — 型別宣告 | 1h | 3 個 interface + 7 個方法 |
| Orchestrator/TaskAnalyzer 接線 | 2h | AgentType 擴展 + KEYWORD_RULES + controller 註冊 |
| `McpPage.tsx` — UI 頁面 | 6h | Server 管理 + Tool 瀏覽 + 測試呼叫 |
| App.tsx 路由 | 0.5h | 加入 /mcp |
| **小計** | **25h** | |

---

## 二、UMP Hub MCP Server 實作步驟

### 目標
讓外部 MCP Client（Claude Desktop、Notion、其他 AgentOS 實例）可以透過 MCP 協議呼叫 AgentOS 的 UMP Hub 記憶查詢、Orchestrator 推理等功能。

### 進程啟動方式

**方案 A（推薦）：獨立 Node.js 子程序 + stdio**

```
AgentOS 主程序
  └─ spawn('node', ['ump-mcp-server.js'], { stdio: ['pipe','pipe','pipe'] })
       ↕ JSON-RPC over stdio
     MCP Client（Claude Desktop 等）
```

優點：
- 不需要占用額外 port
- 與 Electron 主程序完全解耦
- 外部 Client 可以直接 `claude desktop` 配置中指定 command

**方案 B：HTTP SSE 伺服器**

在 Electron 主程序內啟動一個輕量 HTTP 伺服器，提供 `/sse` endpoint。但會增加 port 管理複雜度。

**決定採用方案 A。**

---

### 步驟 1：建立 `electron/services/mcp/server.ts`（MCP Server 實作）

**新建檔案**，使用 `@modelcontextprotocol/sdk` 的 Server 類別。

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
```

**暴露的 Tools：**

| Tool Name | 說明 | Input Schema | 對應現有方法 |
|-----------|------|-------------|-------------|
| `ump_search_memory` | 搜尋 UMP 記憶 | `{ query: string, memoryType?: string, limit?: number }` | `hub.searchByContent()` |
| `ump_get_memory` | 取得單筆記憶 | `{ id: string }` | `hub.getMemory()` |
| `ump_add_memory` | 新增記憶 | `{ content: string, memoryType?: string, tags?: string[], groupId?: string }` | `hub.addMemory()` + `createMemory()` |
| `ump_list_memories` | 列出所有記憶 | `{ limit?: number }` | `hub.getAll()` |
| `ump_get_statistics` | 取得記憶統計 | `{}` | `hub.getStatistics()` |
| `ump_search_by_tag` | 按標籤搜尋 | `{ tags: string[], limit?: number }` | `hub.searchByContent()` with tags filter |
| `ump_create_task` | 建立任務 | `{ title: string, content: string, target: string }` | `hub.createTask()` |
| `ump_get_tasks` | 取得任務列表 | `{ target?: string, status?: string }` | `hub.getTasks()` |
| `ump_update_task` | 更新任務狀態 | `{ id: string, status: string, result?: string }` | `hub.updateTaskStatus()` |
| `ump_execute_orchestrator` | 執行 Orchestrator 任務 | `{ prompt: string }` | `orchestrator.execute()` |
| `ump_list_sessions` | 列出對話 sessions | `{ agentName?: string, limit?: number }` | `hub.getSessions()` |
| `ump_get_session_messages` | 取得對話訊息 | `{ sessionId: string }` | `hub.getSessionMessages()` |

**暴露的 Resources：**

| URI | 說明 | 對應 |
|-----|------|------|
| `ump://memories` | 所有記憶的 JSON 集合 | `hub.getAll()` |
| `ump://statistics` | 統計摘要 | `hub.getStatistics()` |
| `ump://sessions` | 所有對話 sessions | `hub.getSessions()` |
| `ump://agents` | 已註冊 agents | `exchange.listAgents()` |
| `ump://memory/{id}` | 單筆記憶詳情 | `hub.getMemory(id)` |

**暴露的 Prompts：**

| Name | 說明 |
|------|------|
| `ump_search` | 引導使用者搜尋記憶 |
| `ump_summarize` | 摘要指定範圍的記憶 |
| `ump_analyze` | 分析記憶中的模式與關聯 |

---

### 步驟 2：建立 `electron/services/mcp/server-standalone.ts`（獨立啟動入口）

**新建檔案**，作為 MCP Server 的獨立執行入口。

```typescript
// 供外部 MCP Client 直接呼叫的獨立 script
// 用法：node server-standalone.js
// 或在 Claude Desktop config 中設定：
//   "mcpServers": {
//     "agentos-ump": {
//       "command": "node",
//       "args": ["/path/to/server-standalone.js"]
//     }
//   }

import { createServer } from './server'

async function main() {
  const server = createServer({
    dbPath: process.env.AGENTOS_DB_PATH || path.join(homedir(), 'AgentOS', 'data', 'ump.db'),
    agentosRoot: process.env.AGENTOS_ROOT || path.join(homedir(), 'AgentOS'),
  })
  await server.start()
}

main().catch(console.error)
```

---

### 步驟 3：`server.ts` 如何重用 `hub.ts`

**不修改 `hub.ts`**，直接 import 並實例化：

```typescript
import { MemoryHub } from '../ump/hub'
import { MemoryExchange } from '../ump/exchange'
import { AgentOSBridge } from '../ump/bridge'
import { Orchestrator } from '../orchestrator/orchestrator'

// 在 server.ts 中：
const hub = new MemoryHub()
await hub.initialize()

const exchange = new MemoryExchange()
// ... 註冊 agents

// Tool handler 直接呼叫 hub 方法：
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ump_search_memory',
        description: '搜尋 AgentOS UMP 記憶庫',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜尋關鍵字' },
            memoryType: { type: 'string', enum: ['semantic', 'episodic', 'procedural', 'graph'] },
            limit: { type: 'number', default: 10 },
          },
          required: ['query'],
        },
      },
      // ... 其他 tools
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  switch (name) {
    case 'ump_search_memory':
      return hub.searchByContent(args.query, {
        memoryType: args.memoryType,
        limit: args.limit,
      })
    case 'ump_get_memory':
      return hub.getMemory(args.id)
    case 'ump_add_memory': {
      const { createMemory } = await import('../ump/schemas')
      const mem = createMemory({
        id: crypto.randomUUID(),
        content: args.content,
        memory_type: args.memoryType || 'episodic',
        tags: args.tags || [],
        group_id: args.groupId,
      })
      return hub.addMemory(mem)
    }
    // ... 其他 cases
  }
})
```

**關鍵：完全不改動 `hub.ts`**，只在其上層包一層 MCP 協議適配。

---

### 步驟 4：修改 `electron/main.ts` — MCP Server 啟動管理

**在 MCP Client section 之後** 新增 MCP Server 管理：

```typescript
// === MCP Server (AgentOS as MCP Server) ===
let mcpServerProcess: ChildProcess | null = null

ipcMain.handle('mcp-server:start', () => {
  if (mcpServerProcess) return { success: true, message: '已運行' }
  const serverPath = path.join(__dirname, 'services', 'mcp', 'server-standalone.js')
  mcpServerProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      AGENTOS_DB_PATH: path.join(os.homedir(), 'AgentOS', 'data', 'ump.db'),
      AGENTOS_ROOT: path.join(os.homedir(), 'AgentOS'),
    },
  })
  mcpServerProcess.on('exit', () => { mcpServerProcess = null })
  return { success: true }
})

ipcMain.handle('mcp-server:stop', () => {
  if (mcpServerProcess) {
    mcpServerProcess.kill()
    mcpServerProcess = null
  }
  return { success: true }
})

ipcMain.handle('mcp-server:status', () => {
  return { running: mcpServerProcess !== null && !mcpServerProcess.killed }
})
```

**preload.ts 新增：**
```typescript
mcpServerStart: () => ipcRenderer.invoke('mcp-server:start'),
mcpServerStop: () => ipcRenderer.invoke('mcp-server:stop'),
mcpServerStatus: () => ipcRenderer.invoke('mcp-server:status'),
```

**electron.d.ts 新增：**
```typescript
mcpServerStart: () => Promise<{ success: boolean; message?: string }>
mcpServerStop: () => Promise<{ success: boolean }>
mcpServerStatus: () => Promise<{ running: boolean }>
```

---

### 步驟 5：Claude Desktop 整合配置

在 UI 中提供「一鍵複製 Claude Desktop 配置」功能，產出：

```json
{
  "mcpServers": {
    "agentos-ump": {
      "command": "node",
      "args": ["/path/to/agentos/dist-electron/services/mcp/server-standalone.js"],
      "env": {
        "AGENTOS_DB_PATH": "C:\\Users\\<user>\\AgentOS\\data\\ump.db",
        "AGENTOS_ROOT": "C:\\Users\\<user>\\AgentOS"
      }
    }
  }
}
```

---

### MCP Server 實作工作量估算

| 任務 | 預估工時 | 備註 |
|------|---------|------|
| `server.ts` — MCP Server 核心 | 8h | 12 tools + 5 resources + 3 prompts |
| `server-standalone.ts` — 獨立入口 | 2h | 環境變數處理 + DB 初始化 |
| hub.ts 重用驗證 | 1h | 確認 MemoryHub 可在獨立進程中運作 |
| `main.ts` — Server 管理 IPC | 2h | start/stop/status + quit cleanup |
| `preload.ts` — bridge | 0.5h | 3 個方法 |
| `electron.d.ts` — 型別 | 0.5h | 3 個方法 |
| UI — MCP Server 控制面板 | 3h | 啟停開關 + 連線狀態 + 配置匯出 |
| 端對端測試 | 3h | 用 Claude Desktop 或 MCP Inspector 測試 |
| **小計** | **20h** | |

---

## 三、型別重複合併方案

### 現狀分析

`src/types/index.ts` 與 `electron/services/*.ts` 之間存在 **8 組重複型別**。目前 electron 後端程式碼**完全不 import** `src/types/index.ts`，兩邊各自獨立定義。

| 重複型別 | `src/types/index.ts` | `electron/services/` | 完全相同？ |
|----------|---------------------|---------------------|-----------|
| `GpuInfo` | L1-7 | `hardware.ts` L7-13 | ✅ 完全相同 |
| `HardwareInfo` | L9-19 | `hardware.ts` L15-25 | ✅ 完全相同 |
| `ProviderModel` | L42-48 | `model-providers.ts` L1-7 | ✅ 完全相同 |
| `ModelProvider` | L50-60 | `model-providers.ts` L9-19 | ✅ 完全相同 |
| `ProviderId` | L40 | `model-providers.ts` L21 | ✅ 完全相同 |
| `InstallOptions` | L62-71 | `installer.ts` L7-16 | ✅ 完全相同 |
| `ProgressData` | L85-89 | `installer.ts` L18-22 | ✅ 完全相同 |
| `Source` | electron.d.ts L192-201 | `source.ts` L6-15 | ✅ 完全相同 |
| `Notebook` | electron.d.ts L170-179 | `notebook.ts` L4-13 | ✅ 完全相同 |
| `Note` | electron.d.ts L181-190 | `notebook.ts` L15-24 | ✅ 完全相同 |
| `SystemAgent` | electron.d.ts L203-212 | `system-detector.ts` L8-17 | ✅ 完全相同 |
| `ResearchReport` | index.ts L114-138 | `report-generator.ts` L10-16 | ❌ index.ts 版本更完整 |

---

### 合併策略：建立 `shared/types.ts`

**原則：** 建立一個 `shared/` 目錄，前後端共用型別定義。不修改現有 `hub.ts`、`schemas.ts` 等核心模組的內部型別，只合併「對外暴露」的型別。

#### 新建檔案：`shared/types.ts`

將以下型別從 `src/types/index.ts` 搬到 `shared/types.ts`：

```typescript
// shared/types.ts — 前後端共用型別

// === Hardware ===
export interface GpuInfo { ... }      // 從 src/types/index.ts:1-7
export interface HardwareInfo { ... }  // 從 src/types/index.ts:9-19

// === Model Providers ===
export type ProviderId = 'ollama' | 'openrouter' | 'anthropic' | 'openai'
export interface ProviderModel { ... } // 從 src/types/index.ts:42-48
export interface ModelProvider { ... } // 從 src/types/index.ts:50-60

// === Installation ===
export interface InstallOptions { ... } // 從 src/types/index.ts:62-71
export interface ProgressData { ... }   // 從 src/types/index.ts:85-89

// === Agent ===
export type RunMode = 'local' | 'api' | 'both'
export type ModelPreference = 'speed' | 'memory' | 'auto'
export interface AgentInfo { ... }     // 從 src/types/index.ts:21-36

// === Memory ===
export interface MemoryStats { ... }   // 從 src/types/index.ts:79-83
export interface MemoryItem { ... }    // 從 src/types/index.ts:104-110

// === Catalog ===
export interface CatalogAgent { ... }  // 從 src/types/index.ts:92-102

// === Research ===
export type ReferenceType = 'news' | 'paper' | 'web' | 'video' | 'code' | 'discussion'
export interface ResearchReport { ... } // 從 src/types/index.ts:114-138（完整版）

// === Notebook ===
export interface Notebook { ... }      // 從 electron/services/notebook.ts:4-13
export interface Note { ... }          // 從 electron/services/notebook.ts:15-24

// === Source ===
export interface Source { ... }        // 從 electron/services/source.ts:6-15

// === System Agent ===
export interface SystemAgent { ... }   // 從 electron/services/system-detector.ts:8-17
```

---

### 修改清單

#### 1. `src/types/index.ts` — 改為 re-export

**修改為：**
```typescript
// 保留此檔案以維持向後相容，所有型別改從 shared/types.ts 匯入
export type {
  GpuInfo,
  HardwareInfo,
  ProviderId,
  ProviderModel,
  ModelProvider,
  RunMode,
  ModelPreference,
  AgentInfo,
  InstallOptions,
  ProgressData,
  MemoryStats,
  MemoryItem,
  CatalogAgent,
  ReferenceType,
  ResearchReport,
} from '../../shared/types'
```

**影響範圍：** `src/types/index.ts` 被 `src/types/electron.d.ts` import（第 4-15 行），以及前端 React 元件可能直接 import。改為 re-export 後**不影響任何既有呼叫點**。

#### 2. `src/types/electron.d.ts` — 改 import 路徑

**修改第 4-15 行：**
```typescript
// 現有：
import type {
  HardwareInfo, ModelProvider, ProviderModel, AgentInfo,
  InstallOptions, InstallProgress, MemoryItem, MemoryStats,
  ProgressData, CatalogAgent,
} from './index'

// 改為：
import type {
  HardwareInfo, ModelProvider, ProviderModel, AgentInfo,
  InstallOptions, InstallProgress, MemoryItem, MemoryStats,
  ProgressData, CatalogAgent,
} from '../../shared/types'
```

**同時：** 刪除第 160-212 行的重複介面定義（`OrchestratorTask`、`Notebook`、`Note`、`Source`、`SystemAgent`），改為從 `shared/types` import。

但 `OrchestratorTask` 是 IPC 專用型別（在 `electron.d.ts` 中定義是正確的），保留不動。

#### 3. `electron/services/hardware.ts` — 改 import

**修改第 1 行附近（無顯式 import，型別是 local 定義）：**

刪除第 7-25 行的 `GpuInfo` 和 `HardwareInfo` 定義，改為：
```typescript
import type { GpuInfo, HardwareInfo } from '../../shared/types'
```

**影響範圍：** `hardware.ts` 被 `main.ts:6` 和 `installer.ts:2` import。改為 re-export 後不影響。

#### 4. `electron/services/model-providers.ts` — 改 import

**刪除第 1-21 行**的 `ProviderModel`、`ModelProvider`、`ProviderId` 定義，改為：
```typescript
import type { ProviderModel, ModelProvider, ProviderId } from '../../shared/types'
export type { ProviderModel, ModelProvider, ProviderId }
```

**影響範圍：** `model-providers.ts` 被 `main.ts:13` 和 `installer.ts:5` import。加 `export type` 後不影響。

#### 5. `electron/services/installer.ts` — 改 import

**刪除第 7-22 行**的 `InstallOptions` 和 `ProgressData` 定義，改為：
```typescript
import type { InstallOptions, ProgressData, HardwareInfo } from '../../shared/types'
```

**影響範圍：** `installer.ts` 被 `main.ts:10` import。不影響。

#### 6. `electron/services/source.ts` — 改 import

**刪除第 6-15 行**的 `Source` 定義，改為：
```typescript
import type { Source } from '../../shared/types'
export type { Source }
```

**影響範圍：** 被 `main.ts` 動態 import。不影響。

#### 7. `electron/services/notebook.ts` — 改 import

**刪除第 4-24 行**的 `Notebook` 和 `Note` 定義，改為：
```typescript
import type { Notebook, Note } from '../../shared/types'
export type { Notebook, Note }
```

**影響範圍：** 被 `main.ts` 動態 import。不影響。

#### 8. `electron/services/system-detector.ts` — 改 import

**刪除第 8-17 行**的 `SystemAgent` 定義，改為：
```typescript
import type { SystemAgent } from '../../shared/types'
export type { SystemAgent }
```

**影響範圍：** 被 `main.ts:18` import。不影響。

#### 9. `tsconfig.json` — 新增 shared 目錄

**修改 `include`：**
```json
{
  "include": ["src", "electron", "shared"]
}
```

**修改 `paths`：**
```json
{
  "paths": {
    "@/*": ["src/*"],
    "@shared/*": ["shared/*"]
  }
}
```

---

### 不動的型別（保留在原處）

以下型別**不合併**，保留在各自的 service 檔案中：

| 型別 | 位置 | 理由 |
|------|------|------|
| `UniversalMemory` | `ump/schemas.ts` | UMP 協議核心型別，不應暴露為共用 |
| `MemoryType` | `ump/schemas.ts` | 同上 |
| `Session` / `Message` / `Task` | `ump/hub.ts` | Hub 內部型別，已有 IPC 包裝 |
| `AgentManifest` / `AgentStatus` | `agent-manager.ts` | Agent 管理專用 |
| `AgentController` | 各 controller | Orchestrator 內部介面 |
| `Task` / `TaskGraph` / `AgentType` | `task-analyzer.ts` | Orchestrator 內部型別 |
| `Councillor` / `Deliberation` | `council.ts` | Council 專用 |
| `BrainRequest` / `BrainResponse` | `BrainService.ts` | Fusion-Loop 專用 |
| `ModelConfig` | `useModelConfig.ts` | 前端 Hook 專用 |
| `McpServerConfig` / `McpToolInfo` | 新增 MCP 型別 | MCP 專用 |

---

### 型別合併工作量估算

| 任務 | 預估工時 | 備註 |
|------|---------|------|
| 建立 `shared/types.ts` | 2h | 搬移 + 整理 12 個型別 |
| `src/types/index.ts` 改為 re-export | 0.5h | 維持向後相容 |
| `src/types/electron.d.ts` 改 import + 刪重複 | 1h | 改路徑 + 刪 5 個重複介面 |
| `hardware.ts` 刪重複 + import | 0.5h | 刪 GpuInfo/HardwareInfo |
| `model-providers.ts` 刪重複 + import | 0.5h | 刪 ProviderModel/ModelProvider/ProviderId |
| `installer.ts` 刪重複 + import | 0.5h | 刪 InstallOptions/ProgressData |
| `source.ts` 刪重複 + import | 0.5h | 刪 Source |
| `notebook.ts` 刪重複 + import | 0.5h | 刪 Notebook/Note |
| `system-detector.ts` 刪重複 + import | 0.5h | 刪 SystemAgent |
| `tsconfig.json` 更新 | 0.5h | include + paths |
| 型別檢查驗證 | 1h | `npm run test`（tsc --noEmit） |
| **小計** | **8h** | |

---

## 四、總工作量與排程

| Phase | 任務 | 工時 | 依賴 |
|-------|------|------|------|
| **Phase 0** | 型別合併（shared/types.ts） | 8h | 無 |
| **Phase 1a** | MCP Client — client.ts | 11h | Phase 0 |
| **Phase 1b** | MCP Client — IPC + preload + d.ts | 5h | Phase 1a |
| **Phase 1c** | MCP Client — Orchestrator 接線 | 2h | Phase 1a |
| **Phase 1d** | MCP Client — UI 頁面 | 6.5h | Phase 1b |
| **Phase 2a** | MCP Server — server.ts | 10h | Phase 0 |
| **Phase 2b** | MCP Server — IPC + standalone | 3h | Phase 2a |
| **Phase 2c** | MCP Server — UI + 測試 | 6h | Phase 2b |
| | **總計** | **52h** | |

### 建議執行順序

1. **Phase 0**（Day 1）：型別合併，消除技術債
2. **Phase 1a → 1b → 1c → 1d**（Day 2-4）：MCP Client，讓 AgentOS 可以呼叫外部工具
3. **Phase 2a → 2b → 2c**（Day 5-7）：MCP Server，讓 AgentOS 能力可以被外部呼叫

Phase 1 與 Phase 2 互相獨立，可以平行開發（如果人力允許）。

### 風險提醒

1. **MCP SDK ESM 相容性**：專案使用 `"type": "module"` + `"module": "ESNext"`，MCP SDK 1.29.0 支援 ESM，但需驗證 `StdioClientTransport` 在 Electron 主程序中的子程序 spawn 是否正常
2. **Windows stdio 編碼**：Windows 下 `child_process.spawn` 的 stdio 預設使用系統編碼（Big5/GBK），需設定 `{ encoding: 'utf-8' }` 或使用 `Buffer` 處理
3. **UMP Hub 跨進程存取**：MCP Server 作為獨立進程時，`MemoryHub` 需要自己初始化 SQLite 連線，不能共用主程序的 hub 實例（SQLite 不支持多進程寫入）
4. **MCP 協議版本**：協議仍在演進中，建議 lock MCP SDK 版本，定期手動更新
