import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { UniversalMemory, MemoryType, createMemory } from './schemas'
import { AgentOSAdapter } from './adapters'
import { MemoryHub } from './hub'

const SKIP_DIRS = ['node_modules', '__pycache__', '.git', 'dist', 'build', '.venv', 'venv']
const SKIP_FILES = ['manifest.json', 'package.json', 'tsconfig.json', 'config.json', 'settings.json']

export interface DiscoveredAgent {
  agent_id: string
  name: string
  description: string
  version: string
  author: string
  category: string
  tags: string[]
  icon: string
  manifest_path: string
  agent_dir: string
  data_dir: string
  is_registered: boolean
  has_data: boolean
  memory_files: string[]
  memory_file_count: number
}

export interface ConsolidationResult {
  agent_id: string
  memories_consolidated: number
  files_processed: number
  files_skipped: number
  errors: string[]
  warnings: string[]
  memories: UniversalMemory[]
}

export class AgentDiscovery {
  private agentosRoot: string
  private agentsDir: string
  private agentsDataDir: string
  private registryPath: string
  private adapter: AgentOSAdapter

  constructor(agentosRoot: string) {
    this.agentosRoot = agentosRoot
    this.agentsDir = path.join(agentosRoot, 'agents')
    this.agentsDataDir = path.join(agentosRoot, 'agents-data')
    this.registryPath = path.join(agentosRoot, 'agents-registry.json')
    this.adapter = new AgentOSAdapter()
  }

  scan(): DiscoveredAgent[] {
    if (!fs.existsSync(this.agentsDir)) return []
    const registryIds = this.loadRegistryIds()
    const discovered: DiscoveredAgent[] = []

    for (const entry of fs.readdirSync(this.agentsDir)) {
      const agentDir = path.join(this.agentsDir, entry)
      if (!fs.statSync(agentDir).isDirectory()) continue
      const manifestPath = path.join(agentDir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) continue

      let manifest: Record<string, unknown>
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) } catch { continue }

      const agentId = (manifest.id as string) || entry
      const dataDir = path.join(this.agentsDataDir, agentId)
      const hasData = fs.existsSync(dataDir)
      const memoryFiles = this.scanMemoryFiles(agentDir, dataDir)

