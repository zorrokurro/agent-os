import { app, BrowserWindow, Tray, Menu, nativeTheme, ipcMain } from 'electron'
import path from 'path'
import { execSync, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import { detectHardware } from './services/hardware'
import { getAgentManager } from './services/agent-manager'
import { checkOllama, installOllama, pullModel, listModels, startOllamaServe, chat } from './services/ollama'
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
import * as discordService from './services/discord'
import * as obsidianService from './services/obsidian'
import Store from 'electron-store'

declare const __filename: string
declare const __dirname: string

let mainWindow: BrowserWindow | null = null

let tray: Tray | null = null
let isQuitting = false
let umpHubInstance: InstanceType<typeof MemoryHub> | null = null

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
}>({
  encryptionKey: 'agentOS-2026-secure-key',
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
    memoryPath: 'C:\\AgentOS\\Memory',
    discordToken: '',
    discordChannelId: '',
    discordEnabled: false,
  },
})

async function createWindow() {
  // Resolve preload path — works in both dev and packaged (asar) modes
  // Electron requires preload to be a real file (not inside asar)
  const appPath = app.getAppPath()
  let preloadPath: string
  if (app.isPackaged) {
    // In packaged mode, main.js is at resources/app.asar/dist-electron/main.js
    // preload.js (unpacked) is at resources/app.asar.unpacked/dist-electron/preload.js
    preloadPath = path.join(appPath, '..', 'app.asar.unpacked', 'dist-electron', 'preload.js')
    // Fallback if asarUnpacked doesn't exist (non-asar build)
    if (!fs.existsSync(preloadPath)) {
      preloadPath = path.join(appPath, 'dist-electron', 'preload.js')
    }
    // Fallback: some electron-builder configs put main.js at resources/app/dist-electron/
    if (!fs.existsSync(preloadPath)) {
      preloadPath = path.join(appPath, 'preload.js')
    }
  } else {
    // In dev mode, preload.js is at dist-electron/preload.js next to main.js
    preloadPath = path.join(appPath, 'dist-electron', 'preload.js')
  }
  const rendererPath = path.join(appPath, 'dist-renderer', 'index.html')
  const iconPath = path.join(appPath, 'public', 'icon.ico')
  console.log('[Main] preload:', preloadPath)
  console.log('[Main] renderer:', rendererPath)

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
    console.log('[Hardware] allGpus:', JSON.stringify(hw.allGpus))
    console.log('[Hardware] gpu:', hw.gpu, 'vramGB:', hw.vramGB)
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
    return await pullModel(model, (msg, pct) => {
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
    store.set('modelConfig', config)
    return true
  })

  ipcMain.handle('chat', async (_, model: string, messages: Array<{ role: string; content: string }>) => {
    return await chat(model, messages, undefined, store.get('ollamaUrl'))
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
    const favorites = (store.get('favorites') as string[]) || []
    const idx = favorites.indexOf(agentId)
    if (idx >= 0) {
      favorites.splice(idx, 1)
    } else {
      favorites.push(agentId)
    }
    store.set('favorites', favorites)
    return { success: true, favorites }
  })

  ipcMain.handle('is-favorite', (_, agentId: string) => {
    const favorites = (store.get('favorites') as string[]) || []
    return favorites.includes(agentId)
  })

  ipcMain.handle('start-agent', async (_, id: string) => {
    return agentMgr.startAgent(id)
  })

  ipcMain.handle('stop-agent', async (_, id: string) => {
    return { success: await agentMgr.stopAgent(id) }
  })

  ipcMain.handle('install-agent', async (_, options: { agents: string[] }) => {
    const agentId = options.agents?.[0]
    if (!agentId) return { success: false, error: '未指定 Agent' }
    return agentMgr.startAgent(agentId)
  })

  ipcMain.handle('upgrade-agent', async (_, id: string) => {
    const ok = await agentMgr.upgradeAgent(id)
    return { success: ok, error: ok ? '' : '升級失敗' }
  })

  ipcMain.handle('get-agent-status', async (_, id: string) => {
    const s = agentMgr.getStatus(id)
    return { status: s?.status || 'stopped' as const }
  })

  ipcMain.handle('get-agent-logs', async (_, id: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { logs: [] }
    try {
      const logFile = path.join(os.homedir(), 'AgentOS', 'agents-data', id, 'agent.log')
      if (!fs.existsSync(logFile)) return { logs: [] }
      const content = fs.readFileSync(logFile, 'utf-8')
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
      const manifest = JSON.parse(fs.readFileSync(mfPath, 'utf-8'))
      const description = manifest.description || ''
      let readme = ''
      const readmePath = path.join(agentDir, 'README.md')
      if (fs.existsSync(readmePath)) {
        readme = fs.readFileSync(readmePath, 'utf-8')
      }
      return { description, readme }
    } catch {
      return { description: '', readme: '' }
    }
  })

  // === GitHub Import ===
  ipcMain.handle('import-agent-from-github', async (_, url: string) => {
    try {
      // 解析 GitHub URL
      // 支援格式：https://github.com/user/repo 或 https://github.com/user/repo/tree/branch/path
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/)
      if (!match) {
        return { success: false, message: '無效的 GitHub URL' }
      }
      const [, owner, repo, subPath] = match

      // 使用 git clone 到暫存目錄
      const tmpDir = path.join(os.tmpdir(), 'agentos-import-' + Date.now())
      const cloneUrl = `https://github.com/${owner}/${repo}.git`

      console.log(`[GitHub Import] 正在 clone: ${cloneUrl}`)
      // 用 spawn 代替 execSync 避免阻塞主行程
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('git', ['clone', '--depth', '1', cloneUrl, tmpDir], { stdio: 'pipe', timeout: 60000 })
        proc.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`git clone 退出碼: ${code}`))
        })
        proc.on('error', reject)
      })

      // 尋找 manifest.json
      const searchDir = subPath ? path.join(tmpDir, subPath) : tmpDir
      const manifestPath = path.join(searchDir, 'manifest.json')

      if (!fs.existsSync(manifestPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        return { success: false, message: '找不到 manifest.json，請確認 repo 根目錄有 manifest.json' }
      }

      // 讀取並驗證 manifest
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      if (!manifest.id || !manifest.name || !manifest.version) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        return { success: false, message: 'manifest.json 缺少必要欄位（id, name, version）' }
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        return { success: false, message: 'manifest.id 含非法字元' }
      }

      // 複製到 agents 目錄
      const agentsBaseDir = path.join(os.homedir(), 'AgentOS', 'agents')
      const targetDir = path.join(agentsBaseDir, manifest.id)
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true })
      }
      fs.cpSync(searchDir, targetDir, { recursive: true })

      // 清理暫存
      fs.rmSync(tmpDir, { recursive: true, force: true })

      // 重新載入 agent manager
      agentMgr.loadAgents()

      console.log(`[GitHub Import] 成功匯入: ${manifest.name} v${manifest.version}`)
      return { success: true, message: `✅ 成功匯入 ${manifest.name} v${manifest.version}` }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.log(`[GitHub Import] 失敗: ${msg}`)
      return { success: false, message: `匯入失敗: ${msg}` }
    }
  })

  // === GitHub Installer ===
  ipcMain.handle('github:analyze', async (_, url: string) => {
    const { analyzeRepo } = await import('./services/installer-github')
    try {
      return await analyzeRepo(url)
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle('github:install', async (event, url: string) => {
    const { installRepo } = await import('./services/installer-github')
    const sender = event.sender
    try {
      return await installRepo(url, (line: string) => {
        sender.send('github:install-log', line)
      })
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e))
    }
  })

  ipcMain.handle('health-check-agent', async (_, id: string) => {
    const ok = await agentMgr.healthCheck(id)
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
    const prevDarkMode = store.get('darkMode')
    for (const [key, value] of Object.entries(settings)) {
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
    if (s.ollamaUrl   !== undefined) store.set('ollamaUrl',   s.ollamaUrl)
    if (s.apiProvider !== undefined) store.set('apiProvider', s.apiProvider)
    if (s.apiKey      !== undefined) store.set('apiKey',      s.apiKey)
    if (s.apiModel    !== undefined) store.set('apiModel',    s.apiModel)
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
    const { net } = await import('electron')
    const resolvedModel = model || 'openai/gpt-4o-mini'
    const body = JSON.stringify({ model: resolvedModel, messages, max_tokens: 1024, temperature: 0.7 })
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
    const { getCouncillorResponses } = await import('./services/council-service')
    return getCouncillorResponses(apiKey, model, question, mode)
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
    if (filePath.startsWith('ump-session:')) {
      const sessionId = filePath.slice('ump-session:'.length)
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
    const { saveMemoryItem } = await import('./services/memory')
    return saveMemoryItem(filePath, content)
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
    try {
      return umpHub.createTask(title, content, target, source)
    } catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('ump:get-tasks', (_, target?: string, status?: string) => {
    try {
      return umpHub.getTasks(target, status)
    } catch (e) { return [] }
  })

  ipcMain.handle('ump:update-task', (_, id: string, status: string, result?: string) => {
    try {
      const ok = umpHub.updateTaskStatus(id, status, result)
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
  ipcMain.handle('get-agent-catalog', () => {
    try {
      // packaged 時 registry 在 resources 目錄，開發時在 repo root
      const regPath = isDev
        ? path.join(__dirname, '..', 'agents-registry.json')
        : path.join(process.resourcesPath, 'agents-registry.json')
      if (!fs.existsSync(regPath)) return { agents: [] }
      const raw = fs.readFileSync(regPath, 'utf-8')
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
  console.log('[Notebook] Service initialized')
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
    try {
      const { createMemory } = await import('./services/ump/schemas')
      const mem = createMemory({
        id: crypto.randomUUID(),
        content: params.content,
        memory_type: (params.memoryType as 'semantic' | 'episodic' | 'procedural' | 'graph') || 'episodic',
        tags: params.tags || [],
        group_id: params.group_id,
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
    try { return notebookService.getNotebook(id) }
    catch (e) { return null }
  })

  ipcMain.handle('notebook:create', (_, name: string, description?: string, icon?: string, color?: string) => {
    console.log(`[Notebook] Creating notebook: ${name}`)
    const result = notebookService.createNotebook(name, description, icon, color)
    console.log('[Notebook] Created:', result)
    return result
  })

  ipcMain.handle('notebook:update', (_, id: string, updates: Record<string, unknown>) => {
    return notebookService.updateNotebook(id, updates as any)
  })

  ipcMain.handle('notebook:delete', (_, id: string) => {
    try { return notebookService.deleteNotebook(id) }
    catch (e) { return false }
  })

  ipcMain.handle('note:list', (_, notebookId: string) => {
    try { return notebookService.listNotes(notebookId) }
    catch (e) { return [] }
  })

  ipcMain.handle('note:get', (_, id: string) => {
    try { return notebookService.getNote(id) }
    catch (e) { return null }
  })

  ipcMain.handle('note:create', (_, notebookId: string, title: string, content?: string, tags?: string[]) => {
    try { return notebookService.createNote(notebookId, title, content, tags) }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('note:update', (_, id: string, updates: Record<string, unknown>) => {
    try { return notebookService.updateNote(id, updates as any) }
    catch (e) { return { error: String(e) } }
  })

  ipcMain.handle('note:delete', (_, id: string) => {
    try { return notebookService.deleteNote(id) }
    catch (e) { return false }
  })

  ipcMain.handle('note:search', (_, query: string, notebookId?: string, limit?: number) => {
    try { return notebookService.searchNotes(query, notebookId, limit) }
    catch (e) { return [] }
  })

  ipcMain.handle('note:all-tags', () => {
    try { return notebookService.getAllTags() }
    catch (e) { return [] }
  })

  ipcMain.handle('note:by-tag', (_, tag: string, limit?: number) => {
    try { return notebookService.getNotesByTag(tag, limit) }
    catch (e) { return [] }
  })

  // === Source Management ===
  const { setHub: setSourceHub } = await import('./services/source')
  const sourceService = await import('./services/source')
  setSourceHub(umpHub)

  ipcMain.handle('source:import-pdf', async (_, notebookId: string) => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: '選擇 PDF 檔案',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    try {
      const source = await sourceService.importPDF(result.filePaths[0], notebookId)
      return source
    } catch (e) {
      console.error('[Source] PDF import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:import-url', async (_, url: string, notebookId: string) => {
    try {
      return await sourceService.importURL(url, notebookId)
    } catch (e) {
      console.error('[Source] URL import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:import-text', (_, text: string, notebookId: string) => {
    try {
      return sourceService.importText(text, notebookId)
    } catch (e) {
      console.error('[Source] Text import failed:', e)
      return { error: String(e) }
    }
  })

  ipcMain.handle('source:get', (_, notebookId: string) => {
    try { return sourceService.getSources(notebookId) }
    catch (e) { return [] }
  })

  ipcMain.handle('source:delete', (_, sourceId: string) => {
    try { return sourceService.deleteSource(sourceId) }
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

  // Orchestrator
  const orchestrator = new Orchestrator()

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
    try {
      return await orchestrator.execute(prompt)
    } catch (e) {
      return `錯誤：${String(e)}`
    }
  })

  // === Discord Integration ===
  ipcMain.handle('discord:start', async () => {
    const config = {
      token: store.get('discordToken'),
      channelId: store.get('discordChannelId'),
      enabled: store.get('discordEnabled'),
    }
    console.log(`[Discord] discord:start — channelId="${config.channelId}" token=${config.token ? '***' : 'EMPTY'} enabled=${config.enabled}`)
    if (!config.token || !config.channelId) {
      return { success: false, message: '缺少 Token 或頻道 ID' }
    }
    return discordService.startBot(config, umpHub)
  })

  ipcMain.handle('discord:stop', async () => {
    return discordService.stopBot()
  })

  ipcMain.handle('discord:send', async (_, text: string) => {
    return discordService.sendMessage(text)
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
        console.log('[Discord] Auto-start:', result.message)
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
  if (umpHubInstance) umpHubInstance.close()
  const mgr = getAgentManager()
  const stability = stabilityService
  discordService.stopBot().catch(() => {})
  mgr.destroy().then(() => {
    stability.destroy()
    app.quit()
  })
})
