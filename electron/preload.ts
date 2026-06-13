const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Hardware
  getHardwareInfo: () => ipcRenderer.invoke('get-hardware-info'),

  // Providers
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getProviderModels: (providerId) => ipcRenderer.invoke('get-provider-models', providerId),
  getDefaultModel: (providerId) => ipcRenderer.invoke('get-default-model', providerId),

  // Council
  councilGetCouncillorResponses: (apiKey, model, question, mode) => ipcRenderer.invoke('council-get-councillor-responses', apiKey, model, question, mode),
  councilGetPeerRankings: (apiKey, model, question, councillorResponses) => ipcRenderer.invoke('council-get-peer-rankings', apiKey, model, question, councillorResponses),
  councilGetChairmanSynthesis: (apiKey, model, question, councillorResponses, rankings) => ipcRenderer.invoke('council-get-chairman-synthesis', apiKey, model, question, councillorResponses, rankings),

  // OpenRouter
  openrouterChat: (apiKey, model, messages) => ipcRenderer.invoke('openrouter-chat', apiKey, model, messages),

  // Hermes
  testHermesConnection: (hermesUrl) => ipcRenderer.invoke('test-hermes-connection', hermesUrl),

  // Ollama
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  pullModel: (model) => ipcRenderer.invoke('pull-model', model),
  listModels: () => ipcRenderer.invoke('list-models'),
  chat: (model, messages) => ipcRenderer.invoke('chat', model, messages),
  chatStream: (model, messages) => ipcRenderer.invoke('chat-stream', model, messages),

  // Agent management
  getAgents: () => ipcRenderer.invoke('get-agents'),
  startAgent: (id) => ipcRenderer.invoke('start-agent', id),
  stopAgent: (id) => ipcRenderer.invoke('stop-agent', id),
  getAgentStatus: (id) => ipcRenderer.invoke('get-agent-status', id),
  importAgentFromGitHub: (url) => ipcRenderer.invoke('import-agent-from-github', url),
  installAgent: (options) => ipcRenderer.invoke('install-agent', options),
  upgradeAgent: (id) => ipcRenderer.invoke('upgrade-agent', id),
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  toggleFavorite: (agentId) => ipcRenderer.invoke('toggle-favorite', agentId),
  isFavorite: (agentId) => ipcRenderer.invoke('is-favorite', agentId),
  healthCheckAgent: (id) => ipcRenderer.invoke('health-check-agent', id),
  getAgentLogs: (id) => ipcRenderer.invoke('get-agent-logs', id),
  getAgentDocs: (id) => ipcRenderer.invoke('get-agent-docs', id),

  // Installation
  runInstallation: (options) => ipcRenderer.invoke('run-installation', options),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),

  // Memory
  getMemoryItems: () => ipcRenderer.invoke('get-memory-items'),
  getMemoryItemContent: (filePath) => ipcRenderer.invoke('get-memory-item-content', filePath),
  saveMemoryItem: (filePath, content) => ipcRenderer.invoke('save-memory-item', filePath, content),
  saveConversation: (agentName, messages) => ipcRenderer.invoke('save-conversation', agentName, messages),

  // Research
  runResearch: (options) => ipcRenderer.invoke('run-research', options),

  // Event listeners
  onInstallProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('install-progress', handler)
    return () => ipcRenderer.removeListener('install-progress', handler)
  },
  onChatToken: (callback) => {
    const handler = (_, token) => callback(token)
    ipcRenderer.on('chat-token', handler)
    return () => ipcRenderer.removeListener('chat-token', handler)
  },
  onChatDone: (callback) => {
    const handler = (_, reply) => callback(reply)
    ipcRenderer.on('chat-done', handler)
    return () => ipcRenderer.removeListener('chat-done', handler)
  },
  onChatError: (callback) => {
    const handler = (_, error) => callback(error)
    ipcRenderer.on('chat-error', handler)
    return () => ipcRenderer.removeListener('chat-error', handler)
  },
  onHealthCheckResult: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('health-check-result', handler)
    return () => ipcRenderer.removeListener('health-check-result', handler)
  },
  onThemeChanged: (callback) => {
    const handler = (_, darkMode) => callback(darkMode)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  onUpdateStatus: (callback) => {
    const handler = (_, data) => callback(data)
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
  umpDiscoverConsolidate: (agentId) => ipcRenderer.invoke('ump-discover-consolidate', agentId),
  umpBridgeConnect: () => ipcRenderer.invoke('ump-bridge-connect'),
  umpBridgeImport: () => ipcRenderer.invoke('ump-bridge-import'),
  umpBridgeExport: () => ipcRenderer.invoke('ump-bridge-export'),
  umpBridgeSync: () => ipcRenderer.invoke('ump-bridge-sync'),
  umpBridgeStatus: () => ipcRenderer.invoke('ump-bridge-status'),
  umpHubSearch: (query, opts) => ipcRenderer.invoke('ump-hub-search', query, opts),
  umpHubStats: () => ipcRenderer.invoke('ump-hub-stats'),
  umpHubAll: () => ipcRenderer.invoke('ump-hub-all'),
  umpExchangeRegister: (agentId, name, description) => ipcRenderer.invoke('ump-exchange-register', agentId, name, description),
  umpExchangeStats: () => ipcRenderer.invoke('ump-exchange-stats'),

  // UMP Conversations
  umpConversations: (agentName, limit) => ipcRenderer.invoke('ump-conversations', agentName, limit),
  umpSessionMessages: (sessionId) => ipcRenderer.invoke('ump-session-messages', sessionId),
  umpSessionStats: () => ipcRenderer.invoke('ump-session-stats'),

  // Task Queue
  umpCreateTask: (title, content, target, source) => ipcRenderer.invoke('ump:create-task', title, content, target, source),
  umpGetTasks: (target, status) => ipcRenderer.invoke('ump:get-tasks', target, status),
  umpUpdateTask: (id, status, result) => ipcRenderer.invoke('ump:update-task', id, status, result),
  umpGetPendingTasks: (target) => ipcRenderer.invoke('ump:get-pending-tasks', target),

  // System Agent Detection
  systemDetectAll: () => ipcRenderer.invoke('system-detect-all'),
  systemDetectDirectories: (dirs) => ipcRenderer.invoke('system-detect-directories', dirs),
  systemAddToLibrary: (agent) => ipcRenderer.invoke('system-add-to-library', agent),

  // Notebook
  notebookList: () => ipcRenderer.invoke('notebook:list'),
  notebookGet: (id) => ipcRenderer.invoke('notebook:get', id),
  notebookCreate: (name, description, icon, color) => ipcRenderer.invoke('notebook:create', name, description, icon, color),
  notebookUpdate: (id, updates) => ipcRenderer.invoke('notebook:update', id, updates),
  notebookDelete: (id) => ipcRenderer.invoke('notebook:delete', id),
  noteList: (notebookId) => ipcRenderer.invoke('note:list', notebookId),
  noteGet: (id) => ipcRenderer.invoke('note:get', id),
  noteCreate: (notebookId, title, content, tags) => ipcRenderer.invoke('note:create', notebookId, title, content, tags),
  noteUpdate: (id, updates) => ipcRenderer.invoke('note:update', id, updates),
  noteDelete: (id) => ipcRenderer.invoke('note:delete', id),
  noteSearch: (query, notebookId, limit) => ipcRenderer.invoke('note:search', query, notebookId, limit),
  noteAllTags: () => ipcRenderer.invoke('note:all-tags'),
  noteByTag: (tag, limit) => ipcRenderer.invoke('note:by-tag', tag, limit),

  // Orchestrator
  orchestratorExecute: (prompt) => ipcRenderer.invoke('orchestrator:execute', prompt),
  onOrchestratorProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('orchestrator:progress', handler)
    return () => ipcRenderer.removeListener('orchestrator:progress', handler)
  },
  onOrchestratorTaskStart: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('orchestrator:task-start', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-start', handler)
  },
  onOrchestratorTaskComplete: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('orchestrator:task-complete', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-complete', handler)
  },
  onOrchestratorTaskFail: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('orchestrator:task-fail', handler)
    return () => ipcRenderer.removeListener('orchestrator:task-fail', handler)
  },
  onOrchestratorResult: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('orchestrator:result', handler)
    return () => ipcRenderer.removeListener('orchestrator:result', handler)
  },
})

// Type declarations (for TypeScript tooling)
// These are ignored at runtime when .js is used directly
export {}
