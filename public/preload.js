const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Hardware
  getHardwareInfo: () => ipcRenderer.invoke('get-hardware-info'),

  // Providers
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getProviderModels: (providerId) => ipcRenderer.invoke('get-provider-models', providerId),
  getDefaultModel: (providerId) => ipcRenderer.invoke('get-default-model', providerId),

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

  // Agent Catalog Registry
  getAgentCatalog: () => ipcRenderer.invoke('get-agent-catalog'),
})
