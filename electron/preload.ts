const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Hardware
  getHardwareInfo: () => ipcRenderer.invoke('get-hardware-info'),

  // Providers
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getProviderModels: (providerId: string) => ipcRenderer.invoke('get-provider-models', providerId),
  getDefaultModel: (providerId: string) => ipcRenderer.invoke('get-default-model', providerId),

  // Council
  councilGetCouncillorResponses: (apiKey: string, model: string, question: string, mode: string) => ipcRenderer.invoke('council-get-councillor-responses', apiKey, model, question, mode),
  councilGetPeerRankings: (apiKey: string, model: string, question: string, councillorResponses: unknown[]) => ipcRenderer.invoke('council-get-peer-rankings', apiKey, model, question, councillorResponses),
  councilGetChairmanSynthesis: (apiKey: string, model: string, question: string, councillorResponses: unknown[], rankings: Record<string, number>) => ipcRenderer.invoke('council-get-chairman-synthesis', apiKey, model, question, councillorResponses, rankings),

  // OpenRouter
  openrouterChat: (apiKey: string, model: string, messages: unknown[]) => ipcRenderer.invoke('openrouter-chat', apiKey, model, messages),

  // Hermes
  testHermesConnection: (hermesUrl: string) => ipcRenderer.invoke('test-hermes-connection', hermesUrl),

  // Ollama
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  pullModel: (model: string) => ipcRenderer.invoke('pull-model', model),
  listModels: () => ipcRenderer.invoke('list-models'),
  getModelConfig: () => ipcRenderer.invoke('get-model-config'),
  setModelConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('set-model-config', config),
  chat: (model: string, messages: unknown[]) => ipcRenderer.invoke('chat', model, messages),
  chatStream: (model: string, messages: unknown[]) => ipcRenderer.invoke('chat-stream', model, messages),
  aiChat: (params: Record<string, unknown>) => ipcRenderer.invoke('ai-chat', params),
  listApiModels: () => ipcRenderer.invoke('list-api-models'),

  // Agent management
  getAgents: () => ipcRenderer.invoke('get-agents'),
  startAgent: (id: string) => ipcRenderer.invoke('start-agent', id),
  stopAgent: (id: string) => ipcRenderer.invoke('stop-agent', id),
  getAgentStatus: (id: string) => ipcRenderer.invoke('get-agent-status', id),
  importAgentFromGitHub: (url: string) => ipcRenderer.invoke('import-agent-from-github', url),
  installAgent: (options: Record<string, unknown>) => ipcRenderer.invoke('install-agent', options),
  upgradeAgent: (id: string) => ipcRenderer.invoke('upgrade-agent', id),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  toggleFavorite: (agentId: string) => ipcRenderer.invoke('toggle-favorite', agentId),
  isFavorite: (agentId: string) => ipcRenderer.invoke('is-favorite', agentId),
  healthCheckAgent: (id: string) => ipcRenderer.invoke('health-check-agent', id),
  getAgentLogs: (id: string) => ipcRenderer.invoke('get-agent-logs', id),
  getAgentDocs: (id: string) => ipcRenderer.invoke('get-agent-docs', id),

  // Installation
  runInstallation: (options: Record<string, unknown>) => ipcRenderer.invoke('run-installation', options),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('set-settings', settings),
  getFullSettings: () => ipcRenderer.invoke('get-full-settings'),
  setFullSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('set-full-settings', s),

  // Memory
  getMemoryItems: () => ipcRenderer.invoke('get-memory-items'),
  getMemoryItemContent: (filePath: string) => ipcRenderer.invoke('get-memory-item-content', filePath),
  saveMemoryItem: (filePath: string, content: string) => ipcRenderer.invoke('save-memory-item', filePath, content),
  saveConversation: (agentName: string, messages: unknown[]) => ipcRenderer.invoke('save-conversation', agentName, messages),

  // Research
  runResearch: (options: Record<string, unknown>) => ipcRenderer.invoke('run-research', options),

  // Event listeners
  onInstallProgress: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('install-progress', handler)
    return () => ipcRenderer.removeListener('install-progress', handler)
  },
  onChatToken: (callback: (token: string) => void) => {
    const handler = (_: unknown, token: string) => callback(token)
    ipcRenderer.on('chat-token', handler)
    return () => ipcRenderer.removeListener('chat-token', handler)
  },
  onChatDone: (callback: (reply: string) => void) => {
    const handler = (_: unknown, reply: string) => callback(reply)
    ipcRenderer.on('chat-done', handler)
    return () => ipcRenderer.removeListener('chat-done', handler)
  },
  onChatError: (callback: (error: string) => void) => {
    const handler = (_: unknown, error: string) => callback(error)
    ipcRenderer.on('chat-error', handler)
    return () => ipcRenderer.removeListener('chat-error', handler)
  },
  onHealthCheckResult: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('health-check-result', handler)
    return () => ipcRenderer.removeListener('health-check-result', handler)
  },
  onThemeChanged: (callback: (darkMode: boolean) => void) => {
    const handler = (_: unknown, darkMode: boolean) => callback(darkMode)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },

  // Auto Update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),

  // Agent Catalog Registry
  getAgentCatalog: () => ipcRenderer.invoke('get-agent-catalog'),

  // UMP (Universal Memory Protocol)
  umpDiscoverScan: () => ipcRenderer.invoke('ump-discover-scan'),
  umpDiscoverUnregistered: () => ipcRenderer.invoke('ump-discover-unregistered'),
  umpDiscoverWithMemory: () => ipcRenderer.invoke('ump-discover-with-memory'),
  umpDiscoverRegisterAll: () => ipcRenderer.invoke('ump-discover-register-all'),
  umpDiscoverConsolidate: (agentId: string) => ipcRenderer.invoke('ump-discover-consolidate', agentId),
  umpBridgeConnect: () => ipcRenderer.invoke('ump-bridge-connect'),
  umpBridgeImport: () => ipcRenderer.invoke('ump-bridge-import'),
  umpBridgeExport: () => ipcRenderer.invoke('ump-bridge-export'),
  umpBridgeSync: () => ipcRenderer.invoke('ump-bridge-sync'),
  umpBridgeStatus: () => ipcRenderer.invoke('ump-bridge-status'),
  umpHubSearch: (query: string, opts: Record<string, unknown>) => ipcRenderer.invoke('ump-hub-search', query, opts),
  umpHubStats: () => ipcRenderer.invoke('ump-hub-stats'),
  umpHubAll: () => ipcRenderer.invoke('ump-hub-all'),
  umpExchangeRegister: (agentId: string, name: string, description: string) => ipcRenderer.invoke('ump-exchange-register', agentId, name, description),
  umpExchangeStats: () => ipcRenderer.invoke('ump-exchange-stats'),
  umpAddMemory: (params: Record<string, unknown>) => ipcRenderer.invoke('ump-add-memory', params),

  // UMP Conversations
  umpConversations: (agentName: string, limit: number) => ipcRenderer.invoke('ump-conversations', agentName, limit),
  umpSessionMessages: (sessionId: string) => ipcRenderer.invoke('ump-session-messages', sessionId),
  umpSessionStats: () => ipcRenderer.invoke('ump-session-stats'),

  // Task Queue
  umpCreateTask: (title: string, content: string, target: string, source: string) => ipcRenderer.invoke('ump:create-task', title, content, target, source),
  umpGetTasks: (target: string, status: string) => ipcRenderer.invoke('ump:get-tasks', target, status),
  umpUpdateTask: (id: string, status: string, result: string) => ipcRenderer.invoke('ump:update-task', id, status, result),
  umpGetPendingTasks: (target: string) => ipcRenderer.invoke('ump:get-pending-tasks', target),

  // System Agent Detection
  systemDetectAll: () => ipcRenderer.invoke('system-detect-all'),
  systemDetectDirectories: (dirs: string[]) => ipcRenderer.invoke('system-detect-directories', dirs),
  systemAddToLibrary: (agent: Record<string, unknown>) => ipcRenderer.invoke('system-add-to-library', agent),

  // Notebook
  notebookList: () => ipcRenderer.invoke('notebook:list'),
  notebookGet: (id: string) => ipcRenderer.invoke('notebook:get', id),
  notebookCreate: (name: string, description: string, icon: string, color: string) => ipcRenderer.invoke('notebook:create', name, description, icon, color),
  notebookUpdate: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('notebook:update', id, updates),
  notebookDelete: (id: string) => ipcRenderer.invoke('notebook:delete', id),
  noteList: (notebookId: string) => ipcRenderer.invoke('note:list', notebookId),
  noteGet: (id: string) => ipcRenderer.invoke('note:get', id),
  noteCreate: (notebookId: string, title: string, content: string, tags: string[]) => ipcRenderer.invoke('note:create', notebookId, title, content, tags),
  noteUpdate: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('note:update', id, updates),
  noteDelete: (id: string) => ipcRenderer.invoke('note:delete', id),
  noteSearch: (query: string, notebookId: string, limit: number) => ipcRenderer.invoke('note:search', query, notebookId, limit),
  noteAllTags: () => ipcRenderer.invoke('note:all-tags'),
  noteByTag: (tag: string, limit: number) => ipcRenderer.invoke('note:by-tag', tag, limit),

  // Sources
  sourceImportPDF: (notebookId: string) => ipcRenderer.invoke('source:import-pdf', notebookId),
  sourceImportURL: (url: string, notebookId: string) => ipcRenderer.invoke('source:import-url', url, notebookId),
  sourceImportText: (text: string, notebookId: string) => ipcRenderer.invoke('source:import-text', text, notebookId),
  sourceGet: (notebookId: string) => ipcRenderer.invoke('source:get', notebookId),
  sourceDelete: (sourceId: string) => ipcRenderer.invoke('source:delete', sourceId),

  // Orchestrator
  orchestratorExecute: (prompt: string) => ipcRenderer.invoke('orchestrator:execute', prompt),
  onOrchestratorProgress: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('orchestrator:progress', handler)
    return () => ipcRenderer.removeListener('orchestrator:progress', handler)
  },
  onOrchestratorTaskStart: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('orchestrator:task-start', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-start', handler)
  },
  onOrchestratorTaskComplete: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('orchestrator:task-complete', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-complete', handler)
  },
  onOrchestratorTaskFail: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('orchestrator:task-fail', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-fail', handler)
  },
  onOrchestratorResult: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('orchestrator:result', handler)
    return () => ipcRenderer.removeListener('orchestrator:result', handler)
  },

  // GitHub Installer
  githubAnalyze: (url: string) => ipcRenderer.invoke('github:analyze', url),
  githubInstall: (url: string, onLog: (line: string) => void) => {
    const handler = (_: unknown, line: string) => onLog(line)
    ipcRenderer.on('github:install-log', handler)
    const installPromise = ipcRenderer.invoke('github:install', url)
    installPromise.finally(() => ipcRenderer.removeListener('github:install-log', handler))
    return installPromise
  },

  // Discord
  discordStart: () => ipcRenderer.invoke('discord:start'),
  discordStop: () => ipcRenderer.invoke('discord:stop'),
  discordSend: (text: string) => ipcRenderer.invoke('discord:send', text),
  discordTest: () => ipcRenderer.invoke('discord:test'),
  discordStatus: () => ipcRenderer.invoke('discord:status'),

  // Obsidian Sync
  obsidianExport: () => ipcRenderer.invoke('obsidian:export'),
  obsidianImport: () => ipcRenderer.invoke('obsidian:import'),
  obsidianSync: () => ipcRenderer.invoke('obsidian:sync'),
  obsidianTest: (vaultPath: string) => ipcRenderer.invoke('obsidian:test', vaultPath),
  obsidianWatch: () => ipcRenderer.invoke('obsidian:watch'),
  obsidianWatchStop: () => ipcRenderer.invoke('obsidian:watch-stop'),
})

// Type declarations (for TypeScript tooling)
// These are ignored at runtime when .js is used directly
export {}
