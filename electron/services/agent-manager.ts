import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import http from 'http'
import { existsSync } from 'fs'
import {
  checkHealthEndpoint,
  detectByProcessName,
  checkPortAndProcess,
  checkConfigActivity,
} from './agent-detection'

// ============================================================
// 工具函式
// ============================================================

function findExecutablePath(name: string): string | null {
  try {
    // Windows 用 where 指令找執行檔位置
    const result = execSync(`where ${name}`, { encoding: 'utf-8', windowsHide: true })
    return result.trim().split('\n')[0]
  } catch {
    // where 找不到，掃描常見安裝路徑
    const commonPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', name, `${name}.exe`),
      path.join(os.homedir(), 'AppData', 'Local', name, `${name}.exe`),
      `C:\\Program Files\\${name}\\${name}.exe`,
      `C:\\Program Files (x86)\\${name}\\${name}.exe`,
    ]
    for (const p of commonPaths) {
      if (existsSync(p)) return p
    }
    return null
  }
}

// 獨立 Agent 執行檔路徑快取（null = 使用 findExecutablePath 自動搜尋）
const AGENT_EXECUTABLE_PATHS: Record<string, string | null> = {
  opencode: null,
  openhuman: null,
}

// OpenHuman 安裝偵測（workspace 目錄存在就算已安裝）
function detectOpenHumanInstalled(): boolean {
  const workspacePath = path.join(os.homedir(), '.openhuman', 'users')
  return existsSync(workspacePath)
}

// ============================================================
// 型別
// ============================================================

export interface AgentManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: string
  icon: string
  tags: string[]
  price: number | 'free'
  // 啟動設定
  runtime: {
    type: 'node' | 'python' | 'binary' | 'docker' | 'external'
    // node: npx <entry> / python: python <entry> / binary: 直接執行 / external: 外部管理
    entry: string
    args?: string[]
    port: number
    env?: Record<string, string>
  }
  // 健康檢查設定
  healthCheck?: {
    type: 'http' | 'tcp' | 'none'
    url?: string
    port?: number
    timeout?: number
  }
  // Agent 使用的埠號列表
  ports?: number[]
  // Agent 進程名稱（用於 PID 比對）
  processNames?: string[]
  // Config 目錄路徑（用於活躍度偵測）
  configPath?: string
  // API 版本（給其他 Agent 依賴用）
  api: {
    version: string
    basePath: string
  }
  // 依賴其他 Agent
  dependencies?: Record<string, {
    apiVersion: string       // 要求的 API 版本，如 "1.x"
    optional: boolean        // true = 沒這個 Agent 也能跑
  }>
  // 升級遷移腳本
  migrationScript?: string
}

export interface AgentStatus {
  id: string
  name: string
  status: 'stopped' | 'running' | 'error' | 'unknown'
  port?: number
  version?: string
  pid?: number
  lastError?: string
  startedAt?: string
}

// ============================================================
// Agent Manager
// ============================================================

const AGENTS_DIR = path.join(os.homedir(), 'AgentOS', 'agents')
const AGENTS_DATA = path.join(os.homedir(), 'AgentOS', 'agents-data')

class AgentManager {
  private manifests: Map<string, AgentManifest> = new Map()
  private statuses: Map<string, AgentStatus> = new Map()
  private processes: Map<string, ChildProcess> = new Map()

  constructor() {
    this.loadAgents()
  }

  // ---- 三層偵測 (delegated to agent-detection.ts) ----

