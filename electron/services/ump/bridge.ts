import path from 'path'
import fs from 'fs'
import { UniversalMemory } from './schemas'
import { AgentOSAdapter } from './adapters'
import { MemoryHub } from './hub'
import { MemoryExchange, AgentInfo } from './exchange'

export interface BridgeStatus {
  agentos_root: string
  memory_dir: string
  memory_dir_exists: boolean
  registry_exists: boolean
  connected: boolean
  hub_memories: number
  hub_adapters: string[]
  exchange_agents: number
}

export interface SyncResult {
  memories_imported: number
  agents_registered: number
  hub_stats: Record<string, unknown>
  exchange_stats: Record<string, unknown>
  synced_at: string
}

export class AgentOSBridge {
  private agentosRoot: string
  private memoryDir: string
  private agentsDir: string
  private registryPath: string
  private adapter: AgentOSAdapter
  readonly hub: MemoryHub
  readonly exchange: MemoryExchange
  private connected = false

  constructor(agentosRoot: string, hub?: MemoryHub, exchange?: MemoryExchange) {
    this.agentosRoot = agentosRoot
    this.memoryDir = path.join(agentosRoot, 'Memory')
    this.agentsDir = path.join(agentosRoot, 'agents')
    this.registryPath = path.join(agentosRoot, 'agents-registry.json')
    this.adapter = new AgentOSAdapter()
    this.hub = hub || new MemoryHub()
    this.exchange = exchange || new MemoryExchange()
  }

  async connect(): Promise<boolean> {
    if (!fs.existsSync(this.agentosRoot)) throw new Error(`AgentOS root not found: ${this.agentosRoot}`)
    for (const sub of ['', 'projects', 'conversations', 'outputs']) {
      const d = sub ? path.join(this.memoryDir, sub) : this.memoryDir
      fs.mkdirSync(d, { recursive: true })
    }
    await this.hub.initialize()
    this.connected = true
    return true
  }

  async importAllMemories(): Promise<number> {
    if (!this.connected) await this.connect()
    const memories = this.adapter.importDirectory(this.memoryDir)
    let count = 0
    for (const mem of memories) { this.hub.addMemory(mem); count++ }
    return count
  }

  async exportAllMemories(): Promise<string[]> {
    if (!this.connected) await this.connect()
    const allMemories = this.hub.getAll()
    const agentosMemories = allMemories.filter(m =>
      m.provenance.original_format === 'agentos_markdown' || m.provenance.source === 'agentos' || m.metadata.file_path
    )
    return this.adapter.exportToFiles(agentosMemories, this.memoryDir)
  }

  importFile(filePath: string): UniversalMemory | null {
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    const rel = path.relative(this.memoryDir, filePath)
    const fileType = this.resolveTypeFromPath(rel)
    const modified = fs.statSync(filePath).mtime.toISOString()
    const mem = this.adapter.parseFile(filePath, content, fileType, modified)
    this.hub.addMemory(mem)
    return mem
  }

  exportFile(memoryId: string): string | null {
    const memory = this.hub.getMemory(memoryId)
    if (!memory) return null
    const exported = this.adapter.exportMemory(memory)
    let filePath = exported.path
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(this.memoryDir, filePath)
    }
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, exported.content, 'utf-8')
    return filePath
  }

  loadRegistry(): Record<string, unknown>[] {
    if (!fs.existsSync(this.registryPath)) return []
    try { return JSON.parse(fs.readFileSync(this.registryPath, 'utf-8')).agents || [] } catch { return [] }
  }

  registerAgents(): number {
    const agents = this.loadRegistry()
    let count = 0
    for (const a of agents) {
      const agentId = a.id as string
      if (!agentId || this.exchange.getAgent(agentId)) continue
      this.exchange.registerAgent(agentId, (a.name as string) || agentId, (a.description as string) || '')
      count++
    }
    return count
  }

  async registerAgentWithMemory(agentId: string): Promise<boolean> {
    const manifestPath = path.join(this.agentsDir, agentId, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return false
    let manifest: Record<string, unknown>
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) } catch { return false }

    const name = (manifest.name as string) || agentId
    const description = (manifest.description as string) || ''
    await this.exchange.registerAgent(agentId, name, description)

    const content = JSON.stringify(manifest, null, 2)
    const modified = fs.statSync(manifestPath).mtime.toISOString()
    const mem = this.adapter.parseFile(manifestPath, content, 'projects', modified)
    mem.group_id = agentId
    mem.tags.push(`agent:${agentId}`)

    const hub = this.exchange.getHub(agentId)
    if (hub) hub.addMemory(mem)
    return true
  }

  async fullSync(): Promise<SyncResult> {
    if (!this.connected) await this.connect()
    const memoriesImported = await this.importAllMemories()
    const agentsRegistered = this.registerAgents()
    return {
      memories_imported: memoriesImported,
      agents_registered: agentsRegistered,
      hub_stats: this.hub.getStatistics(),
      exchange_stats: this.exchange.getStatistics(),
      synced_at: new Date().toISOString(),
    }
  }

  status(): BridgeStatus {
    return {
      agentos_root: this.agentosRoot,
      memory_dir: this.memoryDir,
      memory_dir_exists: fs.existsSync(this.memoryDir),
      registry_exists: fs.existsSync(this.registryPath),
      connected: this.connected,
      hub_memories: this.hub.count(),
      hub_adapters: this.hub.listAdapters(),
      exchange_agents: this.exchange.listAgents().length,
    }
  }

  private resolveTypeFromPath(relPath: string): string {
    const parts = relPath.split(/[/\\]/)
    if (parts.length > 1 && ['projects', 'conversations', 'outputs'].includes(parts[0])) return parts[0]
    const name = path.basename(relPath, path.extname(relPath)).toLowerCase()
    if (name.includes('profile')) return 'user_profile'
    if (name.includes('brand')) return 'brand_voice'
    return 'profile'
  }
}
