import { spawn, ChildProcess, exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import fs from 'fs'

const execAsync = promisify(exec)

const HERMES_DIR = path.join(os.homedir(), 'AgentOS', 'agents', 'hermes')
const HERMES_MEMORY = path.join(os.homedir(), 'AgentOS', 'Memory')

export interface HermesConfig {
  providerId: string
  modelId: string
  apiBase: string
  apiKey: string
  autoStart: boolean
}

export function ensureHermesDir(): void {
  fs.mkdirSync(HERMES_DIR, { recursive: true })
  fs.mkdirSync(HERMES_MEMORY, { recursive: true })
  fs.mkdirSync(path.join(HERMES_MEMORY, 'projects'), { recursive: true })
  fs.mkdirSync(path.join(HERMES_MEMORY, 'conversations'), { recursive: true })
  fs.mkdirSync(path.join(HERMES_MEMORY, 'outputs'), { recursive: true })

  const profilePath = path.join(HERMES_MEMORY, 'user_profile.md')
  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, `# 使用者檔案\n\n<!-- 首次安裝後由使用者填寫 -->\n`, 'utf-8')
  }

  const brandPath = path.join(HERMES_MEMORY, 'brand_voice.md')
  if (!fs.existsSync(brandPath)) {
    fs.writeFileSync(brandPath, `# 品牌聲音\n\n<!-- AgentOS 會從對話中自動學習 -->\n`, 'utf-8')
  }
}

export async function checkHermesInstalled(): Promise<{ installed: boolean; version: string | null }> {
  try {
    const { stdout } = await execAsync('hermes --version') as any
    return { installed: true, version: stdout.trim() }
  } catch {
    return { installed: false, version: null }
  }
}

export async function installHermes(
  onProgress: (msg: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress('正在檢查 Node.js 環境...', 5)
    const { stdout: nodeOut } = await execAsync('node --version') as any
    const nodeVersion = nodeOut.trim()
    onProgress(`Node.js ${nodeVersion} 已就緒`, 15)

    onProgress('正在安裝 Hermes Agent...', 20)
    const { stdout: installOut, stderr: installErr } = await execAsync(
      'npm install -g @anthropic/hermes-agent',
      { timeout: 120000, encoding: 'utf-8' }
    ) as any
    onProgress('正在建立记忆層目錄...', 80)
    ensureHermesDir()

    onProgress('Hermes Agent 安裝完成', 100)
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
}

function getProviderEnv(providerId: string, apiKey: string): Record<string, string> {
  const env: Record<string, string> = {}

  switch (providerId) {
    case 'ollama':
      env['OLLAMA_BASE_URL'] = 'http://localhost:11434'
      break
    case 'openrouter':
      env['OPENROUTER_API_KEY'] = apiKey
      env['OPENAI_BASE_URL'] = 'https://openrouter.ai/api/v1'
      break
    case 'anthropic':
      env['ANTHROPIC_API_KEY'] = apiKey
      break
    case 'openai':
      env['OPENAI_API_KEY'] = apiKey
      break
  }

  return env
}

export function startHermes(
  config: HermesConfig,
  onLog?: (line: string) => void
): ChildProcess | null {
  try {
    const env = {
      ...process.env,
      HERMES_MODEL: config.modelId,
      ...getProviderEnv(config.providerId, config.apiKey),
    }

    const proc = spawn('hermes', [], {
      cwd: HERMES_DIR,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    })

    const memoryPrompt = `AgentOS Memory Layer is at: ${HERMES_MEMORY}\n\nBefore each session, read user_profile.md and brand_voice.md from this directory.`
    proc.stdin?.write(memoryPrompt + '\n')

    if (onLog) {
      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) onLog(line)
      })
      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) onLog(line)
      })
    }

    return proc
  } catch {
    return null
  }
}