      discovered.push({
        agent_id: agentId,
        name: (manifest.name as string) || agentId,
        description: (manifest.description as string) || '',
        version: (manifest.version as string) || '',
        author: (manifest.author as string) || '',
        category: (manifest.category as string) || '',
        tags: (manifest.tags as string[]) || [],
        icon: (manifest.icon as string) || '',
        manifest_path: manifestPath,
        agent_dir: agentDir,
        data_dir: dataDir,
        is_registered: registryIds.includes(agentId),
        has_data: hasData,
        memory_files: memoryFiles,
        memory_file_count: memoryFiles.length,
      })
    }
    return discovered
  }

  getUnregistered(): DiscoveredAgent[] { return this.scan().filter(a => !a.is_registered) }
  getRegistered(): DiscoveredAgent[] { return this.scan().filter(a => a.is_registered) }
  getWithMemory(): DiscoveredAgent[] { return this.scan().filter(a => a.memory_files.length > 0) }

  registerAgent(agentId: string): boolean {
    const agents = this.loadRegistry()
    if (agents.some(a => a.id === agentId)) return false

    const manifestPath = path.join(this.agentsDir, agentId, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return false
    let manifest: Record<string, unknown>
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) } catch { return false }

    agents.push({
      id: agentId,
      name: manifest.name || agentId,
      author: manifest.author || 'Unknown',
      description: manifest.description || '',
      repoUrl: manifest.repoUrl || '',
      category: manifest.category || 'other',
      tags: manifest.tags || [],
      price: manifest.price || 'free',
      featured: manifest.featured || false,
      _auto_discovered: true,
      _registered_at: new Date().toISOString(),
    })
    this.saveRegistry(agents)
    return true
  }

  registerAllUnregistered(): string[] {
    return this.getUnregistered().filter(a => this.registerAgent(a.agent_id)).map(a => a.agent_id)
  }

  registerAgents(agentIds: string[]): Record<string, boolean> {
    const results: Record<string, boolean> = {}
    for (const id of agentIds) {
      results[id] = this.registerAgent(id)
    }
    return results
  }

  consolidateMemories(agentId: string, hub: MemoryHub): ConsolidationResult {
    const result: ConsolidationResult = { agent_id: agentId, memories_consolidated: 0, files_processed: 0, files_skipped: 0, errors: [], warnings: [], memories: [] }
    const agentDir = path.join(this.agentsDir, agentId)
    const dataDir = path.join(this.agentsDataDir, agentId)
    const memoryFiles = this.scanMemoryFiles(agentDir, dataDir)
    result.files_processed = memoryFiles.length

    for (const filePath of memoryFiles) {
      try {
        const memories = this.parseMemoryFile(filePath, agentId)
        for (const mem of memories) {
          hub.addMemory(mem)
          result.memories.push(mem)
          result.memories_consolidated++
        }
      } catch (e) {
        result.errors.push(`Error processing ${filePath}: ${String(e)}`)
        result.files_skipped++
      }
    }
    return result
  }

  consolidateAll(hub: MemoryHub): ConsolidationResult[] {
    return this.scan().filter(a => a.memory_files.length > 0).map(a => this.consolidateMemories(a.agent_id, hub))
  }

  private scanMemoryFiles(agentDir: string, dataDir: string): string[] {
    const files = new Set<string>()
    const dirsToScan = [agentDir, dataDir].filter(d => fs.existsSync(d))

    for (const scanDir of dirsToScan) {
      this.walkDir(scanDir, files)
    }
    return Array.from(files).sort()
  }

  private walkDir(dir: string, files: Set<string>): void {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        if (SKIP_DIRS.includes(entry)) continue
        this.walkDir(fullPath, files)
      } else {
        if (SKIP_FILES.includes(entry)) continue
        const ext = path.extname(entry).toLowerCase()
        if (['.json', '.yaml', '.yml', '.md', '.txt', '.db', '.sqlite', '.sqlite3'].includes(ext)) {
          if (stat.size <= 10 * 1024 * 1024) files.add(fullPath)
        }
      }
    }
  }

  private parseMemoryFile(filePath: string, agentId: string): UniversalMemory[] {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.json') return this.parseJsonMemory(filePath, agentId)
    if (ext === '.md') return this.parseMarkdownMemory(filePath, agentId)
    if (ext === '.txt') return this.parseTextMemory(filePath, agentId)
    if (['.yaml', '.yml'].includes(ext)) return this.parseTextMemory(filePath, agentId)
    return []
  }

  private parseJsonMemory(filePath: string, agentId: string): UniversalMemory[] {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (Array.isArray(data)) {
        return data.filter((item: unknown) => typeof item === 'object' && item !== null && 'content' in item)
          .map((item: Record<string, unknown>) => this.dictToMemory(item, agentId, filePath))
      }
      if (typeof data === 'object' && data !== null) {
        if ('content' in data || 'memory' in data) {
          if ('memory' in data && !('content' in data)) data.content = data.memory
          return [this.dictToMemory(data as Record<string, unknown>, agentId, filePath)]
        }
        if ('memories' in data && Array.isArray(data.memories)) {
          return (data.memories as Record<string, unknown>[]).map(item => this.dictToMemory(item, agentId, filePath))
        }
        return [this.createMemory({ content: JSON.stringify(data, null, 2), agentId, filePath, memoryType: 'semantic' })]
      }
    } catch { /* ignore parse errors */ }
    return []
  }

  private parseMarkdownMemory(filePath: string, agentId: string): UniversalMemory[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const p = filePath.toLowerCase()
      let memType = 'profile'
      if (p.includes('conversation')) memType = 'conversations'
      else if (p.includes('project')) memType = 'projects'
      else if (p.includes('output')) memType = 'outputs'
      else if (p.includes('profile')) memType = 'user_profile'
      else if (p.includes('brand')) memType = 'brand_voice'
      const modified = fs.statSync(filePath).mtime.toISOString()
      return [this.adapter.importMemory({ path: filePath, content, type: memType, modified })]
    } catch { return [] }
  }

  private parseTextMemory(filePath: string, agentId: string): UniversalMemory[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (!content.trim()) return []
      return [this.createMemory({ content, agentId, filePath, memoryType: 'semantic' })]
    } catch { return [] }
  }

  private dictToMemory(data: Record<string, unknown>, agentId: string, filePath: string): UniversalMemory {
    const content = (data.content as string) || (data.memory as string) || JSON.stringify(data)
    const memType = (data.memory_type as string) || (data.type as string) || 'semantic'
    return this.createMemory({
      content, agentId, filePath,
      memoryType: ['semantic', 'episodic', 'procedural', 'graph'].includes(memType) ? memType as MemoryType : 'semantic',
      id: data.id as string | undefined,
      tags: data.tags as string[] | undefined,
      importance: data.importance as number | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    })
  }

  private createMemory(opts: {
    content: string; agentId: string; filePath: string; memoryType?: MemoryType;
    id?: string; tags?: string[]; importance?: number; metadata?: Record<string, unknown>
  }): UniversalMemory {
    const id = opts.id || `discovered_${crypto.createHash('sha256').update(`${opts.agentId}:${opts.filePath}`).digest('hex').slice(0, 12)}`
    return createMemory({
      id, content: opts.content, memory_type: opts.memoryType || 'semantic', group_id: opts.agentId,
      provenance: { source: 'agent_discovery', original_format: 'auto_detected', source_description: `Auto-detected from ${opts.filePath}`, agent_id: opts.agentId, confidence: 1.0, extracted_at: new Date().toISOString() },
      tags: opts.tags || [`agent:${opts.agentId}`, `source:${path.extname(opts.filePath)}`],
      importance: opts.importance ?? 0.5,
      metadata: { file_path: opts.filePath, discovered_at: new Date().toISOString(), ...(opts.metadata || {}) },
    })
  }

  discoverAndConsolidate(hub?: MemoryHub, exchange?: import('./exchange').MemoryExchange, autoRegister = false, consolidate = false): Record<string, unknown> {
    const allAgents = this.scan()
    const unregistered = allAgents.filter(a => !a.is_registered)
    const withMemory = allAgents.filter(a => a.memory_files.length > 0)

    const consolidationResults: Record<string, unknown>[] = []

    const report: Record<string, unknown> = {
      scan_result: {
        total_agents: allAgents.length,
        registered: allAgents.length - unregistered.length,
        unregistered: unregistered.length,
        with_memory: withMemory.length,
      },
      agents: allAgents,
      unregistered_agents: unregistered,
      agents_with_memory: withMemory,
      registration_result: null,
      consolidation_results: consolidationResults,
      prompt_consolidate: withMemory.length > 0,
      discovered_at: new Date().toISOString(),
    }

    if (autoRegister && unregistered.length > 0) {
      const registeredIds = unregistered.filter(a => this.registerAgent(a.agent_id)).map(a => a.agent_id)
      report.registration_result = { registered: registeredIds, count: registeredIds.length }
    }

    if (consolidate && hub) {
      for (const agent of allAgents) {
        if (agent.memory_files.length > 0) {
          const result = this.consolidateMemories(agent.agent_id, hub)
          consolidationResults.push(result as unknown as Record<string, unknown>)
        }
      }
    }

    if (exchange && allAgents.length > 0) {
      for (const agent of allAgents) {
        if (!exchange.getAgent(agent.agent_id)) {
          exchange.registerAgent(agent.agent_id, agent.name, agent.description)
        }
      }
    }

    return report
  }

  private loadRegistryIds(): string[] {
    return this.loadRegistry().map(a => a.id as string).filter(Boolean)
  }

  private loadRegistry(): Record<string, unknown>[] {
    if (!fs.existsSync(this.registryPath)) return []
    try {
      const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf-8'))
      return data.agents || []
    } catch { return [] }
  }

  private saveRegistry(agents: Record<string, unknown>[]): void {
    fs.writeFileSync(this.registryPath, JSON.stringify({
      version: '1.0.0', updatedAt: new Date().toISOString().split('T')[0], agents
    }, null, 2), 'utf-8')
  }
}
