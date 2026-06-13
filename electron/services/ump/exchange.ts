import { UniversalMemory, MemoryType } from './schemas'
import { MemoryHub } from './hub'

export type Permission = 'read' | 'write' | 'read_write' | 'admin'

export interface AgentInfo {
  agent_id: string
  name: string
  description: string
  permissions: Record<string, Permission>
  shared_memories: Set<string>
  created_at: string
}

export interface MemoryShareRequest {
  source_agent: string
  target_agent: string
  memory_id: string
  permission: Permission
  expires_at?: string
}

export interface MemoryShareRecord {
  source_agent: string
  target_agent: string
  memory_id: string
  permission: Permission
  shared_at: string
  expires_at?: string
}

export interface SyncRequest {
  agent_id: string
  last_sync_at?: string
  memory_types?: MemoryType[]
  group_id?: string
}

export interface SyncResponse {
  agent_id: string
  memories: UniversalMemory[]
  deleted_ids: string[]
  sync_at: string
}

export class MemoryExchange {
  private _agents: Map<string, AgentInfo> = new Map()
  private _hubs: Map<string, MemoryHub> = new Map()
  private _shareRecords: MemoryShareRecord[] = []
  private _syncHistory: Map<string, string> = new Map()

  async registerAgent(agentId: string, name: string, description = ''): Promise<AgentInfo> {
    const agent: AgentInfo = {
      agent_id: agentId, name, description,
      permissions: {}, shared_memories: new Set(),
      created_at: new Date().toISOString(),
    }
    this._agents.set(agentId, agent)
    const hub = new MemoryHub()
    await hub.initialize()
    this._hubs.set(agentId, hub)
    return agent
  }

  getAgent(agentId: string): AgentInfo | undefined { return this._agents.get(agentId) }
  listAgents(): AgentInfo[] { return Array.from(this._agents.values()) }
  getHub(agentId: string): MemoryHub | undefined { return this._hubs.get(agentId) }

  addMemory(agentId: string, memory: UniversalMemory): boolean {
    const hub = this._hubs.get(agentId)
    return hub ? hub.addMemory(memory) : false
  }

  getMemory(agentId: string, memoryId: string): UniversalMemory | undefined {
    const hub = this._hubs.get(agentId)
    return hub?.getMemory(memoryId)
  }

  shareMemory(sourceAgent: string, targetAgent: string, memoryId: string, permission: Permission = 'read'): boolean {
    const sourceHub = this._hubs.get(sourceAgent)
    const targetHub = this._hubs.get(targetAgent)
    if (!sourceHub || !targetHub) return false
    const memory = sourceHub.getMemory(memoryId)
    if (!memory) return false

    const sourceInfo = this._agents.get(sourceAgent)
    if (sourceInfo) {
      if (!sourceInfo.permissions[targetAgent]) sourceInfo.permissions[targetAgent] = 'read'
      sourceInfo.shared_memories.add(memoryId)
    }

    const targetInfo = this._agents.get(targetAgent)
    if (targetInfo) {
      targetInfo.permissions[sourceAgent] = permission
    }

    this._shareRecords.push({
      source_agent: sourceAgent, target_agent: targetAgent,
      memory_id: memoryId, permission, shared_at: new Date().toISOString(),
    })
    return targetHub.addMemory(memory)
  }

  shareMemoryWithRequest(request: MemoryShareRequest): boolean {
    return this.shareMemory(request.source_agent, request.target_agent, request.memory_id, request.permission)
  }

  revokeMemory(sourceAgent: string, targetAgent: string, memoryId: string): boolean {
    const targetHub = this._hubs.get(targetAgent)
    if (!targetHub) return false

    this._shareRecords = this._shareRecords.filter(r =>
      !(r.source_agent === sourceAgent && r.target_agent === targetAgent && r.memory_id === memoryId)
    )

    const sourceInfo = this._agents.get(sourceAgent)
    if (sourceInfo) sourceInfo.shared_memories.delete(memoryId)

    return targetHub.deleteMemory(memoryId)
  }

  getSharedMemories(sourceAgent: string, targetAgent: string): MemoryShareRecord[] {
    return this._shareRecords.filter(r => r.source_agent === sourceAgent && r.target_agent === targetAgent)
  }

  syncAgent(request: SyncRequest): SyncResponse {
    const hub = this._hubs.get(request.agent_id)
    if (!hub) return { agent_id: request.agent_id, memories: [], deleted_ids: [], sync_at: new Date().toISOString() }

    const memType = request.memory_types?.[0] || 'semantic' as MemoryType
    let memories = hub.getMemoriesByType(memType, 1000)

    if (request.group_id) {
      memories = memories.filter(m => m.group_id === request.group_id)
    }
    if (request.last_sync_at) {
      memories = memories.filter(m => m.temporal.created_at > request.last_sync_at!)
    }

    this._syncHistory.set(request.agent_id, new Date().toISOString())

    return {
      agent_id: request.agent_id,
      memories,
      deleted_ids: [],
      sync_at: new Date().toISOString(),
    }
  }

  batchAddMemories(agentId: string, memories: UniversalMemory[]): number {
    const hub = this._hubs.get(agentId)
    if (!hub) return 0
    let count = 0
    for (const m of memories) {
      if (hub.addMemory(m)) count++
    }
    return count
  }

  searchAcrossAgents(query: string, agentIds?: string[], memoryType?: MemoryType, limit = 10): Record<string, UniversalMemory[]> {
    const results: Record<string, UniversalMemory[]> = {}
    const toSearch = agentIds || Array.from(this._agents.keys())
    for (const agentId of toSearch) {
      const hub = this._hubs.get(agentId)
      if (!hub) continue
      const memories = hub.searchByContent(query, { memoryType, limit })
      if (memories.length > 0) results[agentId] = memories
    }
    return results
  }

  getStatistics(): Record<string, unknown> {
    let totalMemories = 0
    const agentStats: Record<string, { memories: number; shared_outgoing: number; shared_incoming: number }> = {}
    for (const [agentId, hub] of this._hubs) {
      const count = hub.count()
      agentStats[agentId] = {
        memories: count,
        shared_outgoing: this._shareRecords.filter(r => r.source_agent === agentId).length,
        shared_incoming: this._shareRecords.filter(r => r.target_agent === agentId).length,
      }
      totalMemories += count
    }
    return { total_agents: this._agents.size, total_memories: totalMemories, total_shares: this._shareRecords.length, agent_stats: agentStats }
  }

  clearAgent(agentId: string): boolean {
    const hub = this._hubs.get(agentId)
    if (!hub) return false
    hub.clear()
    return true
  }

  deleteAgent(agentId: string): boolean {
    if (!this._agents.has(agentId)) return false
    this._agents.delete(agentId)
    this._hubs.delete(agentId)
    this._shareRecords = this._shareRecords.filter(r => r.source_agent !== agentId && r.target_agent !== agentId)
    return true
  }
}
