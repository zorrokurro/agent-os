import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow, app } from 'electron'
import http from 'http'

interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'error'
  pid?: number
  uptime?: number
  lastCheck: string
  restartCount: number
}

interface HealthCheckResult {
  healthy: boolean
  services: ServiceStatus[]
  issues: string[]
}

const MAX_RESTART_ATTEMPTS = 3
const DEFAULT_CHECK_INTERVAL = 30 // 秒

class StabilityService {
  private mainWindow: BrowserWindow | null = null
  private checkTimer: NodeJS.Timeout | null = null
  private services: Map<string, ServiceStatus> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private ollamaUrl: string = 'http://localhost:11434'
  private checkInterval: number = DEFAULT_CHECK_INTERVAL

  init(win: BrowserWindow, opts?: { ollamaUrl?: string; checkInterval?: number }) {
    this.mainWindow = win
    if (opts?.ollamaUrl) this.ollamaUrl = opts.ollamaUrl
    if (opts?.checkInterval) this.checkInterval = opts.checkInterval
    this.registerService('ollama')
    this.startHealthCheck()
  }

  private registerService(name: string) {
    this.services.set(name, {
      name,
      status: 'stopped',
      lastCheck: new Date().toISOString(),
      restartCount: 0,
    })
  }

  private startHealthCheck() {
    this.checkTimer = setInterval(() => this.runHealthCheck(), this.checkInterval * 1000)
    // 立即執行一次
    this.runHealthCheck()
  }

  async runHealthCheck(): Promise<HealthCheckResult> {
    const issues: string[] = []
    const services: ServiceStatus[] = []

    // 檢查 Ollama
    const ollamaStatus = await this.checkOllama()
    services.push(ollamaStatus)

    if (ollamaStatus.status === 'error') {
      issues.push('Ollama 服務異常')
      await this.attemptRestart('ollama')
    }

    // 更新狀態
    for (const s of services) {
      this.services.set(s.name, s)
    }

    const healthy = issues.length === 0

    // 通知前端
    this.mainWindow?.webContents.send('health-check-result', { healthy, services, issues })

    return { healthy, services, issues }
  }

  private async checkOllama(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      name: 'ollama',
      status: 'stopped',
      lastCheck: new Date().toISOString(),
      restartCount: this.services.get('ollama')?.restartCount || 0,
    }

    try {
      // 用 http.get 非同步檢查，避免 execSync 阻塞主行程
      const healthy = await new Promise<boolean>((resolve) => {
        const url = new URL('/api/tags', this.ollamaUrl)
        const req = http.get({ hostname: url.hostname, port: url.port, path: url.pathname, timeout: 5000 }, (res) => {
          resolve(res.statusCode === 200)
        })
        req.on('error', () => resolve(false))
        req.on('timeout', () => { req.destroy(); resolve(false) })
      })
      status.status = healthy ? 'running' : 'error'
    } catch {
      status.status = 'error'
    }

    return status
  }

  private async attemptRestart(serviceName: string) {
    const service = this.services.get(serviceName)
    if (!service) return

    if (service.restartCount >= MAX_RESTART_ATTEMPTS) {
      this.mainWindow?.webContents.send('service-restart-failed', {
        service: serviceName,
        reason: `已達最大重啟次數 (${MAX_RESTART_ATTEMPTS})`,
      })
      return
    }

    this.mainWindow?.webContents.send('service-restarting', {
      service: serviceName,
      attempt: service.restartCount + 1,
    })

    try {
      if (serviceName === 'ollama') {
        // 重啟 Ollama
        const proc = spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        })
        proc.unref()
        this.processes.set(serviceName, proc)

        // 等待啟動
        await new Promise(r => setTimeout(r, 5000))

        // 驗證 — 用 http.get 代替 execSync
        try {
          const healthy = await new Promise<boolean>((resolve) => {
            const url = new URL('/api/tags', this.ollamaUrl)
            const req = http.get({ hostname: url.hostname, port: url.port, path: url.pathname, timeout: 5000 }, (res) => {
              resolve(res.statusCode === 200)
            })
            req.on('error', () => resolve(false))
            req.on('timeout', () => { req.destroy(); resolve(false) })
          })
          if (healthy) {
            service.status = 'running'
            service.restartCount = 0
            service.pid = proc.pid
          } else {
            service.restartCount++
          }
        } catch {
          service.restartCount++
        }
      }
    } catch (e) {
      service.restartCount++
      console.error(`重啟 ${serviceName} 失敗:`, e)
    }

    this.services.set(serviceName, service)
  }

  // 手動重啟服務
  async restartService(serviceName: string): Promise<{ success: boolean; error?: string }> {
    const service = this.services.get(serviceName)
    if (!service) {
      return { success: false, error: '服務未註冊' }
    }

    service.restartCount = 0
    this.services.set(serviceName, service)
    await this.attemptRestart(serviceName)

    const updated = this.services.get(serviceName)
    return {
      success: updated?.status === 'running',
      error: updated?.status !== 'running' ? '重啟失敗' : undefined,
    }
  }

  // 取得所有服務狀態
  getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.services.values())
  }

  setOllamaUrl(url: string) {
    this.ollamaUrl = url
  }

  setCheckInterval(seconds: number) {
    this.checkInterval = seconds
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = setInterval(() => this.runHealthCheck(), this.checkInterval * 1000)
    }
  }

  setAutoStart(enabled: boolean) {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe'),
      })
    } catch (e) {
      console.error('設定開機自動啟動失敗:', e)
    }
  }

  // 清理
  destroy() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
    }
    for (const [name, proc] of this.processes) {
      try {
        proc.kill()
      } catch {
        // ignore
      }
    }
  }
}

export const stabilityService = new StabilityService()
