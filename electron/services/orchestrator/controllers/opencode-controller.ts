import { spawn, ChildProcess } from 'child_process'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { Task } from '../task-analyzer'

export interface AgentController {
  execute(task: Task, context?: string): Promise<string>
}

const OPENCODE_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ''
const OPENCODE_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode'
const OPENCODE_PORT = 5001

console.log(`[OpenCode] OPENCODE_SERVER_PASSWORD: ${OPENCODE_PASSWORD ? 'set' : 'NOT SET'}`)
console.log(`[OpenCode] OPENCODE_USERNAME: ${OPENCODE_USERNAME}`)
try {
  const whereResult = execSync('where opencode', { encoding: 'utf-8', timeout: 5000 }).trim()
  console.log(`[OpenCode] opencode path: ${whereResult}`)
} catch {
  console.log('[OpenCode] opencode NOT found in PATH')
}

function getAuthHeader(): string {
  const credentials = `${OPENCODE_USERNAME}:${OPENCODE_PASSWORD}`
  return 'Basic ' + Buffer.from(credentials).toString('base64')
}

async function httpGet(path: string): Promise<string> {
  console.log(`[OpenCode] GET http://127.0.0.1:${OPENCODE_PORT}${path}`)
  const response = await fetch(`http://127.0.0.1:${OPENCODE_PORT}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/json',
    },
  })
  console.log(`[OpenCode] GET ${path} -> ${response.status}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.text()
}

async function httpPost(path: string, body: unknown): Promise<string> {
  console.log(`[OpenCode] POST http://127.0.0.1:${OPENCODE_PORT}${path}`)
  const response = await fetch(`http://127.0.0.1:${OPENCODE_PORT}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  console.log(`[OpenCode] POST ${path} -> ${response.status}`)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.text()
}

async function waitForServer(maxAttempts = 30, intervalMs = 1000): Promise<boolean> {
  console.log(`[OpenCode] Waiting for server (max ${maxAttempts}s)...`)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await httpGet('/global/health')
      const health = JSON.parse(result)
      if (health.healthy) {
        console.log(`[OpenCode] Server ready after ${i + 1}s`)
        return true
      }
    } catch (e) {
      if (i % 5 === 0) console.log(`[OpenCode] Waiting... (${i}s)`)
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  console.log('[OpenCode] Server timeout!')
  return false
}

function startServer(): ChildProcess {
  const cmdPath = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'opencode.cmd')
  if (!fs.existsSync(cmdPath)) {
    // Fallback: try `where opencode` to find it in PATH
    try {
      const whereResult = execSync('where opencode.cmd', { encoding: 'utf-8', timeout: 5000, windowsHide: true }).trim().split('\n')[0]
      console.log(`[OpenCode] opencode.cmd not at expected path, using PATH: ${whereResult}`)
      const proc = spawn('cmd.exe', ['/c', whereResult, 'serve', '--port', String(OPENCODE_PORT)], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      proc.stdout?.on('data', (data) => {
        console.log(`[OpenCode-stdout] ${data.toString().trim()}`)
      })
      proc.stderr?.on('data', (data) => {
        console.log(`[OpenCode-stderr] ${data.toString().trim()}`)
      })
      proc.on('error', (err) => {
        console.log(`[OpenCode] spawn error: ${err.message}`)
      })
      proc.on('exit', (code) => {
        console.log(`[OpenCode] process exited with code ${code}`)
      })
      proc.unref()
      return proc
    } catch {
      throw new Error(`opencode.cmd not found at ${cmdPath} and not in PATH`)
    }
  }
  console.log(`[OpenCode] Spawning: ${cmdPath} serve --port ${OPENCODE_PORT}`)
  const proc = spawn('cmd.exe', ['/c', cmdPath, 'serve', '--port', String(OPENCODE_PORT)], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  proc.stdout?.on('data', (data) => {
    console.log(`[OpenCode-stdout] ${data.toString().trim()}`)
  })
  proc.stderr?.on('data', (data) => {
    console.log(`[OpenCode-stderr] ${data.toString().trim()}`)
  })
  proc.on('error', (err) => {
    console.log(`[OpenCode] spawn error: ${err.message}`)
  })
  proc.on('exit', (code) => {
    console.log(`[OpenCode] process exited with code ${code}`)
  })
  proc.unref()
  return proc
}

export class OpenCodeController implements AgentController {
  private serverProcess: ChildProcess | null = null
  private serverReady = false

  async execute(task: Task, context?: string): Promise<string> {
    console.log(`[OpenCode] 執行任務：${task.description}`)
    if (context) console.log(`[OpenCode] 收到上下文：${context.substring(0, 100)}...`)

    // 確保 server 在跑
    if (!this.serverReady) {
      await this.ensureServer()
    }

    // 建立 session
    const sessionResult = await httpPost('/session', {})
    const session = JSON.parse(sessionResult)
    const sessionId = session.id
    console.log(`[OpenCode] Session 建立：${sessionId}`)

    // 組裝 prompt
    let prompt = task.description
    if (context) {
      prompt = `前一個任務的結果：\n${context}\n\n現在請執行：${task.description}`
    }
    prompt = `${prompt}\n\nIMPORTANT: Please respond directly with your answer in plain text. Do not use any tools. Just provide your response as text.`

    // 發送訊息
    const messageResult = await httpPost(`/session/${sessionId}/message`, {
      parts: [{ type: 'text', text: prompt }],
    })

    const message = JSON.parse(messageResult)
    console.log(`[OpenCode] Full response keys:`, Object.keys(message))
    console.log(`[OpenCode] Response parts:`, JSON.stringify(message.parts?.map((p: any) => ({ type: p.type, name: p.name, id: p.toolCallId }))))
    if (message.info) console.log(`[OpenCode] Response info:`, JSON.stringify(message.info).substring(0, 500))

    // 檢查錯誤
    if (message.info?.error) {
      const errorMsg = message.info.error.data?.message || message.info.error.name || 'Unknown error'
      throw new Error(`OpenCode 執行錯誤：${errorMsg}`)
    }

    // 提取結果
    const result = this.extractResult(message)
    console.log(`[OpenCode] 完成：${result.substring(0, 100)}...`)

    return result
  }

  private extractResult(message: Record<string, unknown>): string {
    const parts = (message.parts as Array<Record<string, unknown>>) || []
    
    const textParts = parts
      .filter(p => p.type === 'text')
      .map(p => p.text as string)
    
    if (textParts.length > 0) {
      return textParts.join('\n')
    }

    const toolCalls = parts.filter(p => p.type === 'tool-call')
    if (toolCalls.length > 0) {
      return toolCalls.map(tc => {
        const fn = tc.function as Record<string, unknown> | undefined
        const name = fn?.name || tc.name || 'unknown'
        const args = fn?.arguments || tc.arguments
        const argsStr = typeof args === 'string' ? args : JSON.stringify(args, null, 2)
        return `[Tool Call] ${name}\n${argsStr}`
      }).join('\n\n')
    }

    return JSON.stringify(message, null, 2)
  }

  private async ensureServer(): Promise<void> {
    // 先檢查 server 是否已在跑
    try {
      const result = await httpGet('/global/health')
      const health = JSON.parse(result)
      if (health.healthy) {
        this.serverReady = true
        console.log(`[OpenCode] Server 已在運行（port ${OPENCODE_PORT}）`)
        return
      }
    } catch {
      // Server 沒在跑
    }

    // 啟動 server
    console.log(`[OpenCode] 啟動 server（port ${OPENCODE_PORT}）...`)
    this.serverProcess = startServer()

    // 等待 server 就緒
    const ready = await waitForServer(30, 1000)
    if (!ready) {
      throw new Error('OpenCode server 啟動超時')
    }

    this.serverReady = true
    console.log(`[OpenCode] Server 就緒`)
  }

  async shutdown(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill()
      this.serverProcess = null
    }
    this.serverReady = false
  }
}
