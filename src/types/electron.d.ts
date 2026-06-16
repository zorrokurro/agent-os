// Type declarations for window.electronAPI
// This file is referenced by tsconfig.json and provides types for all IPC bridges

import type {
  HardwareInfo,
  ModelProvider,
  ProviderModel,
  AgentInfo,
  InstallOptions,
  InstallProgress,
  MemoryItem,
  MemoryStats,
  ProgressData,
  CatalogAgent,
} from './index'

declare global {
  interface Window {
    electronAPI: {
      getHardwareInfo: () => Promise<HardwareInfo>
      getProviders: () => Promise<ModelProvider[]>
      getProviderModels: (providerId: string) => Promise<ProviderModel[]>
      getDefaultModel: (providerId: string) => Promise<string>
      // Council
      councilGetCouncillorResponses: (apiKey: string, model: string, question: string, mode: string) => Promise<Array<{ id: string; name: string; response: string; error?: string }>>
      councilGetPeerRankings: (apiKey: string, model: string, question: string, councillorResponses: Array<{ id: string; name: string; response: string }>) => Promise<Record<string, number>>
      councilGetChairmanSynthesis: (apiKey: string, model: string, question: string, councillorResponses: Array<{ id: string; name: string; response: string }>, rankings: Record<string, number>) => Promise<string>
      openrouterChat: (apiKey: string, model: string, messages: Array<{ role: string; content: string }>) => Promise<string>
      testHermesConnection: (hermesUrl: string) => Promise<{ ok: boolean; message: string }>
      checkOllama: () => Promise<{ installed: boolean; running: boolean }>
      installOllama: () => Promise<{ success: boolean; error?: string }>
      pullModel: (model: string) => Promise<{ success: boolean; error?: string }>
      listModels: () => Promise<string[]>
      getModelConfig: () => Promise<Record<string, string>>
      setModelConfig: (config: Record<string, string>) => Promise<boolean>
      chat: (model: string, messages: Array<{ role: string; content: string }>) => Promise<string>
      chatStream: (model: string, messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean; reply?: string; error?: string }>
      aiChat: (params: { model: string; messages: Array<{ role: string; content: string }>; baseUrl?: string }) => Promise<string>
      listApiModels: () => Promise<string[]>
      getAgents: () => Promise<AgentInfo[]>
      startAgent: (id: string) => Promise<{ success: boolean; error?: string; port?: number }>
      stopAgent: (id: string) => Promise<{ success: boolean; error?: string }>
      getAgentStatus: (id: string) => Promise<{ status: 'stopped' | 'running' | 'error' }>
      importAgentFromGitHub: (url: string) => Promise<{ success: boolean; message: string }>
      installAgent: (options: InstallOptions) => Promise<{ success: boolean; error?: string }>
      upgradeAgent: (id: string) => Promise<{ success: boolean; error?: string }>
      getFavorites: () => Promise<string[]>
      toggleFavorite: (agentId: string) => Promise<{ success: boolean; favorites: string[] }>
      isFavorite: (agentId: string) => Promise<boolean>
      healthCheckAgent: (id: string) => Promise<{ healthy: boolean }>
      getAgentLogs: (id: string) => Promise<{ logs: string[] }>
      getAgentDocs: (id: string) => Promise<{ description: string; readme: string }>
      runInstallation: (options: InstallOptions) => Promise<{ success: boolean; error?: string; hardware: HardwareInfo | null }>
      getSettings: () => Promise<Record<string, unknown>>
      setSettings: (settings: Record<string, unknown>) => Promise<void>
      getFullSettings: () => Promise<{ ollamaUrl: string; apiProvider: string; apiKey: string; apiModel: string }>
      setFullSettings: (s: Partial<{ ollamaUrl: string; apiProvider: string; apiKey: string; apiModel: string }>) => Promise<boolean>
      getMemoryItems: () => Promise<{ items: MemoryItem[]; stats: MemoryStats }>
      getMemoryItemContent: (filePath: string) => Promise<{ success: boolean; content: string }>
      saveMemoryItem: (filePath: string, content: string) => Promise<{ success: boolean }>
      saveConversation: (agentName: string, messages: Array<{ role: string; content: string }>) => Promise<{ success: boolean }>
      runResearch: (options: { query: string; sources?: string[] }) => Promise<{ research: unknown; report: unknown }>
      onInstallProgress: (callback: (data: ProgressData) => void) => () => void
      onChatToken: (callback: (token: string) => void) => () => void
      onChatDone: (callback: (reply: string) => void) => () => void
      onChatError: (callback: (error: string) => void) => () => void
      onHealthCheckResult: (callback: (data: { healthy: boolean; services: unknown[]; issues: string[] }) => void) => () => void
      onThemeChanged: (callback: (darkMode: boolean) => void) => () => void
      onUpdateStatus: (callback: (data: { state: string; version?: string; releaseDate?: string; percent?: number; message?: string }) => void) => () => void
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>
      quitAndInstall: () => Promise<void>
      getAgentCatalog: () => Promise<{ agents: CatalogAgent[] }>

      // UMP (Universal Memory Protocol)
      umpDiscoverScan: () => Promise<unknown[]>
      umpDiscoverUnregistered: () => Promise<unknown[]>
      umpDiscoverWithMemory: () => Promise<unknown[]>
      umpDiscoverRegisterAll: () => Promise<{ registered: string[] }>
      umpDiscoverConsolidate: (agentId: string) => Promise<{ agent_id: string; memories_consolidated: number; files_processed: number; errors: string[] }>
      umpBridgeConnect: () => Promise<{ success: boolean; status: unknown }>
      umpBridgeImport: () => Promise<{ success: boolean; count: number; hub_stats: unknown }>
      umpBridgeExport: () => Promise<{ success: boolean; files: string[] }>
      umpBridgeSync: () => Promise<{ success: boolean; result: unknown }>
      umpBridgeStatus: () => Promise<unknown>
      umpHubSearch: (query: string, opts?: { memoryType?: string; groupId?: string; limit?: number }) => Promise<unknown[]>
      umpHubStats: () => Promise<unknown>
      umpHubAll: () => Promise<unknown[]>
      umpExchangeRegister: (agentId: string, name: string, description: string) => Promise<unknown>
      umpExchangeStats: () => Promise<unknown>
      umpAddMemory: (params: { content: string; memoryType?: string; tags?: string[]; group_id?: string }) => Promise<boolean>

      // UMP Conversations
      umpConversations: (agentName?: string, limit?: number) => Promise<Array<{ session: { id: string; agent_name: string; agent_id: string; created_at: string; updated_at: string; total_tokens: number }; messages: Array<{ id: string; session_id: string; role: string; content: string; token_count: number; created_at: string; metadata: Record<string, unknown> }> }>>
      umpSessionMessages: (sessionId: string) => Promise<Array<{ id: string; session_id: string; role: string; content: string; token_count: number; created_at: string; metadata: Record<string, unknown> }>>
      umpSessionStats: () => Promise<{ total_sessions: number; total_messages: number; total_tokens: number }>
      // Task Queue
      umpCreateTask: (title: string, content: string, target: string, source?: string) => Promise<{ id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }>
      umpGetTasks: (target?: string, status?: string) => Promise<Array<{ id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }>>
      umpUpdateTask: (id: string, status: string, result?: string) => Promise<boolean>
      umpGetPendingTasks: (target: string) => Promise<Array<{ id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }>>

      // System Agent Detection
      systemDetectAll: () => Promise<SystemAgent[]>
      systemDetectDirectories: (dirs: string[]) => Promise<SystemAgent[]>
      systemAddToLibrary: (agent: { id: string; name: string; description: string; version?: string; icon?: string; configDirs?: string[]; dataDirs?: string[] }) => Promise<{ success: boolean; agentId?: string; error?: string }>

      // Notebook
      notebookList: () => Promise<Notebook[]>
      notebookGet: (id: string) => Promise<Notebook | null>
      notebookCreate: (name: string, description?: string, icon?: string, color?: string) => Promise<Notebook>
      notebookUpdate: (id: string, updates: Partial<Pick<Notebook, 'name' | 'description' | 'icon' | 'color'>>) => Promise<Notebook | null>
      notebookDelete: (id: string) => Promise<boolean>
      noteList: (notebookId: string) => Promise<Note[]>
      noteGet: (id: string) => Promise<Note | null>
      noteCreate: (notebookId: string, title: string, content?: string, tags?: string[]) => Promise<Note>
      noteUpdate: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'pinned'>>) => Promise<Note | null>
      noteDelete: (id: string) => Promise<boolean>
      noteSearch: (query: string, notebookId?: string, limit?: number) => Promise<Note[]>
      noteAllTags: () => Promise<Array<{ tag: string; count: number }>>
      noteByTag: (tag: string, limit?: number) => Promise<Note[]>

      // Sources
      sourceImportPDF: (notebookId: string) => Promise<Source | { canceled: boolean } | { error: string }>
      sourceImportURL: (url: string, notebookId: string) => Promise<Source | { error: string }>
      sourceImportText: (text: string, notebookId: string) => Promise<Source | { error: string }>
      sourceGet: (notebookId: string) => Promise<Source[]>
      sourceDelete: (sourceId: string) => Promise<boolean>

      // Orchestrator
      orchestratorExecute: (prompt: string) => Promise<string>
      onOrchestratorProgress: (callback: (data: { message: string; tasks?: OrchestratorTask[] }) => void) => () => void
      onOrchestratorTaskStart: (callback: (data: { taskId: string; message: string }) => void) => () => void
      onOrchestratorTaskComplete: (callback: (data: { taskId: string; message: string; result: string }) => void) => () => void
      onOrchestratorTaskFail: (callback: (data: { taskId: string; message: string }) => void) => () => void
      onOrchestratorResult: (callback: (data: { message: string; result: string }) => void) => () => void

      // GitHub Installer
      githubAnalyze: (url: string) => Promise<{ name: string; description: string; stack: 'node' | 'python' | 'unknown'; installCommands: string[] }>
      githubInstall: (url: string, onLog: (line: string) => void) => Promise<{ success: boolean; path: string; error?: string }>

      // Discord
      discordStart: () => Promise<{ success: boolean; message: string }>
      discordStop: () => Promise<{ success: boolean; message: string }>
      discordSend: (text: string) => Promise<{ success: boolean; message: string }>
      discordTest: () => Promise<{ success: boolean; message: string }>
      discordStatus: () => Promise<{ running: boolean }>

      // Obsidian Sync
      obsidianExport: () => Promise<{ exported: number; errors: string[] }>
      obsidianImport: () => Promise<{ imported: number; updated: number; skipped: number; errors: string[] }>
      obsidianSync: () => Promise<{ imported: number; updated: number; skipped: number; exported: number; errors: string[] }>
      obsidianTest: (vaultPath: string) => Promise<{ ok: boolean; message: string }>
      obsidianWatch: () => Promise<{ success: boolean; message: string }>
      obsidianWatchStop: () => Promise<{ success: boolean }>
    }
  }
}

export interface OrchestratorTask {
  id: string
  description: string
  assignedAgent: string
  dependencies: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  error?: string
}

export interface Notebook {
  id: string
  name: string
  description: string
  icon: string
  color: string
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  notebookId: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface Source {
  id: string
  title: string
  type: 'pdf' | 'url' | 'text'
  preview: string
  content: string
  tags: string[]
  createdAt: string
  metadata: Record<string, unknown>
}

export interface SystemAgent {
  id: string
  name: string
  source: 'ollama' | 'pip' | 'npm' | 'path' | 'docker' | 'directory' | 'standalone'
  version: string
  description: string
  installed: boolean
  running: boolean
  details: Record<string, unknown>
}

export {}