  // 整合三層偵測
  async detectAgentStatus(id: string): Promise<'running' | 'stopped' | 'unknown'> {
    const manifest = this.manifests.get(id)
    if (!manifest) return 'unknown'

    // 外部 Agent 才需要三層偵測，一般 Agent 由進程管理
    if (manifest.runtime.type !== 'external') {
      const proc = this.processes.get(id)
      if (proc && !proc.killed) return 'running'
      return 'stopped'
    }

    const healthCheck = manifest.healthCheck ?? { type: 'none' }
    const ports = manifest.ports ?? (manifest.runtime.port > 0 ? [manifest.runtime.port] : [])
    const processNames = manifest.processNames ?? []

    if (await checkHealthEndpoint(healthCheck)) return 'running'
    if (detectByProcessName(id)) return 'running'
    if (checkPortAndProcess(ports, processNames).running) return 'running'
    if (manifest.configPath) {
      const activity = checkConfigActivity(manifest.configPath)
      if (activity === 'active') return 'running'
      if (activity === 'inactive') return 'stopped'
    }

    return 'unknown'
  }

  // ---- 載入 ----

  loadAgents() {
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true })
    if (!fs.existsSync(AGENTS_DATA)) fs.mkdirSync(AGENTS_DATA, { recursive: true })

    for (const dir of fs.readdirSync(AGENTS_DIR)) {
      const mfPath = path.join(AGENTS_DIR, dir, 'manifest.json')
      if (!fs.existsSync(mfPath)) continue
      try {
        const m: AgentManifest = JSON.parse(fs.readFileSync(mfPath, 'utf-8'))
        this.manifests.set(m.id, m)
        this.statuses.set(m.id, { id: m.id, name: m.name, status: 'stopped', version: m.version })
      } catch (e) {
        console.error(`[AgentMgr] manifest 載入失敗: ${dir}`)
      }
    }
    console.log(`[AgentMgr] 已載入 ${this.manifests.size} 個 Agent`)
  }

  // 重新整理所有 Agent 狀態（非阻塞）
  async refreshAllStatuses(): Promise<void> {
    for (const [id, manifest] of this.manifests) {
      if (manifest.runtime.type === 'external') {
        const status = await this.detectAgentStatus(id)
        this.statuses.set(id, { ...this.statuses.get(id)!, status })
      }
    }
  }

  getManifest(id: string) { return this.manifests.get(id) }
  getAllManifests() { return Array.from(this.manifests.values()) }
  getStatus(id: string) { return this.statuses.get(id) }
  getAllStatuses() { return Array.from(this.statuses.values()) }

  // ---- 相容性檢查 ----

  checkCompatibility(id: string): string | null {
    const m = this.manifests.get(id)
    if (!m) return 'Agent 不存在'

    for (const [depId, dep] of Object.entries(m.dependencies || {})) {
      const depStatus = this.statuses.get(depId)
      if (!depStatus || depStatus.status !== 'running') {
        if (!dep.optional) return `需要 ${depId} (apiVersion ${dep.apiVersion}) 但未運行`
      }
      // TODO: 版本號比對（dep.apiVersion vs dep實際支援的 apiVersion）
    }
    return null
  }

  // ---- 啟動 ----

  async startAgent(id: string): Promise<{ success: boolean; error?: string; port?: number }> {
    const m = this.manifests.get(id)
    if (!m) return { success: false, error: 'Agent 不存在' }

    // External agents: use known executable path with lazy fallback
    if (m.runtime.type === 'external') {
      let exePath = AGENT_EXECUTABLE_PATHS[id]

      // 如果 null 就即時搜尋一次
      if (!exePath) {
        exePath = findExecutablePath(id)
        if (exePath) AGENT_EXECUTABLE_PATHS[id] = exePath // 快取起來
      }

      if (!exePath) {
        return {
          success: false,
          error: `找不到 ${m.name} 執行檔，請確認已安裝。嘗試路徑：where ${id}、AppData\\Local\\Programs\\${id}\\`
        }
      }

      const dataDir = path.join(AGENTS_DATA, id)
      fs.mkdirSync(dataDir, { recursive: true })

      try {
        let proc: ChildProcess

        // OpenHuman 是桌面 App，用 shell: true 啟動
        if (id === 'openhuman') {
          proc = spawn(exePath, [], {
            cwd: dataDir,
            env: { ...process.env },
            stdio: 'ignore',
            detached: true,
            shell: true,
          })
        } else {
          proc = spawn(exePath, [], {
            cwd: dataDir,
            env: { ...process.env },
            stdio: 'ignore',
            detached: true,
          })
        }

        proc.unref() // 讓主進程不等待

        this.processes.set(id, proc)

        proc.on('exit', (code) => {
          console.log(`[AgentMgr] ${id} exited with code ${code}`)
          this.processes.delete(id)
          this.statuses.set(id, {
            ...this.statuses.get(id)!,
            status: code === 0 ? 'stopped' : 'error',
            pid: undefined,
            lastError: code !== 0 ? `退出碼: ${code}` : undefined,
          })
        })

        this.statuses.set(id, {
          id,
          name: m.name,
          status: 'running',
          version: m.version,
          pid: proc.pid,
          startedAt: new Date().toISOString(),
        })

        return { success: true }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        this.statuses.set(id, { id, name: m.name, status: 'error', version: m.version, lastError: msg })
        return { success: false, error: msg }
      }
    }

    const compatErr = this.checkCompatibility(id)
    if (compatErr) return { success: false, error: compatErr }

    const dataDir = path.join(AGENTS_DATA, id)
    fs.mkdirSync(dataDir, { recursive: true })

    const agentDir = path.join(AGENTS_DIR, id)

    try {
      let cmd: string
      let args: string[] = []

      if (m.runtime.type === 'node') {
        cmd = 'npx'
        args = [m.runtime.entry, '--port', String(m.runtime.port)]
      } else if (m.runtime.type === 'python') {
        cmd = 'python3'
        args = [m.runtime.entry, '--port', String(m.runtime.port)]
      } else if (m.runtime.type === 'docker') {
        // 保留 Docker 選項
        cmd = 'docker'
        args = ['run', '-d', '--name', `agentos-${id}`, '-p', `${m.runtime.port}:${m.runtime.port}`, m.runtime.entry]
      } else {
        cmd = m.runtime.entry
        args = m.runtime.args || []
      }

      const proc = spawn(cmd, args, {
        cwd: agentDir,
        env: {
          ...process.env,
          AGENTOS_DATA_DIR: dataDir,
          AGENTOS_PORT: String(m.runtime.port),
          ...m.runtime.env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      })

      this.processes.set(id, proc)

      // 收集 stdout/stderr 用於除錯
      const logFile = path.join(dataDir, 'agent.log')
      const logStream = fs.createWriteStream(logFile, { flags: 'a' })

      proc.stdout?.on('data', (d: Buffer) => {
        logStream.write(`[OUT] ${d}`)
      })
      proc.stderr?.on('data', (d: Buffer) => {
        logStream.write(`[ERR] ${d}`)
      })

      proc.on('exit', (code) => {
        console.log(`[AgentMgr] ${id} exited with code ${code}`)
        this.processes.delete(id)
        this.statuses.set(id, {
          ...this.statuses.get(id)!,
          status: code === 0 ? 'stopped' : 'error',
          pid: undefined,
          lastError: code !== 0 ? `退出碼: ${code}` : undefined,
        })
        logStream.end()
      })

      this.statuses.set(id, {
        id,
        name: m.name,
        status: 'running',
        port: m.runtime.port,
        version: m.version,
        pid: proc.pid,
        startedAt: new Date().toISOString(),
      })

      // 等待健康檢查
      const healthy = await this.waitForHealth(m.runtime.port, m.id, 10)
      if (!healthy) {
        console.warn(`[AgentMgr] ${id} 啟動後健康檢查未通過，但仍視為運行中`)
      }

      return { success: true, port: m.runtime.port }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.statuses.set(id, { id, name: m.name, status: 'error', version: m.version, lastError: msg })
      return { success: false, error: msg }
    }
  }

  // ---- 停止 ----

  async stopAgent(id: string): Promise<boolean> {
    const proc = this.processes.get(id)
    if (!proc) return false

    try {
      proc.kill('SIGTERM')
      // 等待 5 秒
      await new Promise(r => setTimeout(r, 5000))
      if (!proc.killed) proc.kill('SIGKILL')
    } catch { /* 忽略 */ }

    this.processes.delete(id)
    this.statuses.set(id, { ...this.statuses.get(id)!, status: 'stopped', pid: undefined })
    return true
  }

  // ---- 升級 ----

  async upgradeAgent(id: string, onProgress?: (msg: string, pct: number) => void): Promise<boolean> {
    const m = this.manifests.get(id)
    if (!m) return false

    onProgress?.('快照 config + data...', 10)

    // 快照
    const dataDir = path.join(AGENTS_DATA, id)
    const snapshotDir = path.join(AGENTS_DATA, `${id}-snapshot-${Date.now()}`)
    if (fs.existsSync(dataDir)) {
      fs.cpSync(dataDir, snapshotDir, { recursive: true })
    }

    onProgress?.('停止舊版...', 25)
    await this.stopAgent(id)

    onProgress?.('遷移資料...', 50)

    // 遷移腳本
    if (m.migrationScript) {
      const scriptPath = path.join(AGENTS_DIR, id, m.migrationScript)
      if (fs.existsSync(scriptPath)) {
        try {
          const { execSync } = require('child_process')
          execSync(`node "${scriptPath}"`, { stdio: 'pipe', timeout: 10000 })
        } catch (e) {
          console.warn(`[AgentMgr] 遷移腳本執行失敗: ${e}`)
        }
      }
    }

    onProgress?.('啟動新版...', 75)
    const result = await this.startAgent(id)
    if (!result.success) {
      onProgress?.('啟動失敗，回滾中...', 0)
      // 回滾
      if (fs.existsSync(snapshotDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true })
        fs.cpSync(snapshotDir, dataDir, { recursive: true })
      }
      await this.startAgent(id)
      return false
    }

    onProgress?.('升級完成！', 100)
    return true
  }

  // ---- 健康檢查 ----

  private waitForHealth(port: number, id: string, maxRetries: number): Promise<boolean> {
    return new Promise((resolve) => {
      let retries = 0
      const tryCheck = () => {
        const req = http.get(`http://localhost:${port}/health`, { timeout: 2000 }, (res) => {
          resolve(res.statusCode === 200)
        })
        req.on('error', () => {
          retries++
          if (retries >= maxRetries) resolve(false)
          else setTimeout(tryCheck, 1000)
        })
        req.on('timeout', () => { req.destroy(); retries++; if (retries >= maxRetries) resolve(false); else setTimeout(tryCheck, 1000) })
      }
      setTimeout(tryCheck, 500)
    })
  }

  async healthCheck(id: string): Promise<boolean> {
    const s = this.statuses.get(id)
    if (!s || !s.port) return false
    return this.waitForHealth(s.port, id, 3)
  }

  // ---- 清理 ----
  // 由 main.ts before-quit handler 呼叫
  // SIGTERM 所有 process → 等待最多 5 秒 → SIGKILL 殘留

  destroy(): Promise<void> {
    return new Promise((resolve) => {
      const procs = [...this.processes.values()]
      if (procs.length === 0) { this.processes.clear(); resolve(); return }

      let exited = 0
      const onExit = () => {
        exited++
        if (exited >= procs.length) {
          this.processes.clear()
          resolve()
        }
      }

      for (const proc of procs) {
        try {
          proc.on('exit', onExit)
          proc.kill('SIGTERM')
        } catch { onExit() }
      }

      // 最多等 5 秒
      setTimeout(() => {
        for (const proc of this.processes.values()) {
          try { if (!proc.killed) proc.kill('SIGKILL') } catch { /* ignore */ }
        }
        this.processes.clear()
        resolve()
      }, 5000)
    })
  }
}

// 全域 singleton
let _instance: AgentManager | null = null
export function getAgentManager(): AgentManager {
  if (!_instance) _instance = new AgentManager()
  return _instance
}
