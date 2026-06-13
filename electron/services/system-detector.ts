import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import http from 'http'
import { statSync } from 'fs'

export interface SystemAgent {
  id: string
  name: string
  source: 'ollama' | 'pip' | 'npm' | 'path' | 'docker' | 'directory' | 'standalone'
  version: string
  description: string
  installed: boolean
  running: boolean
  details: Record<string, unknown>
}

// Known standalone AI agents to detect (with health check config)
const KNOWN_STANDALONE_AGENTS = [
  {
    id: 'hermes',
    name: 'Hermes Agent',
    description: 'AI Agent 管理平台核心 — 任務委派、工具調用、記憶管理',
    configPaths: ['.hermes', '.local/state/hermes'],
    dataPaths: ['.hermes/memory'],
    icon: '⚡',
    healthCheck: { type: 'http' as const, url: 'http://127.0.0.1:8642/health', timeout: 2000 },
    ports: [8642],
    processNames: ['hermes-agent', 'hermes', 'python3', 'python'],
    configPath: '~/.hermes',
  },
  {
    id: 'openhuman',
    name: 'OpenHuman',
    description: '人類級 AI 助理平台 — 個人化記憶、情感分析、長期陪伴',
    configPaths: ['.openhuman', 'OpenHuman'],
    dataPaths: ['.openhuman/users', '.openhuman/cache'],
    icon: '🧑',
    healthCheck: { type: 'http' as const, url: 'http://localhost:8080/health', timeout: 2000 },
    ports: [8080, 8081, 5000],
    processNames: ['openhuman', 'open-human', 'python3', 'python', 'node'],
    configPath: '~/.openhuman',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'AI 程式碼助理 — 程式碼生成、重構、除錯、文件撰寫',
    configPaths: ['.config/opencode', '.local/share/opencode', '.cache/opencode'],
    dataPaths: ['.local/share/opencode', '.local/state/opencode'],
    icon: '💻',
    healthCheck: { type: 'http' as const, url: 'http://localhost:4999/health', timeout: 2000 },
    ports: [4999, 4000, 4001],
    processNames: ['opencode', 'open-code', 'node'],
    configPath: '~/.config/opencode',
  },
]

// Known AI agent packages to detect
const KNOWN_AI_PACKAGES = [
  'openai', 'anthropic', 'cohere', 'transformers', 'langchain',
  'llamaindex', 'autogpt', 'crewai', 'autogen', 'semantic-kernel',
  'ollama', 'lmstudio', 'gpt4all', 'llamacpp', 'vllm',
  'privategpt', 'localai', 'text-generation-webui', 'kobold',
  'oobabooga', 'chatglm', 'qwen', 'baichuan', 'moss',
]

const KNOWN_AI_NPM = [
  'openai', 'anthropic', 'langchain', 'llamaindex', 'ai',
  'ollama', 'gpt4all-node', 'node-llama-cpp',
]

const SKIP_DIRS = ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build']

// 獨立 Agent 進程名稱定義（精確比對用）
const AGENT_PROCESS_NAMES: Record<string, string[]> = {
  hermes: ['hermes-agent.exe', 'hermes.exe', 'hermes'],
  openhuman: ['OpenHuman.exe', 'openhuman.exe'],
  opencode: ['OpenCode.exe', 'opencode.exe'],
}

export class SystemDetector {
  private agentsDir: string

  constructor(agentosRoot: string) {
    this.agentsDir = path.join(agentosRoot, 'agents')
  }

  // ---- 三層偵測方法 ----

  // 第一層：HTTP healthcheck（最準確）
  private async checkHealthEndpoint(healthCheck: { type: string; url?: string; timeout?: number }): Promise<boolean> {
    if (healthCheck.type === 'none' || !healthCheck.url) return false
    if (healthCheck.type === 'http') {
      try {
        const res = await fetch(healthCheck.url, {
          signal: AbortSignal.timeout(healthCheck.timeout ?? 2000)
        })
        return res.ok
      } catch { return false }
    }
    return false
  }

