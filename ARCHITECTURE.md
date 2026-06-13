# Agent Harness 架構文件

## 概覽

Agent Harness 是一個底層框架，提供 AI Agent 應用程式所需的核心功能：

1. **UMP 記憶層** - Universal Memory Protocol 的完整實作
2. **Agent 偵測** - 系統級 Agent 自動發現和管理
3. **Electron 模組** - 可重用的 UI 組件和 IPC 架構

## UMP 記憶層

### 核心模組

| 檔案 | 功能 |
|------|------|
| `electron/services/ump/schemas.ts` | 型別定義（UniversalMemory, MemoryType, etc.） |
| `electron/services/ump/hub.ts` | 中央記憶倉庫（SQLite 持久化） |
| `electron/services/ump/exchange.ts` | Agent 間記憶交換系統 |
| `electron/services/ump/bridge.ts` | AgentOS 檔案系統橋接器 |
| `electron/services/ump/discovery.ts` | Agent 自動探測與記憶整合 |
| `electron/services/ump/adapters.ts` | 記憶格式轉換適配器 |

### 資料庫結構

位置：`~/AgentOS/data/ump.db`（SQLite）

**memories 表**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  schema_version TEXT,
  content TEXT,
  memory_type TEXT,        -- semantic/episodic/procedural/graph
  group_id TEXT,
  importance REAL,
  tags TEXT,               -- JSON array
  temporal TEXT,           -- JSON object
  provenance TEXT,         -- JSON object
  metadata TEXT            -- JSON object
);
```

**sessions 表**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_name TEXT,
  agent_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  total_tokens INTEGER
);
```

**messages 表**
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,               -- user/assistant/system
  content TEXT,
  token_count INTEGER,
  created_at TEXT,
  metadata TEXT
);
```

### API

**MemoryHub**
```typescript
const hub = new MemoryHub()
await hub.initialize()

// 記憶操作
hub.addMemory(memory: UniversalMemory): boolean
hub.getMemory(id: string): UniversalMemory | undefined
hub.deleteMemory(id: string): boolean
hub.searchByContent(query: string, opts?): UniversalMemory[]

// 適配器註冊
hub.registerAdapter(name, adapter)
hub.importFromAdapter(adapterName, data)
hub.exportToAdapter(memoryId, adapterName)

// 相關記憶
hub.getRelatedMemories(memoryId, relationType?, limit?)

// 對話操作
hub.createSession(agentName, agentId): Session
hub.addMessage(sessionId, role, content, tokenCount?)
hub.getSessionMessages(sessionId): Message[]
```

**MemoryExchange**
```typescript
const exchange = new MemoryExchange()

// Agent 管理
await exchange.registerAgent(agentId, name, description)
exchange.getAgent(agentId): AgentInfo | undefined

// 記憶共享
exchange.shareMemory(sourceAgent, targetAgent, memoryId, permission)
exchange.revokeMemory(sourceAgent, targetAgent, memoryId)
exchange.getSharedMemories(sourceAgent, targetAgent): MemoryShareRecord[]

// 同步
exchange.syncAgent(request: SyncResponse): SyncResponse
exchange.batchAddMemories(agentId, memories): number

// 搜尋
exchange.searchAcrossAgents(query, agentIds?, memoryType?, limit?)
```

**AgentOSBridge**
```typescript
const bridge = new AgentOSBridge(agentosRoot, hub, exchange)

// 連接
await bridge.connect()

// 記憶匯入/匯出
await bridge.importAllMemories(): number
await bridge.exportAllMemories(): string[]
bridge.importFile(filePath): UniversalMemory | null
bridge.exportFile(memoryId): string | null

// Agent 註冊
bridge.registerAgents(): number
await bridge.registerAgentWithMemory(agentId): boolean

// 同步
await bridge.fullSync(): SyncResult
bridge.status(): BridgeStatus
```

**AgentDiscovery**
```typescript
const discovery = new AgentDiscovery(agentosRoot)

// 掃描
discovery.scan(): DiscoveredAgent[]
discovery.getUnregistered(): DiscoveredAgent[]
discovery.getRegistered(): DiscoveredAgent[]
discovery.getWithMemory(): DiscoveredAgent[]

// 註冊
discovery.registerAgent(agentId): boolean
discovery.registerAgents(agentIds): Record<string, boolean>
discovery.registerAllUnregistered(): string[]

// 記憶整合
discovery.consolidateMemories(agentId, hub): ConsolidationResult
discovery.consolidateAll(hub): ConsolidationResult[]

