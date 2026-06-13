import { useState, useEffect, useCallback } from 'react'

interface SystemAgent {
  id: string
  name: string
  source: 'ollama' | 'pip' | 'npm' | 'path' | 'docker' | 'directory' | 'standalone'
  version: string
  description: string
  installed: boolean
  running: boolean
  details: Record<string, unknown>
}

const SOURCE_COLORS: Record<string, string> = {
  ollama: '#0566d9',
  pip: '#3572A5',
  npm: '#cb3837',
  path: '#5c8a2a',
  docker: '#2496ED',
  directory: '#d0bcff',
  standalone: '#ff9800',
}

const SOURCE_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  pip: 'Python (pip)',
  npm: 'npm',
  path: 'PATH',
  docker: 'Docker',
  directory: '本機目錄',
  standalone: '獨立安裝',
}

export default function SystemAgentsPage() {
  const [agents, setAgents] = useState<SystemAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [customDirs, setCustomDirs] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [addedAgents, setAddedAgents] = useState<Set<string>>(new Set())
  const [addingAgent, setAddingAgent] = useState<string | null>(null)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.systemDetectAll()
      setAgents(result)
    } catch (e) {
      setMessage({ type: 'error', text: `偵測失敗: ${String(e)}` })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const handleScanDirs = async () => {
    if (!customDirs.trim()) return
    const dirs = customDirs.split('\n').map(d => d.trim()).filter(Boolean)
    setLoading(true)
    try {
      const result = await window.electronAPI.systemDetectDirectories(dirs)
      setAgents(prev => {
        const existingIds = new Set(prev.map(a => a.id))
        const newAgents = result.filter(a => !existingIds.has(a.id))
        return [...prev, ...newAgents]
      })
      setMessage({ type: 'success', text: `從自訂目錄找到 ${result.length} 個 Agent` })
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setLoading(false)
  }

  const handleAddToLibrary = async (agent: SystemAgent) => {
    setAddingAgent(agent.id)
    try {
      const result = await window.electronAPI.systemAddToLibrary({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        version: agent.version,
        icon: agent.details?.icon as string || '🤖',
        configDirs: agent.details?.configDirs as string[] || [],
        dataDirs: agent.details?.dataDirs as string[] || [],
      })
      if (result.success) {
        setAddedAgents(prev => new Set([...prev, agent.id]))
        setMessage({ type: 'success', text: `${agent.name} 已加入收藏庫` })
      } else {
        setMessage({ type: 'error', text: `加入失敗: ${result.error}` })
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
    setAddingAgent(null)
  }

  const filtered = filter === 'all' ? agents : agents.filter(a => a.source === filter)
  const bySource = agents.reduce((acc, a) => {
    acc[a.source] = (acc[a.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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

      <div style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px' }}>
        <div className="flex justify-between items-center">
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa', margin: 0 }}>系統 Agent 偵測</h2>
          <button className="btn-primary" onClick={loadAgents} disabled={loading}>
            {loading ? '偵測中...' : '重新掃描'}
          </button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '4px 12px', borderRadius: '1rem', fontSize: '12px', border: 'none', cursor: 'pointer',
              background: filter === 'all' ? 'rgba(208,188,255,0.2)' : 'rgba(39,54,71,0.6)',
              color: filter === 'all' ? '#d0bcff' : '#958ea0', fontWeight: filter === 'all' ? 600 : 400,
            }}
          >
            全部 ({agents.length})
          </button>
          {Object.entries(bySource).map(([source, count]) => (
            <button
              key={source}
              onClick={() => setFilter(source)}
              style={{
                padding: '4px 12px', borderRadius: '1rem', fontSize: '12px', border: 'none', cursor: 'pointer',
                background: filter === source ? `${SOURCE_COLORS[source]}33` : 'rgba(39,54,71,0.6)',
                color: filter === source ? SOURCE_COLORS[source] : '#958ea0',
                fontWeight: filter === source ? 600 : 400,
              }}
            >
              {SOURCE_LABELS[source] || source} ({count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(bySource).length + 1, 6)}, 1fr)`, gap: 12 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#d0bcff' }}>{agents.length}</div>
              <div style={{ fontSize: '12px', color: '#958ea0' }}>總偵測數</div>
            </div>
            {Object.entries(bySource).map(([source, count]) => (
              <div key={source} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: SOURCE_COLORS[source] || '#958ea0' }}>{count}</div>
                <div style={{ fontSize: '12px', color: '#958ea0' }}>{SOURCE_LABELS[source] || source}</div>
              </div>
            ))}
          </div>

          {/* Custom Directory Scan */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 8 }}>掃描自訂目錄</h3>
            <div style={{ fontSize: '12px', color: '#958ea0', marginBottom: 8 }}>輸入要掃描的目錄路徑（每行一個）</div>
            <textarea
              value={customDirs}
              onChange={e => setCustomDirs(e.target.value)}
              placeholder={"C:\\Users\\你的帳號\\agent 翻譯\nD:\\ai-projects"}
              rows={3}
              style={{
                width: '100%', padding: '10px', borderRadius: '0.5rem', background: '#0d1c2d',
                border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', fontSize: '13px',
                fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <button className="btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleScanDirs} disabled={loading || !customDirs.trim()}>
              掃描目錄
            </button>
          </div>

          {/* Agent List */}
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#958ea0' }}>
              <div style={{ fontSize: '36px', marginBottom: 12 }}>🔍</div>
              <div>{loading ? '偵測中...' : '未偵測到 Agent'}</div>
              <div style={{ fontSize: '12px', marginTop: 4 }}>嘗試安裝 Ollama、pip 套件或將 Agent 放入 agents/ 目錄</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(agent => (
                <div key={agent.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: agent.running ? '#5c8a2a' : agent.installed ? SOURCE_COLORS[agent.source] || '#958ea0' : '#c43a3a',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa' }}>{agent.name}</span>
                      <span style={{
                        fontSize: '10px', padding: '1px 8px', borderRadius: '1rem',
                        background: `${SOURCE_COLORS[agent.source] || '#958ea0'}22`,
                        color: SOURCE_COLORS[agent.source] || '#958ea0',
                      }}>
                        {SOURCE_LABELS[agent.source] || agent.source}
                      </span>
                      {agent.version && (
                        <span style={{ fontSize: '11px', color: '#958ea0', fontFamily: 'JetBrains Mono, monospace' }}>
                          v{agent.version}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#958ea0', marginTop: 2 }}>{agent.description}</div>
                    {agent.details.path && (
                      <div style={{ fontSize: '11px', color: '#5a5470', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
                        {String(agent.details.path)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {agent.running && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(92,138,42,0.2)', color: '#5c8a2a', fontWeight: 700 }}>
                        運行中
                      </span>
                    )}
                    {agent.source === 'standalone' && (
                      addedAgents.has(agent.id) ? (
                        <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '1rem', background: 'rgba(92,138,42,0.2)', color: '#5c8a2a', fontWeight: 600 }}>
                          ✓ 已加入
                        </span>
                      ) : (
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleAddToLibrary(agent)}
                          disabled={addingAgent === agent.id}
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                        >
                          {addingAgent === agent.id ? '加入中...' : '加入收藏庫'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