  // 第二層-A：進程名稱精確比對（OpenCode/OpenHuman 用這層就夠）
  private detectByProcessName(agentId: string): boolean {
    const targets = AGENT_PROCESS_NAMES[agentId]
    if (!targets || targets.length === 0) return false

    try {
      const result = execSync(
        'tasklist /FO CSV /NH',
        { encoding: 'utf-8', timeout: 3000, windowsHide: true }
      )
      // 取得所有進程名稱（小寫）
      const running = result.split('\n').map(line =>
        line.split(',')[0].replace(/"/g, '').trim().toLowerCase()
      )

      // 比對：目標名稱是否在進程列表中
      return targets.some(t => running.includes(t.toLowerCase()))
    } catch {
      return false
    }
  }

  // 第二層-B：Port 占用 + PID 比對進程名稱
  private checkPortAndProcess(ports: number[], processNames: string[]): { running: boolean; pid?: number } {
    for (const port of ports) {
      try {
        const result = execSync(
          `netstat -ano | findstr ":${port} "`,
          { encoding: 'utf-8', timeout: 3000, windowsHide: true }
        )
        const lines = result.trim().split('\n').filter(Boolean)
        for (const line of lines) {
          if (!line.includes('LISTENING')) continue
          const parts = line.trim().split(/\s+/)
          const pid = parseInt(parts[parts.length - 1] || '0')
          if (!pid) continue

          // 用 PID 查進程名稱
          try {
            const nameResult = execSync(
              `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
              { encoding: 'utf-8', timeout: 3000, windowsHide: true }
            )
            const procName = nameResult.split(',')[0].replace(/"/g, '').toLowerCase()

            // 比對進程名稱
            if (processNames.some(n => procName.includes(n.toLowerCase()))) {
              return { running: true, pid }
            }
          } catch { /* tasklist 失敗，跳過 */ }
        }
      } catch { /* netstat 失敗，跳過 */ }
    }
    return { running: false }
  }

  // 第三層：Config 目錄最後修改時間
  private checkConfigActivity(configPath: string): 'active' | 'inactive' | 'unknown' {
    try {
      const fullPath = configPath.startsWith('~')
        ? path.join(os.homedir(), configPath.slice(1))
        : configPath
      const stat = statSync(fullPath)
      const minutesAgo = (Date.now() - stat.mtimeMs) / 1000 / 60
      // 5分鐘內有修改過 = 活躍
      return minutesAgo < 5 ? 'active' : 'inactive'
    } catch {
      return 'unknown'
    }
  }

  // 整合三層偵測
  private async detectStatus(
    agentId: string,
    healthCheck: { type: string; url?: string; timeout?: number },
    ports: number[],
    processNames: string[],
    configPath?: string
  ): Promise<boolean> {
    // 第一層：HTTP healthcheck（Hermes 用）
    const healthy = await this.checkHealthEndpoint(healthCheck)
    if (healthy) return true

    // 第二層-A：進程名稱精確比對（OpenCode/OpenHuman 用這層就夠）
    const procMatch = this.detectByProcessName(agentId)
    if (procMatch) return true

    // 第二層-B：Port + PID 比對（輔助驗證）
    const portCheck = this.checkPortAndProcess(ports, processNames)
    if (portCheck.running) return true

    // 第三層：Config 活躍度
    if (configPath) {
      const activity = this.checkConfigActivity(configPath)
      if (activity === 'active') return true
    }

    return false
  }

  async detectAll(): Promise<SystemAgent[]> {
    const results: SystemAgent[] = []

    // Detect in parallel
    const [ollamaModels, pipPackages, npmGlobal, pathExecs, dockerContainers, localAgents, standaloneAgents] = await Promise.all([
      this.scanOllamaModels(),
      this.scanPythonPackages(),
      this.scanNpmGlobalPackages(),
      this.scanPathExecutables(),
      this.scanDockerContainers(),
      this.scanLocalAgents(),
      this.scanStandaloneAgents(),
    ])

    results.push(...ollamaModels)
    results.push(...pipPackages)
    results.push(...npmGlobal)
    results.push(...pathExecs)
    results.push(...dockerContainers)
    results.push(...localAgents)
    results.push(...standaloneAgents)

    return results
  }

  private async scanOllamaModels(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    try {
      const output = execSync('ollama list 2>nul', { encoding: 'utf-8', timeout: 10000, windowsHide: true })
      const lines = output.trim().split('\n').slice(1) // Skip header
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3) {
          const name = parts[0]
          const size = parts[2] ? `${parts[2]} ${parts[3] || ''}`.trim() : ''
          agents.push({
            id: `ollama:${name}`,
            name,
            source: 'ollama',
            version: parts[1] || '',
            description: `Ollama model (${size})`,
            installed: true,
            running: false,
            details: { size, raw: line.trim() },
          })
        }
      }
    } catch {
      // Ollama not installed or not running
    }

    // Check if Ollama is running
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get('http://localhost:11434/api/tags', { timeout: 3000 }, (res) => {
          let data = ''
          res.on('data', (chunk) => data += chunk)
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)
              if (parsed.models) {
                for (const agent of agents) {
                  const found = parsed.models.find((m: { name: string }) => m.name === agent.name)
                  if (found) agent.running = true
                }
              }
            } catch { /* ignore */ }
            resolve()
          })
        })
        req.on('error', () => resolve()) // Don't fail, just mark as not running
        req.on('timeout', () => { req.destroy(); resolve() })
      })
    } catch { /* ignore */ }

    return agents
  }

  private async scanPythonPackages(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    try {
      const output = execSync('pip list --format=json 2>nul || pip3 list --format=json 2>nul', {
        encoding: 'utf-8', timeout: 15000, windowsHide: true,
      })
      const packages: Array<{ name: string; version: string }> = JSON.parse(output)
      for (const pkg of packages) {
        const lower = pkg.name.toLowerCase()
        if (KNOWN_AI_PACKAGES.some(k => lower.includes(k))) {
          agents.push({
            id: `pip:${pkg.name}`,
            name: pkg.name,
            source: 'pip',
            version: pkg.version,
            description: `Python AI package`,
            installed: true,
            running: false,
            details: { type: 'python_package' },
          })
        }
      }
    } catch { /* pip not available */ }
    return agents
  }

  private async scanNpmGlobalPackages(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    try {
      const output = execSync('npm list -g --json 2>nul', { encoding: 'utf-8', timeout: 15000, windowsHide: true })
      const parsed = JSON.parse(output)
      const deps = parsed.dependencies || {}
      for (const [name, info] of Object.entries(deps) as Array<[string, { version?: string }]>) {
        const lower = name.toLowerCase()
        if (KNOWN_AI_NPM.some(k => lower.includes(k))) {
          agents.push({
            id: `npm:${name}`,
            name,
            source: 'npm',
            version: info.version || '',
            description: `Node.js AI package`,
            installed: true,
            running: false,
            details: { type: 'npm_package' },
          })
        }
      }
    } catch { /* npm not available */ }
    return agents
  }

  private async scanPathExecutables(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    const aiExecutables = [
      'ollama', 'lmstudio', 'gpt4all', 'llama.cpp', 'llamacpp',
      'localai', 'privategpt', 'text-generation-webui', 'kobold',
      'openai', 'anthropic', 'langchain',
    ]

    const pathDirs = (process.env.PATH || '').split(path.delimiter)
    const seen = new Set<string>()

    for (const dir of pathDirs) {
      if (!fs.existsSync(dir)) continue
      try {
        for (const file of fs.readdirSync(dir)) {
          const base = file.replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase()
          if (aiExecutables.includes(base) && !seen.has(base)) {
            seen.add(base)
            agents.push({
              id: `path:${base}`,
              name: base,
              source: 'path',
              version: '',
              description: `Found in PATH: ${dir}`,
              installed: true,
              running: false,
              details: { path: path.join(dir, file) },
            })
          }
        }
      } catch { /* ignore */ }
    }
    return agents
  }

  private async scanDockerContainers(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    try {
      const output = execSync('docker ps -a --format "{{.Names}}|{{.Image}}|{{.Status}}" 2>nul', {
        encoding: 'utf-8', timeout: 10000, windowsHide: true,
      })
      const lines = output.trim().split('\n').filter(Boolean)
      const aiImages = ['ollama', 'openai', 'localai', 'text-generation', 'kobold', 'llama']
      for (const line of lines) {
        const [name, image, status] = line.split('|')
        if (aiImages.some(ai => (image || '').toLowerCase().includes(ai))) {
          agents.push({
            id: `docker:${name}`,
            name,
            source: 'docker',
            version: '',
            description: `Docker: ${image}`,
            installed: true,
            running: (status || '').startsWith('Up'),
            details: { image, status },
          })
        }
      }
    } catch { /* docker not available */ }
    return agents
  }

  private scanLocalAgents(): SystemAgent[] {
    const agents: SystemAgent[] = []
    if (!fs.existsSync(this.agentsDir)) return agents

    for (const entry of fs.readdirSync(this.agentsDir)) {
      const agentDir = path.join(this.agentsDir, entry)
      if (!fs.statSync(agentDir).isDirectory()) continue
      const manifestPath = path.join(agentDir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) continue

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        agents.push({
          id: `local:${manifest.id || entry}`,
          name: manifest.name || entry,
          source: 'directory',
          version: manifest.version || '',
          description: manifest.description || '',
          installed: true,
          running: false,
          details: { manifest, dir: agentDir },
        })
      } catch { /* ignore */ }
    }
    return agents
  }

  private async scanStandaloneAgents(): Promise<SystemAgent[]> {
    const agents: SystemAgent[] = []
    const home = os.homedir()

    for (const agentDef of KNOWN_STANDALONE_AGENTS) {
      const configDirs = agentDef.configPaths.map(p => path.join(home, p))
      const dataDirs = agentDef.dataPaths.map(p => path.join(home, p))

      const foundConfigDirs = configDirs.filter(d => fs.existsSync(d))
      const foundDataDirs = dataDirs.filter(d => fs.existsSync(d))

      if (foundConfigDirs.length === 0 && foundDataDirs.length === 0) continue

      // Try to read version from config files
      let version = ''
      let configInfo: Record<string, unknown> = {}

      for (const configDir of foundConfigDirs) {
        try {
          // Check for config.yaml
          const yamlPath = path.join(configDir, 'config.yaml')
          if (fs.existsSync(yamlPath)) {
            const content = fs.readFileSync(yamlPath, 'utf-8')
            const versionMatch = content.match(/version:\s*["']?([^\s"']+)/)
            if (versionMatch) version = versionMatch[1]
            configInfo.configFile = yamlPath
          }

          // Check for opencode.jsonc
          const jsoncPath = path.join(configDir, 'opencode.jsonc')
          if (fs.existsSync(jsoncPath)) {
            const content = fs.readFileSync(jsoncPath, 'utf-8')
            // Remove comments for JSON parsing
            const clean = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
            try {
              const parsed = JSON.parse(clean)
              if (parsed.version) version = parsed.version
            } catch { /* ignore */ }
            configInfo.configFile = jsoncPath
          }

          // Check for active_user.toml
          const tomlPath = path.join(configDir, 'active_user.toml')
          if (fs.existsSync(tomlPath)) {
            configInfo.activeUserConfig = tomlPath
          }
        } catch { /* ignore */ }
      }

      // Check for data directories
      let dataDirSize = 0
      let fileCount = 0
      for (const dataDir of foundDataDirs) {
        try {
          const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir)) {
              const fullPath = path.join(dir, entry)
              const stat = fs.statSync(fullPath)
              if (stat.isDirectory()) {
                walk(fullPath)
              } else {
                dataDirSize += stat.size
                fileCount++
              }
            }
          }
          walk(dataDir)
        } catch { /* ignore */ }
      }

      // 三層偵測運行狀態
      const isRunning = await this.detectStatus(
        agentDef.id,
        agentDef.healthCheck,
        agentDef.ports,
        agentDef.processNames,
        agentDef.configPath
      )

      agents.push({
        id: `standalone:${agentDef.id}`,
        name: agentDef.name,
        source: 'standalone',
        version,
        description: agentDef.description,
        installed: true,
        running: isRunning,
        details: {
          configDirs: foundConfigDirs,
          dataDirs: foundDataDirs,
          dataDirSize,
          fileCount,
          icon: agentDef.icon,
          healthCheck: agentDef.healthCheck,
          ports: agentDef.ports,
          processNames: agentDef.processNames,
          configPath: agentDef.configPath,
          ...configInfo,
        },
      })
    }

    return agents
  }

  // Scan for any directory that looks like it contains an AI agent
  scanDirectories(directories: string[]): SystemAgent[] {
    const agents: SystemAgent[] = []
    for (const dir of directories) {
      if (!fs.existsSync(dir)) continue
      try {
        for (const entry of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, entry)
          if (!fs.statSync(fullPath).isDirectory()) continue
          if (SKIP_DIRS.includes(entry)) continue

          // Check for common AI agent indicators
          const indicators = [
            'manifest.json', 'package.json', 'requirements.txt',
            'pyproject.toml', 'setup.py', 'Cargo.toml',
          ]
          const hasIndicator = indicators.some(f => fs.existsSync(path.join(fullPath, f)))
          if (!hasIndicator) continue

          // Try to read manifest/package info
          let name = entry
          let version = ''
          let description = ''

          const manifestPath = path.join(fullPath, 'manifest.json')
          const pkgPath = path.join(fullPath, 'package.json')
          const pyprojectPath = path.join(fullPath, 'pyproject.toml')

          if (fs.existsSync(manifestPath)) {
            const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            name = m.name || entry
            version = m.version || ''
            description = m.description || ''
          } else if (fs.existsSync(pkgPath)) {
            const p = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
            name = p.name || entry
            version = p.version || ''
            description = p.description || ''
          } else if (fs.existsSync(pyprojectPath)) {
            const content = fs.readFileSync(pyprojectPath, 'utf-8')
            const nameMatch = content.match(/^name\s*=\s*["'](.+?)["']/m)
            const versionMatch = content.match(/^version\s*=\s*["'](.+?)["']/m)
            if (nameMatch) name = nameMatch[1]
            if (versionMatch) version = versionMatch[1]
          }

          agents.push({
            id: `dir:${dir}:${entry}`,
            name,
            source: 'directory',
            version,
            description,
            installed: true,
            running: false,
            details: { path: fullPath },
          })
        }
      } catch { /* ignore */ }
    }
    return agents
  }
}