// 完整流程
discovery.discoverAndConsolidate(hub?, exchange?, autoRegister?, consolidate?)
```

## IPC Handler 清單

### 硬體與 Ollama
| Channel | 功能 |
|---------|------|
| `get-hardware-info` | 偵測 CPU/RAM/GPU |
| `check-ollama` | 檢查 Ollama 狀態 |
| `install-ollama` | 安裝 Ollama |
| `pull-model` | 下載模型 |
| `list-models` | 列出已安裝模型 |
| `chat` | 非串流聊天 |
| `chat-stream` | 串流聊天 |

### Agent 管理
| Channel | 功能 |
|---------|------|
| `get-agents` | 取得 Agent 列表 |
| `start-agent` | 啟動 Agent |
| `stop-agent` | 停止 Agent |
| `get-agent-status` | 取得 Agent 狀態 |
| `install-agent` | 安裝 Agent |
| `upgrade-agent` | 升級 Agent |
| `import-agent-from-github` | 從 GitHub 匯入 |
| `get-agent-logs` | 取得 Agent 日誌 |
| `get-agent-docs` | 取得 Agent 文件 |

### 記憶層
| Channel | 功能 |
|---------|------|
| `get-memory-items` | 取得記憶項目（檔案+SQLite） |
| `get-memory-item-content` | 取得記憶內容 |
| `save-memory-item` | 儲存記憶 |
| `save-conversation` | 儲存對話 |

### UMP 協議
| Channel | 功能 |
|---------|------|
| `ump-discover-scan` | 掃描 Agent |
| `ump-discover-unregistered` | 取得未註冊 Agent |
| `ump-discover-with-memory` | 取得有記憶的 Agent |
| `ump-discover-register-all` | 註冊所有未註冊 Agent |
| `ump-discover-consolidate` | 整合 Agent 記憶 |
| `ump-bridge-connect` | 連接橋接器 |
| `ump-bridge-import` | 匯入記憶 |
| `ump-bridge-export` | 匯出記憶 |
| `ump-bridge-sync` | 完整同步 |
| `ump-bridge-status` | 取得橋接器狀態 |
| `ump-hub-search` | 搜尋記憶 |
| `ump-hub-stats` | 取得統計 |
| `ump-hub-all` | 取得所有記憶 |
| `ump-exchange-register` | 註冊 Agent |
| `ump-exchange-stats` | 取得交換統計 |
| `ump-conversations` | 取得對話列表 |
| `ump-session-messages` | 取得對話訊息 |
| `ump-session-stats` | 取得對話統計 |

### 系統偵測
| Channel | 功能 |
|---------|------|
| `system-detect-all` | 全面系統掃描 |
| `system-detect-directories` | 掃描自訂目錄 |
| `system-add-to-library` | 加入收藏庫 |

### 設定與更新
| Channel | 功能 |
|---------|------|
| `get-settings` | 取得設定 |
| `set-settings` | 儲存設定 |
| `get-providers` | 取得 AI 提供者 |
| `get-provider-models` | 取得模型列表 |
| `check-for-updates` | 檢查更新 |
| `download-update` | 下載更新 |
| `quit-and-install` | 重啟安裝 |

## 在新專案中使用

### 1. 複製 UMP 模組

```bash
cp -r electron/services/ump/ your-project/electron/services/ump/
```

### 2. 安裝依賴

```bash
npm install sql.js @types/sql.js
```

### 3. 初始化 MemoryHub

```typescript
import { MemoryHub } from './services/ump/hub'

const hub = new MemoryHub()
await hub.initialize()

// 匯入記憶
hub.addMemory({
  id: 'my-memory',
  content: '這是一段記憶',
  memory_type: 'semantic',
  read_only: false,
  hidden: false,
  temporal: { created_at: new Date().toISOString() },
  provenance: { source: 'my-app', original_format: 'text', source_description: '', confidence: 1.0, extracted_at: new Date().toISOString() },
  tags: ['example'],
  importance: 0.5,
  relations: [],
  metadata: {},
  conversion_warnings: [],
})
```

### 4. 註冊 IPC Handler

```typescript
import { ipcMain } from 'electron'
import { MemoryHub } from './services/ump/hub'

const hub = new MemoryHub()

ipcMain.handle('my-memory-search', async (_, query: string) => {
  return hub.searchByContent(query, { limit: 10 })
})
```

### 5. 前端呼叫

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  myMemorySearch: (query) => ipcRenderer.invoke('my-memory-search', query),
})

// React 組件
const results = await window.electronAPI.myMemorySearch('搜尋關鍵字')
```
