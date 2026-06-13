import { useState, useEffect, useCallback } from 'react'

interface DiscoveredAgent {
  agent_id: string
  name: string
  description: string
  version: string
  author: string
  category: string
  tags: string[]
  icon: string
  is_registered: boolean
  has_data: boolean
  memory_file_count: number
  memory_files: string[]
}

interface BridgeStatus {
  agentos_root: string
  memory_dir: string
  memory_dir_exists: boolean
  registry_exists: boolean
  connected: boolean
  hub_memories: number
  exchange_agents: number
}

interface HubStats {
  total_memories: number
  by_type: Record<string, number>
  by_group: Record<string, number>
  top_tags: Record<string, number>
  avg_importance: number
}

interface MemoryItem {
  id: string
  content: string
  memory_type: string
  group_id: string
  tags: string[]
  importance: number
  metadata: Record<string, unknown>
}

interface TaskItem {
  id: string
  title: string
  content: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  source: string
  target: string
  result: string | null
  created_at: string
  updated_at: string
}

export default function UMPage() {
  const [tab, setTab] = useState<'discover' | 'sync' | 'search' | 'stats' | 'tasks'>('discover')
  const [agents, setAgents] = useState<DiscoveredAgent[]>([])
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)
  const [hubStats, setHubStats] = useState<HubStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemoryItem[]>([])
  const [allMemories, setAllMemories] = useState<MemoryItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadDiscover = useCallback(async () => {
    try {
      const list = await window.electronAPI.umpDiscoverScan() as DiscoveredAgent[]
      setAgents(list)
    } catch { /* ignore */ }
  }, [])

  const loadBridgeStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.umpBridgeStatus() as BridgeStatus
      setBridgeStatus(status)
    } catch { /* ignore */ }
  }, [])

  const loadHubStats = useCallback(async () => {
    try {
      const stats = await window.electronAPI.umpHubStats() as HubStats
      setHubStats(stats)
    } catch { /* ignore */ }
  }, [])

  const loadAllMemories = useCallback(async () => {
    try {
      const mems = await window.electronAPI.umpHubAll() as MemoryItem[]
      setAllMemories(mems)
    } catch { /* ignore */ }
  }, [])

  const loadTasks = useCallback(async () => {
    try {
      const taskList = await window.electronAPI.umpGetTasks() as TaskItem[]
      setTasks(taskList)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadDiscover()
    loadBridgeStatus()
    loadHubStats()
    loadAllMemories()
    loadTasks()
  }, [loadDiscover, loadBridgeStatus, loadHubStats, loadAllMemories, loadTasks])

  const handleRegisterAll = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.umpDiscoverRegisterAll()
      setMessage({ type: 'success', text: `已註冊 ${(result as { registered: string[] }).registered.length} 個 Agent` })
      await loadDiscover()
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleConsolidate = async (agentId: string) => {
    setLoading(true)
    try {
      const result = await window.electronAPI.umpDiscoverConsolidate(agentId) as { memories_consolidated: number; errors: string[] }
      setMessage({ type: 'success', text: `已整合 ${result.memories_consolidated} 個記憶` })
      await loadHubStats()
      await loadAllMemories()
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleBridgeConnect = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.umpBridgeConnect() as { success: boolean; status: BridgeStatus }
      setBridgeStatus(result.status)
      setMessage({ type: 'success', text: 'Bridge 已連接' })
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleBridgeImport = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.umpBridgeImport() as { success: boolean; count: number }
      setMessage({ type: 'success', text: `已匯入 ${result.count} 個記憶` })
      await loadHubStats()
      await loadAllMemories()
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleBridgeSync = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.umpBridgeSync() as { success: boolean; result: { memories_imported: number; agents_registered: number } }
      setMessage({ type: 'success', text: `同步完成：匯入 ${result.result.memories_imported} 記憶，註冊 ${result.result.agents_registered} Agent` })
      await loadBridgeStatus()
      await loadHubStats()
      await loadAllMemories()
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const results = await window.electronAPI.umpHubSearch(searchQuery, { limit: 20 }) as MemoryItem[]
      setSearchResults(results)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Message */}
      {message && (
        <div style={{
          margin: '12px 24px 0', padding: '10px 16px', borderRadius: '0.5rem', fontSize: '13px',
          background: message.type === 'success' ? 'rgba(92,138,42,0.15)' : 'rgba(196,58,58,0.15)',
          color: message.type === 'success' ? '#5c8a2a' : '#c43a3a',
        }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', padding: '0 24px' }}>
        {([['discover', 'Agent 探測'], ['sync', '記憶同步'], ['search', '記憶搜尋'], ['stats', '統計總覽'], ['tasks', '任務佇列']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`tab-btn ${tab === key ? 'active' : 'inactive'}`}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* Discover Tab */}
          {tab === 'discover' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa' }}>已安裝的 Agent</h2>
                <button className="btn-primary btn-sm" onClick={handleRegisterAll} disabled={loading}>
                  {loading ? '處理中...' : '自動註冊所有未註冊 Agent'}
                </button>
              </div>

              {agents.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#958ea0' }}>
                  <div style={{ fontSize: '36px', marginBottom: 12 }}>🔍</div>
                  <div>掃描不到已安裝的 Agent</div>
                  <div style={{ fontSize: '12px', marginTop: 4 }}>請確認 ~/AgentOS/agents/ 目錄下有 Agent 資料夾</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agents.map(agent => (
                    <div key={agent.agent_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#d4e4fa' }}>{agent.icon} {agent.name}</div>
                          <div style={{ fontSize: '12px', color: '#958ea0', fontFamily: 'JetBrains Mono, monospace' }}>{agent.agent_id} v{agent.version}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {agent.is_registered ? (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(92,138,42,0.2)', color: '#5c8a2a', fontWeight: 700 }}>已註冊</span>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(208,188,255,0.15)', color: '#d0bcff', fontWeight: 700 }}>未註冊</span>
                          )}
                          {agent.memory_file_count > 0 && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(5,102,217,0.2)', color: '#adc6ff', fontWeight: 700 }}>
                              {agent.memory_file_count} 個記憶
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#cbc3d7' }}>{agent.description}</div>
                      <div className="flex gap-2 flex-wrap">
                        {agent.tags.map(tag => (
                          <span key={tag} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(39,54,71,0.6)', color: '#958ea0' }}>{tag}</span>
                        ))}
                      </div>
                      {agent.memory_file_count > 0 && (
                        <button className="btn-secondary btn-sm" style={{ marginTop: 4, alignSelf: 'flex-start' }} onClick={() => handleConsolidate(agent.agent_id)} disabled={loading}>
                          整合記憶
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sync Tab */}
          {tab === 'sync' && (
            <div className="space-y-6">
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa' }}>記憶同步</h2>

              {/* Bridge Status */}
              <div className="card">
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>Bridge 狀態</h3>
                {bridgeStatus ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '13px' }}>
                    <div style={{ color: '#958ea0' }}>AgentOS 目錄:</div>
                    <div style={{ color: '#d4e4fa', fontFamily: 'JetBrains Mono, monospace' }}>{bridgeStatus.agentos_root}</div>
                    <div style={{ color: '#958ea0' }}>Memory 目錄:</div>
                    <div style={{ color: '#d4e4fa' }}>{bridgeStatus.memory_dir_exists ? '✓ 存在' : '✗ 不存在'}</div>
                    <div style={{ color: '#958ea0' }}>Registry:</div>
                    <div style={{ color: '#d4e4fa' }}>{bridgeStatus.registry_exists ? '✓ 存在' : '✗ 不存在'}</div>
                    <div style={{ color: '#958ea0' }}>Hub 記憶數:</div>
                    <div style={{ color: '#d4e4fa' }}>{bridgeStatus.hub_memories}</div>
                    <div style={{ color: '#958ea0' }}>Exchange Agent 數:</div>
                    <div style={{ color: '#d4e4fa' }}>{bridgeStatus.exchange_agents}</div>
                  </div>
                ) : (
                  <div style={{ color: '#958ea0', fontSize: '13px' }}>載入中...</div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-primary" onClick={handleBridgeConnect} disabled={loading}>連接 Bridge</button>
                <button className="btn-primary" onClick={handleBridgeImport} disabled={loading}>匯入記憶</button>
                <button className="btn-primary" onClick={handleBridgeSync} disabled={loading}>完整同步</button>
              </div>

              {/* All Memories */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>
                  Hub 中的記憶 ({allMemories.length})
                </h3>
                {allMemories.length === 0 ? (
                  <div className="card" style={{ color: '#958ea0', fontSize: '13px', textAlign: 'center', padding: 24 }}>
                    Hub 中尚無記憶，請先執行「匯入記憶」或「完整同步」
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {allMemories.slice(0, 50).map(m => (
                      <div key={m.id} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className={`status-dot ${m.memory_type === 'semantic' ? 'running' : m.memory_type === 'episodic' ? 'done' : 'stopped'}`} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#d4e4fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.content.slice(0, 100)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#958ea0', fontFamily: 'JetBrains Mono, monospace' }}>
                            {m.memory_type} | {m.group_id || '—'} | importance: {m.importance}
                          </div>
                        </div>
                      </div>
                    ))}
                    {allMemories.length > 50 && (
                      <div style={{ color: '#958ea0', fontSize: '12px', textAlign: 'center', padding: 8 }}>
                        顯示前 50 筆，共 {allMemories.length} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Tab */}
          {tab === 'search' && (
            <div className="space-y-6">
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa' }}>記憶搜尋</h2>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="搜尋記憶內容..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '0.5rem', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <button className="btn-primary" onClick={handleSearch}>搜尋</button>
              </div>

              {searchResults.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', color: '#958ea0', marginBottom: 8 }}>找到 {searchResults.length} 筆結果</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {searchResults.map(m => (
                      <div key={m.id} className="card" style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', color: '#d4e4fa', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{m.content}</div>
                        <div style={{ fontSize: '11px', color: '#958ea0', marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>
                          {m.memory_type} | {m.group_id || '—'} | importance: {m.importance}
                          {m.tags.length > 0 && ` | tags: ${m.tags.join(', ')}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && searchQuery && (
                <div className="card" style={{ color: '#958ea0', textAlign: 'center', padding: 24 }}>找不到符合的記憶</div>
              )}
            </div>
          )}

          {/* Stats Tab */}
          {tab === 'stats' && (
            <div className="space-y-6">
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa' }}>統計總覽</h2>

              {hubStats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: '總記憶數', value: hubStats.total_memories, icon: '🧠' },
                      { label: '平均重要性', value: (hubStats.avg_importance * 100).toFixed(0) + '%', icon: '⭐' },
                      { label: '記憶類型數', value: Object.keys(hubStats.by_type).length, icon: '📊' },
                      { label: '分組數', value: Object.keys(hubStats.by_group).length, icon: '📁' },
                    ].map(item => (
                      <div key={item.label} className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: 4 }}>{item.icon}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#d0bcff' }}>{item.value}</div>
                        <div style={{ fontSize: '12px', color: '#958ea0' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* By Type */}
                  {Object.keys(hubStats.by_type).length > 0 && (
                    <div className="card">
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>按類型分布</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(hubStats.by_type).map(([type, count]) => (
                          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 100, fontSize: '13px', color: '#958ea0' }}>{type}</span>
                            <div style={{ flex: 1, height: 8, background: '#010f1f', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(count / hubStats.total_memories) * 100}%`, background: 'linear-gradient(90deg, #a078ff, #0566d9)', borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: '13px', color: '#d4e4fa', fontFamily: 'JetBrains Mono, monospace', width: 40, textAlign: 'right' }}>{count as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Tags */}
                  {Object.keys(hubStats.top_tags).length > 0 && (
                    <div className="card">
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>熱門標籤</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(hubStats.top_tags).map(([tag, count]) => (
                          <span key={tag} style={{ padding: '4px 10px', borderRadius: '1rem', background: 'rgba(39,54,71,0.6)', color: '#958ea0', fontSize: '12px' }}>
                            {tag} ({count as number})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: 48, color: '#958ea0' }}>載入中...</div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {tab === 'tasks' && (
            <div className="space-y-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa' }}>任務佇列</h2>
                <button className="btn-primary btn-sm" onClick={loadTasks} disabled={loading}>
                  重新整理
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48, color: '#958ea0' }}>
                  尚無任務
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map(task => {
                    const statusColors: Record<string, { bg: string; color: string; label: string }> = {
                      pending: { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: '待處理' },
                      processing: { bg: 'rgba(5,102,217,0.2)', color: '#0566d9', label: '執行中' },
                      completed: { bg: 'rgba(16,185,129,0.2)', color: '#10b981', label: '已完成' },
                      failed: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', label: '失敗' },
                    }
                    const sc = statusColors[task.status] || statusColors.pending
                    return (
                      <div key={task.id} className="card" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 4 }}>{task.title}</div>
                            <div style={{ fontSize: '12px', color: '#958ea0', display: 'flex', gap: 12 }}>
                              <span>目標：{task.target}</span>
                              <span>來源：{task.source}</span>
                              <span>{new Date(task.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {sc.label}
                          </span>
                        </div>
                        {task.result && (
                          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '12px', color: '#c0b8d0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {task.result}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
