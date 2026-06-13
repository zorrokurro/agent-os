import { Task } from '../task-analyzer'
import { net } from 'electron'

export interface AgentController {
  execute(task: Task, context?: string): Promise<string>
}

const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 60000

function getHub() {
  // Dynamic import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../ump/hub') as { memoryHub: import('../../ump/hub').MemoryHub }
  return mod.memoryHub
}

function httpGet(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url })
    let responseData = ''
    const timer = setTimeout(() => { request.abort(); reject(new Error('请求超时')) }, timeout)
    request.on('response', (response) => {
      response.on('data', (chunk) => { responseData += chunk.toString() })
      response.on('end', () => { clearTimeout(timer); resolve(responseData) })
    })
    request.on('error', (err) => { clearTimeout(timer); reject(err) })
    request.end()
  })
}

export class HermesController implements AgentController {
  async execute(task: Task, context?: string): Promise<string> {
    console.log(`[Hermes] 執行任務：${task.description}`)
    if (context) console.log(`[Hermes] 收到上下文：${context.substring(0, 100)}...`)

    const hub = getHub()
    const title = task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description
    const content = context ? `${task.description}\n\n---\n\n上下文：\n${context}` : task.description

    // Create task in UMP Hub
    const created = hub.createTask(title, content, 'Hermes', 'AgentOS-Orchestrator')
    console.log(`[Hermes] 任務已建立：${created.id}`)

    // Poll for result
    const startTime = Date.now()
    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      const tasks = hub.getTasks('Hermes')
      const current = tasks.find(t => t.id === created.id)
      if (!current) continue

      if (current.status === 'completed') {
        console.log(`[Hermes] 任務完成：${current.id}`)
        return current.result || '（無結果）'
      }

      if (current.status === 'failed') {
        console.log(`[Hermes] 任務失敗：${current.id}`)
        return `[Hermes 執行失敗] ${current.result || '未知錯誤'}`
      }
    }

    // Timeout
    console.log(`[Hermes] 任務等待超時：${created.id}`)
    return '任務已建立，Hermes 尚未回應，請稍後查看'
  }

  static async testConnection(hermesUrl: string): Promise<{ ok: boolean; message: string }> {
    const url = `${hermesUrl}/health`
    try {
      const raw = await httpGet(url, 5000)
      const parsed = JSON.parse(raw)
      if (parsed.status === 'ok' || parsed.status === 'healthy') {
        return { ok: true, message: '✅ Hermes 連線正常' }
      }
      return { ok: true, message: `✅ Hermes 回應：${raw}` }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        return { ok: false, message: '❌ 無法連線，請確認 Hermes 是否執行中' }
      }
      return { ok: false, message: `❌ 連線失敗：${msg}` }
    }
  }
}
