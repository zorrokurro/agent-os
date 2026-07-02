import { app, BrowserWindow, Tray, Menu, nativeTheme, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'

// Deterministic encryption key based on machine ID (stable across restarts)
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(`agentos-${os.hostname()}-${os.userInfo().username}`)
  .digest('hex')
  .slice(0, 32)
import { validate, schemas } from './ipc/validate'
import { detectHardware } from './services/hardware'
import { getAgentManager } from './services/agent-manager'
import { checkOllama, installOllama, pullModel, listModels, chat } from './services/ollama'
import { aiChat, listApiModels } from './services/aiRouter'
import { runFullInstallation, InstallOptions } from './services/installer'
import { stabilityService } from './services/stability'
import { autoUpdateService } from './services/auto-updater'
import { getProviders, getProviderModels, getDefaultModel } from './services/model-providers'
import { AgentDiscovery } from './services/ump/discovery'
import { AgentOSBridge } from './services/ump/bridge'
import { MemoryHub } from './services/ump/hub'
import { MemoryExchange } from './services/ump/exchange'
import { SystemDetector } from './services/system-detector'
import { Orchestrator } from './services/orchestrator/orchestrator'
import { McpClientManager, type McpServerConfig } from './services/mcp/client'
import * as discordService from './services/discord'
import * as obsidianService from './services/obsidian'
import Store from 'electron-store'

declare const __dirname: string

let mainWindow: BrowserWindow | null = null

let tray: Tray | null = null
let isQuitting = false
let umpHubInstance: InstanceType<typeof MemoryHub> | null = null
const mcpManager = new McpClientManager()

const isDev = !app.isPackaged

const store = new Store<{
  installed: boolean
  agents: string[]
  favorites: string[]
  runMode: string
  providerId: string
  modelId: string
  apiKey: string
  autoStart: boolean
  selectedGpuIndex: number
  darkMode: boolean
  theme: 'dark' | 'light' | 'system'
  ollamaUrl: string
  checkInterval: number
  apiProvider: string
  apiModel: string
  autoUpdate: boolean
  language: string
  memoryPath: string
  discordToken: string
  discordChannelId: string
  discordEnabled: boolean
  mcpServers: McpServerConfig[]
}>({
  encryptionKey: process.env.AGENTOS_ENCRYPTION_KEY || ENCRYPTION_KEY,
  name: 'settings',
  defaults: {
    installed: false,
    agents: [],
    favorites: [],
    runMode: 'local',
    providerId: 'ollama',
    modelId: '',
    apiKey: '',
    autoStart: true,
    selectedGpuIndex: -1,
    darkMode: true,
    theme: 'dark',
    ollamaUrl: 'http://localhost:11434',
    checkInterval: 30,
    apiProvider: 'openrouter',
    apiModel: 'openai/gpt-4o-mini',
    autoUpdate: true,
    language: 'zh-TW',
    memoryPath: path.join(os.homedir(), 'AgentOS', 'Memory'),
    discordToken: '',
    discordChannelId: '',
    discordEnabled: false,
    mcpServers: [],
  },
})

async function createWindow() {
  const appPath = app.getAppPath()
  const preloadPath = app.isPackaged
    ? path.join(appPath, 'dist-electron', 'preload.js')
    : path.join(appPath, 'dist-electron', 'preload.js')
  const rendererPath = path.join(appPath, 'dist-renderer', 'index.html')
  const iconPath = path.join(appPath, 'public', 'icon.ico')
  console.log('[Main] preload:', preloadPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#051424',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#051424',
      symbolColor: '#d0bcff',
      height: 40,
    },
    icon: iconPath,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(rendererPath)
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray() {
  try {
    const iconPath = path.join(app.getAppPath(), 'public', 'icon.ico')
    tray = new Tray(iconPath)
    const contextMenu = Menu.buildFromTemplate([
      { label: '開啟 AgentOS', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: '離開', click: () => { isQuitting = true; app.quit() } },
    ])
    tray.setToolTip('AgentOS')
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => mainWindow?.show())
  } catch {
    // icon 不存在時跳過
  }
}

async function registerIPC() {
  ipcMain.handle('get-hardware-info', async () => {
    const hw = await detectHardware()
    // Fallback: 如果 allGpus 為空但 GPU 有被偵測到，手動加入
    if (hw.allGpus.length === 0 && hw.gpu !== 'Unknown GPU') {
      hw.allGpus.push({
        model: hw.gpu,
        vendor: '',
        vramMB: hw.vramGB * 1024,
        isActive: true,
        isDedicated: false,
      })
    }
    return hw
  })

  ipcMain.handle('check-ollama', async () => {
    return await checkOllama(store.get('ollamaUrl'))
  })

  ipcMain.handle('install-ollama', async () => {
    return await installOllama((msg, pct) => {
      mainWindow?.webContents.send('install-progress', { step: 'ollama', percent: pct, message: msg })
    })
  })

  ipcMain.handle('pull-model', async (_, model: string) => {
    const validModel = validate(schemas.safeString, model)
    return await pullModel(validModel, (msg, pct) => {
      mainWindow?.webContents.send('install-progress', { step: 'model-pull', percent: pct, message: msg })
    })
  })

  ipcMain.handle('list-models', async () => {
    const baseUrl = store.get('ollamaUrl') as string | undefined
    return await listModels(baseUrl)
  })

  ipcMain.handle('get-model-config', () => {
    return store.get('modelConfig', {
      panelA:  '',
      panelB:  '',
      judge:   '',
      critic:  '',
      refiner: '',
      hermes:  ''
    })
  })

  ipcMain.handle('set-model-config', (_e, config: Record<string, string>) => {
    const valid = validate(schemas.settingsUpdate, config)
    store.set('modelConfig', valid)
    return true
  })

  ipcMain.handle('chat', async (_, model: string, messages: Array<{ role: string; content: string }>) => {
    const valid = validate(schemas.chatInput, { model, messages })
    return await chat(valid.model, valid.messages, undefined, store.get('ollamaUrl'))
  })

  ipcMain.handle('chat-stream', async (event, model: string, messages: Array<{ role: string; content: string }>) => {
    const sender = event.sender
    try {
      const reply = await chat(model, messages, (token) => {
        sender.send('chat-token', token)
      }, store.get('ollamaUrl'))
      sender.send('chat-done', reply)
      return { success: true, reply }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      sender.send('chat-error', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('ai-chat', async (_e, { model, messages, baseUrl }: { model: string; messages: Array<{ role: string; content: string }>; baseUrl?: string }) => {
    return await aiChat(model, messages, {
      ollamaUrl: baseUrl || store.get('ollamaUrl'),
      apiProvider: store.get('apiProvider'),
      apiKey: store.get('apiKey'),
    })
  })

  ipcMain.handle('list-api-models', async () => {
    return await listApiModels(
      store.get('apiProvider') as string,
      store.get('apiKey') as string
    )
  })

  // === Agent Management (new Docker-based) ===
  const agentMgr = getAgentManager()

  ipcMain.handle('get-agents', async () => {
    return agentMgr.getAllStatuses().map(s => {
      const manifest = agentMgr.getManifest(s.id)
      return {
        id: s.id,
        name: s.name,
        description: manifest?.description || '',
        icon: manifest?.icon || '🤖',
        status: s.status,
        installed: s.status === 'running' || manifest !== undefined,
        port: s.port,
        version: s.version,
        category: manifest?.category || manifest?.tags?.[0] || 'other',
        tags: manifest?.tags || [],
        author: manifest?.author || '',
        price: manifest?.price ?? 'free',
        rating: 4.5,
        runtimeType: manifest?.runtime?.type || 'binary',
      }
    })
  })

  // === Favorites ===
  ipcMain.handle('get-favorites', () => {
    return (store.get('favorites') as string[]) || []
  })

  ipcMain.handle('toggle-favorite', (_, agentId: string) => {
    const validId = validate(schemas.agentId, agentId)
    const favorites = (store.get('favorites') as string[]) || []
    const idx = favorites.indexOf(validId)
    if (idx >= 0) {
      favorites.splice(idx, 1)
    } else {
      favorites.push(validId)
    }
    store.set('favorites', favorites)
    return { success: true, favorites }
  })

  ipcMain.handle('is-favorite', (_, agentId: string) => {
    const validId = validate(schemas.agentId, agentId)
    const favorites = (store.get('favorites') as string[]) || []
    return favorites.includes(validId)
  })

  ipcMain.handle('start-agent', async (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    return agentMgr.startAgent(validId)
  })

  ipcMain.handle('stop-agent', async (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    return { success: await agentMgr.stopAgent(validId) }
  })

  ipcMain.handle('install-agent', async (_, options: { agents: string[] }) => {
    const agentId = options.agents?.[0]
    if (!agentId) return { success: false, error: '未指定 Agent' }
    return agentMgr.startAgent(agentId)
  })

  ipcMain.handle('upgrade-agent', async (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    const ok = await agentMgr.upgradeAgent(validId)
    return { success: ok, error: ok ? '' : '升級失敗' }
  })

  ipcMain.handle('get-agent-status', async (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    const s = agentMgr.getStatus(validId)
    return { status: s?.status || 'stopped' as const }
  })

  ipcMain.handle('get-agent-logs', async (_, id: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { logs: [] }
    try {
      const logFile = path.join(os.homedir(), 'AgentOS', 'agents-data', id, 'agent.log')
      if (!fs.existsSync(logFile)) return { logs: [] }
      const content = await fs.promises.readFile(logFile, 'utf-8')
      const lines = content.split('\n').filter(Boolean)
      return { logs: lines.slice(-500) }
    } catch {
      return { logs: [] }
    }
  })

  ipcMain.handle('get-agent-docs', async (_, id: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { description: '', readme: '' }
    try {
      const agentDir = path.join(os.homedir(), 'AgentOS', 'agents', id)
      const mfPath = path.join(agentDir, 'manifest.json')
      if (!fs.existsSync(mfPath)) return { description: '', readme: '' }
      const manifest = JSON.parse(await fs.promises.readFile(mfPath, 'utf-8'))
      const description = manifest.description || ''
      let readme = ''
      const readmePath = path.join(agentDir, 'README.md')
      if (fs.existsSync(readmePath)) {
        readme = await fs.promises.readFile(readmePath, 'utf-8')
      }
      return { description, readme }
    } catch {
      return { description: '', readme: '' }
    }
  })

  // === GitHub Import ===
  ipcMain.handle('import-agent-from-github', async (_, url: string) => {
    const validUrl = validate(schemas.githubUrl, url)
    try {
      const { installRepo } = await import('./services/installer-github')
      const result = await installRepo(validUrl, (line: string) => {
        console.log(`[GitHub Import] ${line}`)
      }, { requireManifest: true })
      return { success: result.success, message: result.success ? `✅ 成功匯入 agent` : result.error }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.log(`[GitHub Import] 失敗: ${msg}`)
      return { success: false, message: `匯入失敗: ${msg}` }
    }
  })

  // === GitHub Installer ===
  ipcMain.handle('github:analyze', async (_, url: string) => {
    const validUrl = validate(schemas.githubUrl, url)
    const { analyzeRepo } = await import('./services/installer-github')
    try {
      return await analyzeRepo(validUrl)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle('github:install', async (event, url: string) => {
    const validUrl = validate(schemas.githubUrl, url)
    const { installRepo } = await import('./services/installer-github')
    const sender = event.sender
    try {
      return await installRepo(validUrl, (line: string) => {
        sender.send('github:install-log', line)
      })
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle('health-check-agent', async (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    const ok = await agentMgr.healthCheck(validId)
    return { healthy: ok }
  })

  ipcMain.handle('run-installation', async (_, options: InstallOptions) => {
    const result = await runFullInstallation(options, mainWindow)
    if (result.success) {
      store.set('installed', true)
      store.set('agents', options.agents)
      store.set('runMode', options.runMode)
      store.set('providerId', options.providerId)
      store.set('modelId', options.modelId)
    }
    // 不論成功與否，都儲存 selectedGpuIndex 供後續使用
    store.set('selectedGpuIndex', options.selectedGpuIndex)
    return result
  })

  ipcMain.handle('get-settings', () => store.store)
  ipcMain.handle('set-settings', (_, settings: Record<string, unknown>) => {
    const valid = validate(schemas.settingsUpdate, settings)
    const prevDarkMode = store.get('darkMode')
    for (const [key, value] of Object.entries(valid)) {
      store.set(key as keyof typeof store.store, value)
    }
    // Notify renderer if darkMode changed
    if (settings.darkMode !== undefined && settings.darkMode !== prevDarkMode) {
      mainWindow?.webContents.send('theme-changed', settings.darkMode)
    }
    // Update stability service if ollamaUrl changed
    if (typeof settings.ollamaUrl === 'string') {
      stabilityService.setOllamaUrl(settings.ollamaUrl)
    }
    // Update stability service if checkInterval changed
    if (typeof settings.checkInterval === 'number' && settings.checkInterval >= 10) {
      stabilityService.setCheckInterval(settings.checkInterval)
    }
  })

  ipcMain.handle('get-full-settings', () => {
    return {
      ollamaUrl:   store.get('ollamaUrl',   'http://localhost:11434'),
      apiProvider: store.get('apiProvider', 'openrouter'),
      apiKey:      store.get('apiKey',      ''),
      apiModel:    store.get('apiModel',    'openai/gpt-4o-mini'),
    }
  })

  ipcMain.handle('set-full-settings', (_e, s: Record<string, string>) => {
    const valid = validate(schemas.fullSettings, s)
    if (valid.ollamaUrl   !== undefined) store.set('ollamaUrl',   valid.ollamaUrl)
    if (valid.apiProvider !== undefined) store.set('apiProvider', valid.apiProvider)
    if (valid.apiKey      !== undefined) store.set('apiKey',      valid.apiKey)
    if (valid.apiModel    !== undefined) store.set('apiModel',    valid.apiModel)
    return true
  })

  // === Auto Update ===
  ipcMain.handle('check-for-updates', async () => {
    return autoUpdateService.checkForUpdates()
  })

  ipcMain.handle('download-update', async () => {
    return autoUpdateService.downloadUpdate()
  })

  ipcMain.handle('quit-and-install', () => {
    autoUpdateService.quitAndInstall()
  })

  ipcMain.handle('get-providers', async () => {
    return getProviders()
  })

  ipcMain.handle('get-provider-models', async (_, providerId: string) => {
    return getProviderModels(providerId as any)
  })

  ipcMain.handle('get-default-model', async (_, providerId: string) => {
    return getDefaultModel(providerId as any)
  })

  // === OpenRouter Chat ===
  ipcMain.handle('openrouter-chat', async (_, apiKey: string, model: string, messages: Array<{ role: string; content: string }>) => {
    const valid = validate(schemas.openrouterChatInput, { apiKey, model, messages })
    const { net } = await import('electron')
    const resolvedModel = valid.model || 'openai/gpt-4o-mini'
    const body = JSON.stringify({ model: resolvedModel, messages: valid.messages, max_tokens: 1024, temperature: 0.7 })
    return new Promise<string>((resolve, reject) => {
      const request = net.request({
        method: 'POST',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://agentos.local',
          'X-Title': 'AgentOS',
        },
      })
      let responseData = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(responseData)
            if (parsed.error) {
              reject(new Error(parsed.error.message || 'OpenRouter API error'))
            } else if (parsed.choices && parsed.choices.length > 0) {
              resolve(parsed.choices[0].message.content)
            } else {
              reject(new Error('No response from OpenRouter API'))
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${responseData.substring(0, 200)}`))
          }
        })
      })
      request.on('error', (err) => { reject(new Error(`Network error: ${err.message}`)) })
      request.write(body)
      request.end()
    })
  })

  // === Test Hermes Connection ===
  ipcMain.handle('test-hermes-connection', async (_, hermesUrl: string) => {
    const { HermesController } = await import('./services/orchestrator/controllers/hermes-controller')
    return HermesController.testConnection(hermesUrl)
  })

  // === Council Deliberation ===
  ipcMain.handle('council-get-councillor-responses', async (_, apiKey: string, model: string, question: string, mode: string) => {
    const valid = validate(schemas.councilInput, { apiKey, model, question, mode })
    const { getCouncillorResponses } = await import('./services/council-service')
    return getCouncillorResponses(valid.apiKey, valid.model, valid.question, valid.mode)
  })

  ipcMain.handle('council-get-peer-rankings', async (_, apiKey: string, model: string, question: string, councillorResponses: Array<{ id: string; name: string; response: string }>) => {
    const { getPeerRankings } = await import('./services/council-service')
    return getPeerRankings(apiKey, model, question, councillorResponses)
  })

  ipcMain.handle('council-get-chairman-synthesis', async (_, apiKey: string, model: string, question: string, councillorResponses: Array<{ id: string; name: string; response: string }>, rankings: Record<string, number>) => {
    const { getChairmanSynthesis } = await import('./services/council-service')
    return getChairmanSynthesis(apiKey, model, question, councillorResponses, rankings)
  })

  ipcMain.handle('get-memory-items', async () => {
    const { getMemoryItems } = await import('./services/memory')
    const fileResult = getMemoryItems()

    const conversations = umpHub.getConversationsForMemory()
    const convItems = conversations.map(({ session, messages }) => ({
      path: `ump-session:${session.id}`,
      name: `${session.agent_name} — ${session.created_at.split('T')[0]}`,
      type: 'conversations' as const,
      modified: session.updated_at.split('T')[0],
      content: messages.map(m => `**${m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Agent' : 'System'}**: ${m.content}`).join('\n\n'),
    }))

    return {
      items: [...convItems, ...fileResult.items],
      stats: {
        ...fileResult.stats,
        totalFiles: fileResult.stats.totalFiles + convItems.length,
      },
    }
  })

  ipcMain.handle('get-memory-item-content', async (_, filePath: string) => {
    const validPath = validate(schemas.filePath, filePath)
    if (validPath.startsWith('ump-session:')) {
      const sessionId = validPath.slice('ump-session:'.length)
      const messages = umpHub.getSessionMessages(sessionId)
      const content = messages.map(m =>
        `**${m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Agent' : 'System'}**: ${m.content}`
      ).join('\n\n')
      return { success: true, content }
    }
    const { getMemoryItemContent } = await import('./services/memory')
    return getMemoryItemContent(filePath)
  })

  ipcMain.handle('save-memory-item', async (_, filePath: string, content: string) => {
    const validPath = validate(schemas.filePath, filePath)
    const validContent = validate(schemas.memoryContent, content)
    const { saveMemoryItem } = await import('./services/memory')
    return saveMemoryItem(validPath, validContent)
  })

  ipcMain.handle('save-conversation', async (_, agentName: string, messages: Array<{ role: string; content: string }>) => {
    try {
      const session = umpHub.createSession(agentName, agentName)
      for (const msg of messages) {
        umpHub.addMessage(session.id, msg.role as 'user' | 'assistant', msg.content)
      }
      return { success: true, session_id: session.id }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('ump-conversations', (_, agentName?: string, limit?: number) => {
    try {
      return umpHub.getConversationsForMemory(agentName, limit)
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-session-messages', (_, sessionId: string) => {
    try {
      return umpHub.getSessionMessages(sessionId)
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-session-stats', () => {
    try {
      return umpHub.getSessionStats()
    } catch (e) { return { error: String(e) } }
  })

  // === Task Queue ===
  ipcMain.handle('ump:create-task', (_, title: string, content: string, target: string, source?: string) => {
    const valid = validate(schemas.umpTask, { title, content, target, source })
    try {
      return umpHub.createTask(valid.title, valid.content, valid.target, valid.source)
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump:get-tasks', (_, target?: string, status?: string) => {
    try {
      return umpHub.getTasks(target, status)
    } catch (e) { return [] }
  })

  ipcMain.handle('ump:update-task', (_, id: string, status: string, result?: string) => {
    const validId = validate(schemas.agentId, id)
    const validStatus = validate(schemas.safeString, status)
    try {
      const ok = umpHub.updateTaskStatus(validId, validStatus, result)
      if (ok && status === 'completed' && discordService.isRunning()) {
        const tasks = umpHub.getTasks()
        const task = tasks.find(t => t.id === id)
        if (task) discordService.notifyTaskComplete(task)
      }
      return ok
    } catch (e) { return false }
  })

  ipcMain.handle('ump:get-pending-tasks', (_, target: string) => {
    try {
      return umpHub.getPendingTasks(target)
    } catch (e) { return [] }
  })

  ipcMain.handle('run-research', async (_, options) => {
    const { conductResearch } = await import('./services/research-engine')
    const { generateReport } = await import('./services/report-generator')
    const research = await conductResearch(options)
    const report = generateReport(research, 'markdown')
    return { research, report }
  })

  // === Agent Catalog Registry ===
  ipcMain.handle('get-agent-catalog', async () => {
    try {
      // packaged 時 registry 在 resources 目錄，開發時在 repo root
      const regPath = isDev
        ? path.join(__dirname, '..', 'agents-registry.json')
        : path.join(process.resourcesPath, 'agents-registry.json')
      if (!fs.existsSync(regPath)) return { agents: [] }
      const raw = await fs.promises.readFile(regPath, 'utf-8')
      return JSON.parse(raw)
    } catch (e) {
      console.error('[Catalog] 讀取失敗:', e)
      return { agents: [] }
    }
  })

  // === UMP (Universal Memory Protocol) ===
  const agentosRoot = path.join(os.homedir(), 'AgentOS')
  const umpHub = new MemoryHub()
  await umpHub.initialize()
  umpHubInstance = umpHub
  const { setHub: setNotebookHub } = await import('./services/notebook')
  setNotebookHub(umpHub)
  const umpExchange = new MemoryExchange()
  const umpBridge = new AgentOSBridge(agentosRoot, umpHub, umpExchange)
  const umpDiscovery = new AgentDiscovery(agentosRoot)

  ipcMain.handle('ump-discover-scan', () => {
    try { return umpDiscovery.scan() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-discover-unregistered', () => {
    try { return umpDiscovery.getUnregistered() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-discover-with-memory', () => {
    try { return umpDiscovery.getWithMemory() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-discover-register-all', () => {
    try { return { registered: umpDiscovery.registerAllUnregistered() } }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-discover-consolidate', (_, agentId: string) => {
    try {
      return umpDiscovery.consolidateMemories(agentId, umpHub)
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-bridge-connect', async () => {
    try { return { success: await umpBridge.connect(), status: umpBridge.status() } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('ump-bridge-import', async () => {
    try {
      const count = await umpBridge.importAllMemories()
      return { success: true, count, hub_stats: umpHub.getStatistics() }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('ump-bridge-export', async () => {
    try {
      const files = await umpBridge.exportAllMemories()
      return { success: true, files }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('ump-bridge-sync', async () => {
    try { return { success: true, result: await umpBridge.fullSync() } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle('ump-bridge-status', () => {
    try { return umpBridge.status() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-hub-search', (_, query: string, opts?: { memoryType?: string; groupId?: string; limit?: number }) => {
    try {
      const results = umpHub.searchByContent(query, {
        memoryType: opts?.memoryType as 'semantic' | 'episodic' | 'procedural' | 'graph' | undefined,
        groupId: opts?.groupId,
        limit: opts?.limit,
      })
      return results
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-hub-stats', () => {
    try { return umpHub.getStatistics() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-hub-all', () => {
    try { return umpHub.getAll() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-exchange-register', async (_, agentId: string, name: string, description: string) => {
    try { return await umpExchange.registerAgent(agentId, name, description) }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-exchange-stats', () => {
    try { return umpExchange.getStatistics() }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump-add-memory', async (_, params: { content: string; memoryType?: string; tags?: string[]; group_id?: string }) => {
    const valid = validate(schemas.umpMemory, params)
    try {
      const { createMemory } = await import('./services/ump/schemas')
      const mem = createMemory({
        id: crypto.randomUUID(),
        content: valid.content,
        memory_type: (valid.memoryType as 'semantic' | 'episodic' | 'procedural' | 'graph') || 'episodic',
        tags: valid.tags || [],
        group_id: valid.group_id,
      })
      return umpHub.addMemory(mem)
    } catch (e) { return false }
  })

  // Notebook
  const notebookService = await import('./services/notebook')

  ipcMain.handle('notebook:list', () => {
    try { return notebookService.listNotebooks() }
    catch (e) { return [] }
  })

  ipcMain.handle('notebook:get', (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    try { return notebookService.getNotebook(validId) }
    catch (e) { return null }
  })

  ipcMain.handle('notebook:create', (_, name: string, description?: string, icon?: string, color?: string) => {
    const validName = validate(schemas.notebookName, name)
    const result = notebookService.createNotebook(validName, description, icon, color)
    return result
  })

  ipcMain.handle('notebook:update', (_, id: string, updates: Record<string, unknown>) => {
    const validId = validate(schemas.agentId, id)
    return notebookService.updateNotebook(validId, updates as any)
  })

  ipcMain.handle('notebook:delete', (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    try { return notebookService.deleteNotebook(validId) }
    catch (e) { return false }
  })

  ipcMain.handle('note:list', (_, notebookId: string) => {
    const validId = validate(schemas.agentId, notebookId)
    try { return notebookService.listNotes(validId) }
    catch (e) { return [] }
  })

  ipcMain.handle('note:get', (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    try { return notebookService.getNote(validId) }
    catch (e) { return null }
  })

  ipcMain.handle('note:create', (_, notebookId: string, title: string, content?: string, tags?: string[]) => {
    const validNotebookId = validate(schemas.agentId, notebookId)
    const validTitle = validate(schemas.noteTitle, title)
    try { return notebookService.createNote(validNotebookId, validTitle, content, tags) }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('note:update', (_, id: string, updates: Record<string, unknown>) => {
    const validId = validate(schemas.agentId, id)
    try { return notebookService.updateNote(validId, updates as any) }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('note:delete', (_, id: string) => {
    const validId = validate(schemas.agentId, id)
    try { return notebookService.deleteNote(validId) }
    catch (e) { return false }
  })

  ipcMain.handle('note:search', (_, query: string, notebookId?: string, limit?: number) => {
    const validQuery = validate(schemas.safeString, query)
    try { return notebookService.searchNotes(validQuery, notebookId, limit) }
    catch (e) { return [] }
  })

  ipcMain.handle('note:all-tags', () => {
    try { return notebookService.getAllTags() }
    catch (e) { return [] }
  })

  ipcMain.handle('note:by-tag', (_, tag: string, limit?: number) => {
    const validTag = validate(schemas.safeString, tag)
    try { return notebookService.getNotesByTag(validTag, limit) }
    catch (e) { return [] }
  })

  // === Source Management ===
  const { setHub: setSourceHub } = await import('./services/source')
  const sourceService = await import('./services/source')
  setSourceHub(umpHub)

  ipcMain.handle('source:import-pdf', async (_, notebookId: string) => {
    const validId = validate(schemas.agentId, notebookId)
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: '選擇 PDF 檔案',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    try {
      const source = await sourceService.importPDF(result.filePaths[0], validId)
      return source
    } catch (e) {
      console.error('[Source] PDF import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:import-url', async (_, url: string, notebookId: string) => {
    const validUrl = validate(schemas.safeUrl, url)
    const validId = validate(schemas.agentId, notebookId)
    try {
      return await sourceService.importURL(validUrl, validId)
    } catch (e) {
      console.error('[Source] URL import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:import-text', (_, text: string, notebookId: string) => {
    const validText = validate(schemas.safeString, text)
    const validId = validate(schemas.agentId, notebookId)
    try {
      return sourceService.importText(validText, validId)
    } catch (e) {
      console.error('[Source] Text import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:get', (_, notebookId: string) => {
    const validId = validate(schemas.agentId, notebookId)
    try { return sourceService.getSources(validId) }
    catch (e) { return [] }
  })

  ipcMain.handle('source:delete', (_, sourceId: string) => {
    const validId = validate(schemas.agentId, sourceId)
    try { return sourceService.deleteSource(validId) }
    catch (e) { return false }
  })

  // === Obsidian Sync ===
  ipcMain.handle('obsidian:export', () => {
    try { return obsidianService.exportToObsidian() }
    catch (e) { return { exported: 0, errors: [String(e)] } }
  })

  ipcMain.handle('obsidian:import', () => {
    try { return obsidianService.importFromObsidian() }
    catch (e) { return { imported: 0, updated: 0, skipped: 0, errors: [String(e)] } }
  })

  ipcMain.handle('obsidian:sync', () => {
    try {
      const importResult = obsidianService.importFromObsidian()
      const exportResult = obsidianService.exportToObsidian()
      return { imported: importResult.imported, updated: importResult.updated, skipped: importResult.skipped, exported: exportResult.exported, errors: [...importResult.errors, ...exportResult.errors] }
    } catch (e) { return { imported: 0, updated: 0, skipped: 0, exported: 0, errors: [String(e)] } }
  })

  ipcMain.handle('obsidian:test', (_, vaultPath: string) => {
    return obsidianService.testVaultPath(vaultPath)
  })

  ipcMain.handle('obsidian:watch', () => {
    try { return obsidianService.startWatching() }
    catch (e) { return { success: false, message: String(e) } }
  })

  ipcMain.handle('obsidian:watch-stop', () => {
    obsidianService.stopWatching()
    return { success: true }
  })

  // System Agent Detection
  const systemDetector = new SystemDetector(app.getPath('home'))

  ipcMain.handle('system-detect-all', async () => {
    try { return await systemDetector.detectAll() }
    catch (e) { return [] }
  })

  ipcMain.handle('system-detect-directories', (_, dirs: string[]) => {
    try { return systemDetector.scanDirectories(dirs) }
    catch (e) { return [] }
  })

  ipcMain.handle('system-add-to-library', (_, agent: { id: string; name: string; description: string; version?: string; icon?: string; configDirs?: string[]; dataDirs?: string[]; healthCheck?: { type: string; url?: string; timeout?: number }; ports?: number[]; processNames?: string[]; configPath?: string }) => {
    try {
      const agentsDir = path.join(app.getPath('home'), 'AgentOS', 'agents')
      const agentId = agent.id.replace('standalone:', '')
      const agentDir = path.join(agentsDir, agentId)

      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true })
      }

      const manifest = {
        id: agentId,
        name: agent.name,
        version: agent.version || '1.0.0',
        description: agent.description,
        author: 'System Detection',
        category: '獨立 Agent',
        icon: agent.icon || '🤖',
        tags: ['獨立安裝', '系統偵測'],
        price: 'free',
        runtime: {
          type: 'external',
          entry: '',
          port: 0,
        },
        healthCheck: agent.healthCheck || { type: 'none' },
        ports: agent.ports || [],
        processNames: agent.processNames || [],
        configPath: agent.configPath,
        api: {
          version: '1.x',
          basePath: '/api/v1',
        },
        dependencies: {},
        _detected_configDirs: agent.configDirs || [],
        _detected_dataDirs: agent.dataDirs || [],
        _detected_at: new Date().toISOString(),
      }

      fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

      // Reload agents
      agentMgr.loadAgents()

      return { success: true, agentId }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // MCP Client Manager
  const savedMcpServers = (store.get('mcpServers') as McpServerConfig[]) || []
  for (const server of savedMcpServers) {
    if (server.enabled) {
      await mcpManager.connectServer(server).catch(e =>
        console.error(`[MCP] 連線失敗 ${server.id}:`, e)
      )
    }
  }

  // Orchestrator
  const orchestrator = new Orchestrator(mcpManager)

  orchestrator.on('progress', (data) => {
    mainWindow?.webContents.send('orchestrator:progress', data)
  })

  orchestrator.on('task-start', (data) => {
    mainWindow?.webContents.send('orchestrator:task-start', data)
  })

  orchestrator.on('task-complete', (data) => {
    mainWindow?.webContents.send('orchestrator:task-complete', data)
  })

  orchestrator.on('task-fail', (data) => {
    mainWindow?.webContents.send('orchestrator:task-fail', data)
  })

  orchestrator.on('result', (data) => {
    mainWindow?.webContents.send('orchestrator:result', data)
  })

  ipcMain.handle('orchestrator:execute', async (_, prompt: string) => {
    const validPrompt = validate(schemas.safeString, prompt)
    try {
      return await orchestrator.execute(validPrompt)
    } catch (e) {
      return `錯誤：${String(e)}`
    }
  })

  // === MCP (Model Context Protocol) ===
  ipcMain.handle('mcp:list-servers', () => {
    return (store.get('mcpServers') as McpServerConfig[]) || []
  })

  ipcMain.handle('mcp:add-server', async (_, config: McpServerConfig) => {
    const valid = validate(schemas.mcpServerConfig, config)
    const servers = (store.get('mcpServers') as McpServerConfig[]) || []
    servers.push(valid)
    store.set('mcpServers', servers)
    if (valid.enabled) {
      return mcpManager.connectServer(valid).then(() => ({ success: true }))
        .catch(e => ({ success: false, error: String(e) }))
    }
    return { success: true }
  })

  ipcMain.handle('mcp:remove-server', async (_, serverId: string) => {
    const validId = validate(schemas.agentId, serverId)
    const servers = (store.get('mcpServers') as McpServerConfig[]) || []
    store.set('mcpServers', servers.filter(s => s.id !== validId))
    return mcpManager.disconnectServer(validId).then(() => ({ success: true }))
  })

  ipcMain.handle('mcp:toggle-server', async (_, serverId: string, enabled: boolean) => {
    const validId = validate(schemas.agentId, serverId)
    const servers = (store.get('mcpServers') as McpServerConfig[]) || []
    const server = servers.find(s => s.id === validId)
    if (server) {
      server.enabled = enabled
      store.set('mcpServers', servers)
      if (enabled) {
        await mcpManager.connectServer(server)
      } else {
        await mcpManager.disconnectServer(validId)
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
    const valid = validate(schemas.mcpToolCall, { serverId, toolName, args })
    try {
      const result = await mcpManager.callTool(valid.serverId, valid.toolName, valid.args)
      return { success: true, result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('mcp:server-status', () => {
    return mcpManager.getStatus()
  })

  // === Discord Integration ===
  ipcMain.handle('discord:start', async () => {
    const config = {
      token: store.get('discordToken'),
      channelId: store.get('discordChannelId'),
      enabled: store.get('discordEnabled'),
    }
    if (!config.token || !config.channelId) {
      return { success: false, message: '缺少 Token 或頻道 ID' }
    }
    return discordService.startBot(config, umpHub)
  })

  ipcMain.handle('discord:stop', async () => {
    return discordService.stopBot()
  })

  ipcMain.handle('discord:send', async (_, text: string) => {
    const validText = validate(schemas.discordMessage, text)
    return discordService.sendMessage(validText)
  })

  ipcMain.handle('discord:test', async () => {
    try {
      return await discordService.testConnection()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Discord] discord:test handler exception:', msg)
      return { success: false, message: `❌ Handler 錯誤：${msg}` }
    }
  })

  ipcMain.handle('discord:status', () => {
    return { running: discordService.isRunning() }
  })
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = store.get('darkMode') ? 'dark' : 'light'
  await registerIPC()
  createWindow()
  createTray()
  stabilityService.init(mainWindow!, {
    ollamaUrl: store.get('ollamaUrl'),
    checkInterval: store.get('checkInterval'),
  })
  autoUpdateService.init(mainWindow!)
  if (store.get('autoStart')) stabilityService.setAutoStart(true)
  if (store.get('autoUpdate')) {
    // Delay auto-check slightly so the window has time to render
    setTimeout(() => autoUpdateService.checkForUpdates(), 5000)
  }
  // Auto-start Discord bot if configured
  if (store.get('discordEnabled') && store.get('discordToken') && store.get('discordChannelId')) {
    setTimeout(async () => {
      try {
        const config = {
          token: store.get('discordToken'),
          channelId: store.get('discordChannelId'),
          enabled: store.get('discordEnabled'),
        }
        const result = await discordService.startBot(config, umpHubInstance!)
        if (!result.success) console.error('[Discord] Auto-start:', result.message)
      } catch (e) {
        console.error('[Discord] Auto-start failed:', e)
      }
    }, 2000)
  }
})

app.on('window-all-closed', () => {
  // 常駐系統列
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', (e) => {
  if (isQuitting) return
  isQuitting = true
  e.preventDefault()
  mcpManager.shutdown().catch(() => {})
  if (umpHubInstance) umpHubInstance.close()
  const mgr = getAgentManager()
  const stability = stabilityService
  discordService.stopBot().catch(() => {})
  mgr.destroy().then(() => {
    stability.destroy()
    app.quit()
  })
})
