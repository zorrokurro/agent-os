import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import http from 'http'

const execAsync = promisify(exec)

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

function ollamaFetch(path: string, body?: object, baseUrl?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl || DEFAULT_OLLAMA_URL)
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

export async function checkOllama(baseUrl?: string): Promise<{ installed: boolean; running: boolean }> {
  let installed = false
  let running = false

  try {
    await execAsync('ollama --version', { timeout: 5000 })
    installed = true
  } catch {
    installed = false
  }

  if (installed) {
    try {
      // Use the configured URL to check if Ollama is actually reachable
      const url = new URL('/api/tags', baseUrl || DEFAULT_OLLAMA_URL)
      const healthy = await new Promise<boolean>((resolve) => {
        const req = http.get({ hostname: url.hostname, port: url.port, path: url.pathname, timeout: 5000 }, (res) => {
          resolve(res.statusCode === 200)
        })
        req.on('error', () => resolve(false))
        req.on('timeout', () => { req.destroy(); resolve(false) })
      })
      running = healthy
    } catch {
      running = false
    }
  }

  return { installed, running }
}

export async function installOllama(
  onProgress: (msg: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/OllamaSetup.exe'
  try {
    onProgress('正在下載 Ollama 安裝檔...', 5)

    // 用 PowerShell 下載（在 cmd.exe 中需用 %TEMP%）
    const outPath = `${process.env.TEMP}\\OllamaSetup.exe`
    const downloadCmd = `powershell -Command "Invoke-WebRequest -Uri '${OLLAMA_DOWNLOAD_URL}' -OutFile '${outPath}' -UseBasicParsing"`
    await execAsync(downloadCmd, { timeout: 120000 })

    onProgress('下載完成，正在安裝...', 30)

    // 靜默安裝
    await execAsync(`"${outPath}" /SILENT /NORESTART`, { timeout: 120000 })

    onProgress('安裝完成，正在啟動 Ollama...', 70)

    // 啟動 Ollama 服務
    await execAsync('ollama serve', { timeout: 10000 }).catch(() => {
      // 可能已經在跑
    })

    // 等待服務就緒
    for (let i = 0; i < 30; i++) {
      try {
        await execAsync('ollama list', { timeout: 2000 })
        onProgress('Ollama 已就緒', 100)
        return { success: true }
      } catch {
        await new Promise(r => setTimeout(r, 1000))
        onProgress(`等待 Ollama 啟動... (${i + 1}s)`, 70 + i)
      }
    }

    return { success: false, error: 'Ollama 安裝完成但服務啟動超時' }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
}

export async function pullModel(
  model: string,
  onProgress: (msg: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    return new Promise((resolve) => {
      const proc = spawn('ollama', ['pull', model], { shell: true })

      let lastPercent = 0
      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        // 解析 Ollama pull 輸出中的百分比
        const match = text.match(/(\d+)%/)
        if (match) {
          lastPercent = parseInt(match[1])
          onProgress(`正在下載 ${model}...`, lastPercent)
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString()
        const match = text.match(/(\d+)%/)
        if (match) {
          lastPercent = parseInt(match[1])
          onProgress(`正在下載 ${model}...`, lastPercent)
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          onProgress(`${model} 下載完成`, 100)
          resolve({ success: true })
        } else {
          resolve({ success: false, error: `模型下載失敗，退出碼: ${code}` })
        }
      })
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('ollama list', { timeout: 10000 })
    const lines = stdout.trim().split('\n').slice(1) // skip header
    return lines.map(l => l.split(/\s+/)[0]).filter(Boolean)
  } catch {
    return []
  }
}

export async function startOllamaServe(): Promise<void> {
  // 啟動 Ollama serve（背景執行）
  spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
    shell: true,
  }).unref()
}

export async function chat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onToken?: (token: string) => void,
  baseUrl?: string
): Promise<string> {
  try {
    // Ensure Ollama is running
    const status = await checkOllama(baseUrl)
    if (!status.running) {
      startOllamaServe()
      // Wait up to 10s for it to start
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const s = await checkOllama(baseUrl)
        if (s.running) break
      }
    }

    // Try streaming first
    if (onToken) {
      return await chatStream(model, messages, onToken, baseUrl)
    }

    // Non-streaming fallback
    const response = await ollamaFetch('/api/chat', {
      model,
      messages,
      stream: false,
    }, baseUrl)
    return typeof response === 'string' ? response : (response?.message?.content || '')
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Chat failed: ${msg}`)
  }
}

function chatStream(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onToken: (token: string) => void,
  baseUrl?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/chat', baseUrl || DEFAULT_OLLAMA_URL)
    const body = JSON.stringify({ model, messages, stream: true })

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 120000,
    }, (res) => {
      let full = ''
      let buffer = ''
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        // Ollama streams newline-delimited JSON
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line in buffer
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const obj = JSON.parse(line)
            if (obj.message?.content) {
              full += obj.message.content
              onToken(obj.message.content)
            }
            if (obj.done) {
              resolve(full)
              return
            }
          } catch { /* skip malformed lines */ }
        }
      })
      res.on('end', () => {
        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const obj = JSON.parse(buffer)
            if (obj.message?.content) {
              full += obj.message.content
              onToken(obj.message.content)
            }
          } catch { /* ignore */ }
        }
        resolve(full)
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}
