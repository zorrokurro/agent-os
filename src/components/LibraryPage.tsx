import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentInfo } from '../types'
import { formatModelLabel } from '../hooks/useModelConfig'

// ---------------------------------------------------------------------------
// 左側列表的 filter 模式
// ---------------------------------------------------------------------------
type LibraryTab = 'all' | 'favorites'

function LibraryPage({ onInstall }: { onInstall: () => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [libTab, setLibTab] = useState<LibraryTab>('all')
  const [tab, setTab] = useState<'controls' | 'logs' | 'config' | 'docs'>('controls')
  const [ollamaStatus, setOllamaStatus] = useState<{ installed: boolean; running: boolean }>({ installed: false, running: false })
  const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({})
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const selectedAgentRef = useRef(selectedAgent)
  selectedAgentRef.current = selectedAgent

  // ------------------------------------------------------------------
  // 載入：agents + favorites + ollama
  // ------------------------------------------------------------------
  const loadAgents = useCallback(async () => {
    const list = await window.electronAPI.getAgents()
    setAgents(list)
    if (list.length > 0 && !selectedAgentRef.current) setSelectedAgent(list[0].id)
    const statuses: Record<string, string> = {}
    for (const a of list) {
      try {
        const s = await window.electronAPI.getAgentStatus(a.id)
        statuses[a.id] = s.status
      } catch { statuses[a.id] = 'stopped' }
    }
    setAgentStatuses(statuses)
  }, [])

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await window.electronAPI.getFavorites() as string[]
      setFavorites(favs)
    } catch { /* ignore */ }
  }, [])

  const checkOllama = useCallback(async () => {
    setOllamaStatus(await window.electronAPI.checkOllama())
  }, [])

  // ------------------------------------------------------------------
  // GitHub 匯入
  // ------------------------------------------------------------------
  const handleImport = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await window.electronAPI.importAgentFromGitHub(importUrl.trim()) as { success: boolean; message: string }
      setImportResult({ success: result.success, message: result.message })
      if (result.success) {
        // 匯入成功 → 刷新列表
        await loadAgents()
        setTimeout(() => { setShowImport(false); setImportResult(null) }, 2000)
      }
    } catch (e: unknown) { setImportResult({ success: false, message: String(e) }) }
    setImporting(false)
  }

  useEffect(() => {
    loadAgents()
    loadFavorites()
    checkOllama()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAgents()
        loadFavorites()
        checkOllama()
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [loadAgents, loadFavorites, checkOllama])

  // ------------------------------------------------------------------
  // 收藏切換
  // ------------------------------------------------------------------
  const handleToggleFavorite = async (agentId: string) => {
    try {
      const result = await window.electronAPI.toggleFavorite(agentId) as { favorites: string[] }
      setFavorites(result.favorites)
    } catch (e) { console.error('切換收藏失敗:', e) }
  }

  // ------------------------------------------------------------------
  // Agent 啟動 / 停止
  // ------------------------------------------------------------------
  const toggleAgent = async (agent: AgentInfo) => {
    if (agent.runtimeType === 'external') {
      // External agents can't be started from AgentOS
      return
    }
    const s = agentStatuses[agent.id] || 'stopped'
    if (s === 'running') await window.electronAPI.stopAgent(agent.id)
    else await window.electronAPI.startAgent(agent.id)
    await loadAgents()
  }

  // ------------------------------------------------------------------
  // 過濾後的 Agent 列表
  // ------------------------------------------------------------------
  const displayAgents = libTab === 'favorites'
    ? agents.filter(a => favorites.includes(a.id))
    : agents

  const agent = agents.find(a => a.id === selectedAgent)
  const agentStatus = agent ? (agentStatuses[agent.id] || 'stopped') : 'stopped'

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* ============================================================
          左側面板：Agent 列表 + 收藏 filter
          ============================================================ */}
      <div style={{
        width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'rgba(1, 15, 31, 0.8)', borderRight: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* 標題列 */}
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#958ea0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>我的 Agent</h2>
        </div>

        {/* 收藏 filter tabs */}
        <div style={{ display: 'flex', padding: '8px 12px', gap: '4px' }}>
          <button
            onClick={() => setLibTab('all')}
            style={{
              flex: 1, padding: '6px 0', fontSize: '12px', fontWeight: 600,
              borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
              background: libTab === 'all' ? 'rgba(208,188,255,0.15)' : 'transparent',
              color: libTab === 'all' ? '#d0bcff' : '#958ea0',
            }}
          >
            全部 ({agents.length})
          </button>
          <button
            onClick={() => setLibTab('favorites')}
            style={{
              flex: 1, padding: '6px 0', fontSize: '12px', fontWeight: 600,
              borderRadius: '0.25rem', border: 'none', cursor: 'pointer',
              background: libTab === 'favorites' ? 'rgba(208,188,255,0.15)' : 'transparent',
              color: libTab === 'favorites' ? '#d0bcff' : '#958ea0',
            }}
          >
            ❤️ 收藏 ({favorites.length})
          </button>
        </div>

        {/* Agent 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {displayAgents.map(a => {
            const status = agentStatuses[a.id] || 'stopped'
            const isSelected = selectedAgent === a.id
            const isFav = favorites.includes(a.id)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                {/* 收藏切換按鈕 */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(a.id) }}
                  style={{
                    flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', borderRadius: '0.25rem',
                    fontSize: 14, color: isFav ? '#d0bcff' : '#494454',
                  }}
                  title={isFav ? '取消收藏' : '加入收藏'}
                >
                  {isFav ? '❤️' : '🤍'}
                </button>

                {/* Agent 項目 */}
                <button
                  onClick={() => setSelectedAgent(a.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 8px', borderRadius: '0.25rem',
                    background: isSelected ? 'rgba(208, 188, 255, 0.15)' : 'transparent',
                    border: isSelected ? '1px solid rgba(208, 188, 255, 0.3)' : '1px solid transparent',
                    borderLeft: isSelected ? '2px solid #d0bcff' : '2px solid transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    minWidth: 0,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <span className={`status-dot ${status}`} style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'running' ? '#5c8a2a' : '#958ea0', flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#d0bcff' : '#d4e4fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: '12px', color: '#958ea0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                  </div>
                </button>
              </div>
            )
          })}

          {/* 空狀態 — 全部 */}
          {agents.length === 0 && (
            <div style={{ textAlign: 'center', color: '#958ea0', fontSize: '14px', padding: '48px 16px' }}>
              <div style={{ fontSize: '36px', marginBottom: 12 }}>🤖</div>
              <div style={{ fontWeight: 600 }}>尚無 Agent</div>
              <button className="btn-primary btn-sm" style={{ marginTop: 12, padding: '8px 16px', fontSize: '13px' }} onClick={onInstall}>➕ 安裝第一個 Agent</button>
            </div>
          )}

          {/* 空狀態 — 收藏 */}
          {libTab === 'favorites' && agents.length > 0 && displayAgents.length === 0 && (
            <div style={{ textAlign: 'center', color: '#494454', fontSize: '13px', padding: '32px 16px' }}>
              <div style={{ fontSize: '28px', marginBottom: 8 }}>💜</div>
              <div>尚未收藏任何 Agent</div>
              <div style={{ marginTop: 4, fontSize: '12px' }}>到商城收藏 Agent 後會顯示在這裡</div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-secondary btn-sm" style={{ width: '100%', padding: '8px', fontSize: '13px' }} onClick={() => setShowImport(true)}>📦 從 GitHub 匯入</button>
          <button className="btn-primary btn-sm" style={{ width: '100%', padding: '8px', fontSize: '13px' }} onClick={onInstall}>➕ 安裝精靈</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span className={`status-dot ${ollamaStatus.running ? 'running' : ollamaStatus.installed ? 'stopped' : 'error'}`} />
            <span style={{ color: '#958ea0' }}>Ollama {ollamaStatus.running ? '運行中' : ollamaStatus.installed ? '已停止' : '未安裝'}</span>
            <button onClick={checkOllama} style={{ marginLeft: 'auto', color: '#d0bcff', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>檢查</button>
          </div>
        </div>
      </div>

      {/* ============================================================
          GitHub 匯入 Modal
          ============================================================ */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowImport(false)} />
          <div className="glass-panel" style={{ position: 'relative', width: '460px', padding: '28px', borderRadius: '0.75rem', background: 'rgba(18,33,49,0.95)', border: '1px solid rgba(208,188,255,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#d0bcff' }}>📦 從 GitHub 匯入 Agent</h2>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#958ea0', marginBottom: '14px' }}>
              輸入 GitHub repo URL，例如：<br /><code style={{ color: '#d0bcff' }}>https://github.com/user/agent-repo</code>
            </p>
            <input
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              placeholder="https://github.com/username/agent-repo"
              onKeyDown={e => e.key === 'Enter' && handleImport()}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '0.5rem', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
            {importResult && (
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '0.5rem', background: importResult.success ? 'rgba(92,138,42,0.15)' : 'rgba(196,58,58,0.15)', color: importResult.success ? '#5c8a2a' : '#c43a3a', fontSize: '13px' }}>
                {importResult.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowImport(false)} style={{ padding: '8px 16px', fontSize: '13px' }}>取消</button>
              <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ padding: '8px 16px', fontSize: '13px' }}>{importing ? '匯入中...' : '匯入'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          右側面板：Agent 詳情
          ============================================================ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {agent ? (
          <>
            {/* 頂部資訊列 */}
            <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{agent.name}</h1>
                  {favorites.includes(agent.id) && <span style={{ fontSize: 16 }}>❤️</span>}
                </div>
                <p style={{ fontSize: '13px', color: '#958ea0', marginTop: 2 }}>{agent.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span className={`status-dot ${agentStatus}`} />
                <span style={{ fontSize: '13px', color: '#958ea0' }}>
                  {agent.runtimeType === 'external' ? '獨立 Agent' : agentStatus === 'running' ? '運行中' : '已停止'}
                </span>
                {agent.runtimeType === 'external' ? (
                  <div style={{ padding: '8px 16px', fontSize: '13px', color: '#958ea0', background: 'rgba(39,54,71,0.6)', borderRadius: '0.25rem' }}>
                    🔗 獨立運行中
                  </div>
                ) : (
                  <button
                    className={agentStatus === 'running' ? 'btn-danger' : 'btn-primary'}
                    style={{ padding: '8px 20px', fontSize: '13px' }}
                    onClick={() => toggleAgent(agent)}
                  >
                    {agentStatus === 'running' ? '⏹ 停止' : '▶ 啟動'}
                  </button>
                )}
              </div>
            </div>

            {/* 子分頁 */}
            <div className="flex shrink-0" style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {(['controls', 'logs', 'config', 'docs'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'active' : 'inactive'}`}>
                  {t === 'controls' ? '控制台' : t === 'logs' ? '日誌' : t === 'config' ? '設定' : '文件'}
                </button>
              ))}
            </div>

            {/* 主內容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {tab === 'controls' && <ControlsTab agent={agent} agentStatus={agentStatus} onToggleAgent={() => toggleAgent(agent)} onTabChange={setTab} />}
              {tab === 'logs' && <LogsTab agentId={agent.id} />}
              {tab === 'config' && <ConfigTab agent={agent} />}
              {tab === 'docs' && <DocsTab agent={agent} />}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: 16 }}>🎮</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#d4e4fa', marginBottom: 8 }}>選擇一個 Agent</div>
            <div style={{ fontSize: '14px', color: '#958ea0' }}>從左側列表中選擇要管理的 Agent</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================================================================
// 子分頁元件
// ==================================================================

function ControlsTab({ agent, agentStatus, onToggleAgent, onTabChange }: { agent: AgentInfo; agentStatus: string; onToggleAgent: () => void; onTabChange: (tab: 'controls' | 'logs' | 'config' | 'docs') => void }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'agent'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')

  useEffect(() => {
    Promise.all([
      window.electronAPI.listModels(),
      window.electronAPI.listApiModels().catch(() => []),
    ]).then(([ollama, api]) => {
      const all = [...ollama, ...api]
      setModels(all)
      if (all.length > 0 && !selectedModel) setSelectedModel(all[0])
    })
  }, [])

  const sendTask = async () => {
    if (!input.trim() || loading) return
    const task = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: task }])
    setLoading(true)

    try {
      const model = selectedModel || models[0] || 'llama3.1:8b'
      const chatMessages = [
        { role: 'system', content: `你是 AgentOS 的 AI Agent「${agent.name}」。${agent.description}。請用繁體中文回覆。` },
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: task },
      ]

      // Streaming approach: add empty agent message, then update it token by token
      setMessages(prev => [...prev, { role: 'agent', content: '' }])
      let fullReply = ''

      const removeToken = window.electronAPI.onChatToken((token) => {
        fullReply += token
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'agent', content: fullReply }
          return updated
        })
      })

      const removeDone = window.electronAPI.onChatDone(async () => {
        removeToken()
        removeDone()
        removeError()
        setLoading(false)

        // Save conversation to memory
        try {
          const allMessages = [...messages, { role: 'user' as const, content: task }, { role: 'agent' as const, content: fullReply }]
          await window.electronAPI.saveConversation(agent.name, allMessages)
        } catch { /* ignore save errors */ }
      })

      const removeError = window.electronAPI.onChatError((error) => {
        removeToken()
        removeDone()
        removeError()
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'agent', content: `❌ 錯誤：${error}\n\n請確認 Ollama 已啟動且模型已下載。` }
          return updated
        })
        setLoading(false)
      })

      await window.electronAPI.chatStream(model, chatMessages)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', content: `❌ 錯誤：${String(e)}\n\n請確認 Ollama 已啟動且模型已下載。` }])
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div className="glass-panel" style={{ flex: 1, minHeight: '300px', overflowY: 'auto', borderRadius: '0.5rem', padding: '20px' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: 480, padding: '24px', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{agent.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{agent.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span className={`status-dot ${agentStatus}`} style={{ width: 7, height: 7, borderRadius: '50%', background: agentStatus === 'running' ? '#5c8a2a' : '#958ea0', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: agentStatus === 'running' ? '#5c8a2a' : '#958ea0' }}>{agentStatus === 'running' ? '運行中' : '已停止'}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#958ea0', lineHeight: '1.6' }}>{agent.description}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {agent.runtimeType !== 'external' && (
                  <button
                    className={agentStatus === 'running' ? 'btn-danger' : 'btn-primary'}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
                    onClick={() => onToggleAgent()}
                  >
                    {agentStatus === 'running' ? '⏹ 停止' : '▶ 啟動'}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
                  onClick={() => onTabChange('logs')}
                >
                  📋 查看日誌
                </button>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#494454' }}>從這裡發送任務給 {agent.name}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px', borderRadius: '0.5rem', fontSize: '14px',
                  background: msg.role === 'user' ? 'rgba(160, 120, 255, 0.2)' : 'rgba(39, 54, 71, 0.5)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(160, 120, 255, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: msg.role === 'user' ? '#d0bcff' : '#d4e4fa',
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '12px 16px', borderRadius: '0.5rem', fontSize: '14px', background: 'rgba(39,54,71,0.5)', color: '#958ea0' }}>思考中...</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {models.length > 1 && (
          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: '0.25rem', fontSize: '13px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', minWidth: 160 }}>
            {models.map(m => <option key={m} value={m}>{formatModelLabel(m)}</option>)}
          </select>
        )}
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendTask()} placeholder="輸入任務..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
        />
        <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }} onClick={sendTask} disabled={loading || !selectedModel}>
          {loading ? '⏳' : '送出'}
        </button>
      </div>
    </div>
  )
}

function LogsTab({ agentId }: { agentId: string }) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const result = await window.electronAPI.getAgentLogs(agentId)
        if (active) setLogs(result.logs)
      } catch {
        if (active) setLogs([])
      }
      if (active) setLoading(false)
    }
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [agentId])

  return (
    <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px', height: '100%' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', minHeight: '400px', maxHeight: '600px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ color: '#494454' }}>載入中...</div>
        ) : logs.length > 0 ? logs.map((line, i) => (
          <div key={i} style={{ padding: '2px 0', color: line.includes('[ERR]') ? '#c43a3a' : '#958ea0' }}>{line}</div>
        )) : (
          <div style={{ color: '#494454' }}>尚無日誌</div>
        )}
      </div>
    </div>
  )
}

function ConfigTab({ agent }: { agent: AgentInfo }) {
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    Promise.all([
      window.electronAPI.listModels(),
      window.electronAPI.listApiModels().catch(() => []),
    ]).then(([ollama, api]) => setModels([...ollama, ...api]))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>Ollama 連接設定</h3>
        <div style={{ fontSize: '14px', color: '#958ea0' }}>URL: <span style={{ color: '#d0bcff', fontFamily: 'JetBrains Mono, monospace' }}>http://localhost:11434</span></div>
      </div>
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>已安裝模型</h3>
        {models.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
            {models.map(m => <div key={m} style={{ color: '#d4e4fa', fontFamily: 'JetBrains Mono, monospace' }}>{formatModelLabel(m)}</div>)}
          </div>
        ) : (
          <div style={{ fontSize: '14px', color: '#494454' }}>尚未安裝任何模型</div>
        )}
      </div>
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>Agent 資訊</h3>
        <div style={{ fontSize: '14px', color: '#958ea0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>ID: <span style={{ color: '#d4e4fa', fontFamily: 'JetBrains Mono, monospace' }}>{agent.id}</span></div>
          <div>名稱: <span style={{ color: '#d4e4fa' }}>{agent.name}</span></div>
        </div>
      </div>
    </div>
  )
}

function DocsTab({ agent }: { agent: AgentInfo }) {
  const [docs, setDocs] = useState<{ description: string; readme: string }>({ description: '', readme: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    window.electronAPI.getAgentDocs(agent.id).then(result => {
      if (active) setDocs(result)
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [agent.id])

  if (loading) {
    return (
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <div style={{ color: '#494454', fontSize: '14px' }}>載入中...</div>
      </div>
    )
  }

  if (!docs.description && !docs.readme) {
    return (
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: 16 }}>{agent.name} 使用說明</h2>
        <div style={{ color: '#494454', fontSize: '14px' }}>此 Agent 未提供說明文件</div>
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
      <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: 16 }}>{agent.name} 使用說明</h2>
      <div style={{ color: '#958ea0', fontSize: '14px', lineHeight: '1.8' }}>
        {docs.description && (
          <p style={{ marginBottom: 16 }}>{docs.description}</p>
        )}
        {docs.readme && (
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
            {docs.readme}
          </div>
        )}
      </div>
    </div>
  )
}

export default LibraryPage
