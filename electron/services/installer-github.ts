import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { net } from 'electron'

// ---------------------------------------------------------------------------
// GitHub Installer Service
// ---------------------------------------------------------------------------

export interface RepoAnalysis {
  name: string
  description: string
  stack: 'node' | 'python' | 'unknown'
  installCommands: string[]
}

export interface InstallResult {
  success: boolean
  path: string
  error?: string
}

/**
 * Parse a GitHub URL into owner/repo components.
 * Supports: https://github.com/owner/repo or https://github.com/owner/repo.git
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.#]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

/**
 * Fetch text from a URL using Electron's net module (bypasses CORS).
 */
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    request.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const status = response.statusCode
        if (status && status >= 200 && status < 300) {
          resolve(Buffer.concat(chunks).toString('utf-8'))
        } else {
          reject(new Error(`HTTP ${status}`))
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

/**
 * Detect tech stack from repo file listing.
 */
function detectStack(files: string[]): RepoAnalysis['stack'] {
  if (files.includes('package.json')) return 'node'
  if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) return 'python'
  return 'unknown'
}

/**
 * Analyze a GitHub repo: fetch README and detect tech stack.
 */
export async function analyzeRepo(url: string): Promise<RepoAnalysis> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) throw new Error('無效的 GitHub URL')

  const { owner, repo } = parsed

  // 1. Fetch repo metadata from GitHub API
  let repoInfo: { description?: string; default_branch?: string } = {}
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
    const apiText = await fetchText(apiUrl)
    repoInfo = JSON.parse(apiText)
  } catch {
    // Continue even if API fails — we can still try to detect from README
  }

  const description = repoInfo.description || ''

  // 2. Fetch README (try main, then master)
  let readme = ''
  for (const branch of ['main', 'master']) {
    try {
      readme = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`)
      break
    } catch { /* try next branch */ }
  }

  // 3. Detect tech stack from README content and common file indicators
  const readmeLower = (readme || '').toLowerCase()
  let stack: RepoAnalysis['stack'] = 'unknown'

  // Heuristic: look for common indicators in README
  if (readmeLower.includes('npm install') || readmeLower.includes('yarn') || readmeLower.includes('node.js') || readmeLower.includes('node_modules')) {
    stack = 'node'
  } else if (readmeLower.includes('pip install') || readmeLower.includes('requirements.txt') || readmeLower.includes('python')) {
    stack = 'python'
  }

  // 4. Build install commands
  const installCommands: string[] = []
  if (stack === 'node') {
    installCommands.push('npm install')
  } else if (stack === 'python') {
    installCommands.push('pip install -r requirements.txt')
  }

  return { name: repo, description, stack, installCommands }
}

/**
 * Spawn a child process and return a promise that resolves/rejects on exit.
 */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'pipe', shell: true })
    proc.stdout?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(line => onLog(line))
    })
    proc.stderr?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(line => onLog(line))
    })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`指令 "${cmd} ${args.join(' ')}" 退出碼 ${code}`))
    })
    proc.on('error', reject)
  })
}

/**
 * Install a GitHub repo: clone, detect stack, and run install commands.
 */
export async function installRepo(
  url: string,
  onLog: (line: string) => void,
): Promise<InstallResult> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) return { success: false, path: '', error: '無效的 GitHub URL' }

  const { owner, repo } = parsed
  const agentsDir = path.join(os.homedir(), 'AgentOS', 'agents')
  const targetDir = path.join(agentsDir, repo)

  // Ensure agents directory exists
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true })
  }

  // If target exists, remove it first
  if (fs.existsSync(targetDir)) {
    onLog(`⚠️ 目標目錄已存在，移除中: ${targetDir}`)
    fs.rmSync(targetDir, { recursive: true, force: true })
  }

  try {
    // Step 1: git clone
    onLog(`📥 正在 clone ${owner}/${repo}...`)
    const cloneUrl = `https://github.com/${owner}/${repo}.git`
    await runCommand('git', ['clone', '--depth', '1', cloneUrl, targetDir], agentsDir, onLog)
    onLog(`✅ Clone 完成: ${targetDir}`)

    // Step 2: Detect stack and install
    const files = fs.readdirSync(targetDir)
    const stack = detectStack(files)

    if (stack === 'node') {
      if (files.includes('package.json')) {
        onLog('📦 偵測到 Node.js 專案，執行 npm install...')
        await runCommand('npm', ['install'], targetDir, onLog)
        onLog('✅ npm install 完成')
      }
    } else if (stack === 'python') {
      if (files.includes('requirements.txt')) {
        onLog('🐍 偵測到 Python 專案，執行 pip install...')
        await runCommand('pip', ['install', '-r', 'requirements.txt'], targetDir, onLog)
        onLog('✅ pip install 完成')
      } else if (files.includes('setup.py')) {
        onLog('🐍 偵測到 Python 專案，執行 python setup.py install...')
        await runCommand('python', ['setup.py', 'install'], targetDir, onLog)
        onLog('✅ setup.py install 完成')
      }
    } else {
      onLog('ℹ️ 未偵測到已知技術棧，略過安裝步驟')
    }

    onLog(`🎉 安裝完成！路徑: ${targetDir}`)
    return { success: true, path: targetDir }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    onLog(`❌ 安裝失敗: ${msg}`)
    // Clean up on failure
    if (fs.existsSync(targetDir)) {
      try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    return { success: false, path: targetDir, error: msg }
  }
}
