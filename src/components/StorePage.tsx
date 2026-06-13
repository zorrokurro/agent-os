import { useState, useEffect } from 'react'
import type { CatalogAgent } from '../types'

// TODO: Phase 2 - 商城功能由新專案負責，此處僅為本地展示

// ---------------------------------------------------------------------------
// 本地已匯入 Agent 狀態（從 getAgents 取得的 subset）
// ---------------------------------------------------------------------------
interface InstalledAgentInfo {
  id: string
  status: 'stopped' | 'running' | 'error' | 'installing'
  installed: boolean
}

// ---------------------------------------------------------------------------
// 子元件
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 'all', label: '全部', icon: '🌐' },
  { id: 'nlp', label: '自然語言', icon: '⚡' },
  { id: 'vision', label: '電腦視覺', icon: '👁️' },
  { id: 'audio', label: '音訊', icon: '🎙️' },
  { id: 'security', label: '資安', icon: '🛡️' },
]

function PriceTag({ price }: { price: number | 'free' }) {
  return (
    <span className={`font-mono text-sm font-bold ${price === 'free' ? 'text-green-400' : 'text-white'}`}>
      {price === 'free' ? 'Free' : `$${price}`}
    </span>
  )
}

function ActionButton({ agent, compact = false, installed, onAction }: {
  agent: CatalogAgent; compact?: boolean; installed?: InstalledAgentInfo
  onAction?: (action: string, agent: CatalogAgent) => void
}) {
  const base: React.CSSProperties = {
    padding: compact ? '6px 12px' : '8px 16px', fontSize: compact ? '12px' : '13px',
    border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 700,
    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px',
  }

  if (installed?.status === 'running') {
    return <button style={{ ...base, background: 'linear-gradient(135deg, #5c8a2a, #4c6b22)', color: '#d2efa9' }} onClick={() => onAction?.('stop', agent)}>⏹ 停止</button>
  }
  if (installed?.installed) {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={{ ...base, background: 'linear-gradient(135deg, #5c8a2a, #4c6b22)', color: '#d2efa9' }} onClick={() => onAction?.('start', agent)}>▶ 啟動</button>
        <button style={{ ...base, background: 'rgba(208,188,255,0.15)', border: '1px solid rgba(208,188,255,0.3)', color: '#d0bcff', padding: '6px 10px' }} onClick={() => onAction?.('upgrade', agent)} title="升級">⬆</button>
      </div>
    )
  }
  const isFree = agent.price === 'free'
  return (
    <button style={{ ...base, background: isFree ? 'linear-gradient(135deg, #5c8a2a, #4c6b22)' : 'linear-gradient(135deg, #0566d9, #004395)', color: '#fff' }} onClick={() => onAction?.('install', agent)}>
      ⬇ {isFree ? '免費安裝' : `安裝 $${agent.price}`}
    </button>
  )
}

function AgentCard({ agent, installed, onAction, isFavorite, onToggleFavorite }: {
  agent: CatalogAgent; installed?: InstalledAgentInfo
  onAction?: (action: string, agent: CatalogAgent) => void
  isFavorite?: boolean; onToggleFavorite?: (id: string) => void
}) {
  let statusColor = '#958ea0'
  let statusBg = 'rgba(149,142,160,0.15)'
  let statusBorder = 'rgba(149,142,160,0.3)'
  if (installed?.status === 'running') { statusColor = '#5c8a2a'; statusBg = 'rgba(92,138,42,0.2)'; statusBorder = 'rgba(92,138,42,0.3)' }
  else if (installed?.installed) { statusColor = '#d0bcff'; statusBg = 'rgba(208,188,255,0.2)'; statusBorder = 'rgba(208,188,255,0.3)' }

  return (
    <div className="glass-panel rounded-xl overflow-hidden group flex flex-col cursor-pointer" style={{ borderRadius: '0.75rem' }}>
      <div className="aspect-video relative overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(39,54,71,0.8), rgba(18,33,49,0.9))' }}>
        <span style={{ fontSize: 40, opacity: 0.3 }}>🤖</span>
        {installed && (
          <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
            {installed.status === 'running' ? '● 運行中' : installed.installed ? '✓ 已安裝' : null}
          </span>
        )}
        {!installed && (
          <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,102,217,0.2)', color: '#adc6ff', border: '1px solid rgba(5,102,217,0.3)' }}>
            📦 可安裝
          </span>
        )}
        <span className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-xs font-mono"><PriceTag price={agent.price} /></span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(agent.id) }}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: isFavorite ? 'rgba(208,188,255,0.3)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          title={isFavorite ? '取消收藏' : '加入收藏'}
        >
          <span style={{ fontSize: 14, color: isFavorite ? '#d0bcff' : '#958ea0' }}>
            {isFavorite ? '❤️' : '🤍'}
          </span>
        </button>
      </div>
      <div className="p-4 flex-grow flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <h3 className="font-bold group-hover:text-violet-400 transition-colors" style={{ color: '#d4e4fa', fontSize: '15px' }}>{agent.name}</h3>
        </div>
        <p className="text-xs font-mono" style={{ color: '#958ea0' }}>by {agent.author || 'Community'}</p>
        <p className="text-sm leading-relaxed flex-grow" style={{ color: '#cbc3d7' }}>{agent.description}</p>
        <div className="flex gap-2 mt-1 flex-wrap">
          {agent.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(39,54,71,0.6)', color: '#958ea0' }}>{tag}</span>
          ))}
        </div>
        <div className="mt-3">
          <ActionButton agent={agent} compact installed={installed} onAction={onAction} />
        </div>
      </div>
    </div>
  )
}

function ReleaseCard({ agent, installed, onAction }: {
  agent: CatalogAgent; installed?: InstalledAgentInfo
  onAction?: (action: string, agent: CatalogAgent) => void
}) {
  return (
    <div className="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition-all cursor-pointer" style={{ borderRadius: '0.75rem' }}>
      <div className="w-20 h-20 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(39,54,71,0.8), rgba(18,33,49,0.9))' }}>
        <span style={{ fontSize: 24, opacity: 0.3 }}>🤖</span>
      </div>
      <div className="flex-grow grid grid-cols-4 items-center gap-2">
        <div className="col-span-2">
          <h4 className="font-bold text-sm" style={{ color: '#d4e4fa' }}>{agent.name}</h4>
          <p className="text-xs mt-0.5" style={{ color: '#958ea0' }}>{agent.description}</p>
        </div>
        <PriceTag price={agent.price} />
        <div className="flex justify-end">
          <ActionButton agent={agent} compact installed={installed} onAction={onAction} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 主元件
// ---------------------------------------------------------------------------

export default function StorePage() {
  const [catalog, setCatalog] = useState<CatalogAgent[]>([])
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledAgentInfo>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)

  // ------------------------------------------------------------------
  // 載入：catalog + installed agents + favorites
  // ------------------------------------------------------------------
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        // 1. 從 registry 載入 catalog
        const cat = await window.electronAPI.getAgentCatalog() as { agents: CatalogAgent[] }
        if (mounted) setCatalog(cat.agents || [])

        // 2. 載入本機已匯入 Agent（對照用）
        const list = await window.electronAPI.getAgents() as any[]
        if (mounted) {
          const map: Record<string, InstalledAgentInfo> = {}
          for (const a of list) {
            map[a.id] = { id: a.id, status: a.status, installed: a.installed }
          }
          setInstalledMap(map)
        }

        // 3. 收藏
        const favs = await window.electronAPI.getFavorites() as string[]
        if (mounted) setFavorites(favs)
      } catch (e) { console.error('載入失敗:', e) }
      if (mounted) setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

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
  // 分類 + 搜尋過濾
  // ------------------------------------------------------------------
  const filteredAgents = catalog.filter(agent => {
    const matchSearch = !searchQuery ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCat = activeCategory === 'all' ||
      agent.category === activeCategory ||
      agent.tags.includes(activeCategory)
    return matchSearch && matchCat
  })

  const featuredAgent = catalog.find(a => a.featured)

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
        setInstalledMap(await buildInstalledMap())
        setTimeout(() => { setShowImport(false); setImportResult(null) }, 2000)
      }
    } catch (e: unknown) { setImportResult({ success: false, message: String(e) }) }
    setImporting(false)
  }

  // ------------------------------------------------------------------
  // Agent 操作
  // ------------------------------------------------------------------

  // 從 getAgents() 結果建立 installedMap 的 helper
  const buildInstalledMap = async (): Promise<Record<string, InstalledAgentInfo>> => {
    const list = await window.electronAPI.getAgents() as any[]
    const map: Record<string, InstalledAgentInfo> = {}
    for (const a of list) map[a.id] = { id: a.id, status: a.status, installed: a.installed }
    return map
  }

  const handleAction = async (action: string, agent: CatalogAgent) => {
    if (action === 'install') {
      try {
        const result = await window.electronAPI.installAgent({
          agents: [agent.id], providerId: 'ollama', modelId: '', apiKey: '',
          runMode: 'local', modelPreference: 'auto', autoStart: false, selectedGpuIndex: -1,
        })
        if (result.success) {
          setInstalledMap(prev => ({ ...prev, [agent.id]: { id: agent.id, status: 'stopped', installed: true } }))
        }
      } catch (e) { console.error('安裝失敗:', e) }
    } else if (action === 'start') {
      try {
        const result = await window.electronAPI.startAgent(agent.id)
        if (result?.success) {
          setInstalledMap(prev => ({ ...prev, [agent.id]: { id: agent.id, status: 'running', installed: true } }))
        }
      } catch (e) { console.error(e) }
    } else if (action === 'stop') {
      try {
        await window.electronAPI.stopAgent(agent.id)
        setInstalledMap(prev => ({ ...prev, [agent.id]: { id: agent.id, status: 'stopped', installed: true } }))
      } catch (e) { console.error(e) }
    } else if (action === 'upgrade') {
      try {
        const result = await window.electronAPI.upgradeAgent(agent.id)
        if (result?.success) {
          setInstalledMap(await buildInstalledMap())
        }
      } catch (e) { console.error('升級失敗:', e) }
    }
  }

  // ------------------------------------------------------------------
  // JSX
  // ------------------------------------------------------------------
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Import Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '480px', padding: '32px', borderRadius: '0.75rem', background: 'rgba(18,33,49,0.95)', border: '1px solid rgba(208,188,255,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#d0bcff' }}>📦 從 GitHub 匯入 Agent</h2>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#958ea0', marginBottom: '16px' }}>
              輸入 GitHub repo URL，例如：<br /><code style={{ color: '#d0bcff' }}>https://github.com/user/agent-repo</code>
            </p>
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://github.com/username/agent-repo"
              onKeyDown={e => e.key === 'Enter' && handleImport()}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '0.5rem', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            {importResult && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '0.5rem', background: importResult.success ? 'rgba(92,138,42,0.15)' : 'rgba(196,58,58,0.15)', color: importResult.success ? '#5c8a2a' : '#c43a3a', fontSize: '13px' }}>
                {importResult.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowImport(false)}>取消</button>
              <button className="btn-primary" onClick={handleImport} disabled={importing}>{importing ? '匯入中...' : '匯入'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="max-w-[1200px] mx-auto space-y-8">

          {/* 頂部工具列 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowImport(true)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📦 從 GitHub 匯入
              </button>
            </div>
          </div>

          {/* 搜尋列 */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#958ea0', fontSize: '14px' }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋 Agent..."
                style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '0.5rem', background: 'rgba(13,28,45,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* 分類 tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '6px 14px', borderRadius: '2rem', fontSize: '12px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  background: activeCategory === cat.id ? 'rgba(208,188,255,0.2)' : 'rgba(39,54,71,0.5)',
                  color: activeCategory === cat.id ? '#d0bcff' : '#958ea0',
                  transition: 'all 0.15s',
                }}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* HERO — Featured Agent */}
          {featuredAgent && !searchQuery && activeCategory === 'all' && (
            <section className="relative w-full aspect-[21/9] rounded-xl overflow-hidden shadow-2xl" style={{ borderRadius: '0.75rem' }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(5,20,36,0.95), rgba(5,20,36,0.5), transparent)' }} />
              <div className="absolute inset-0 px-8 flex flex-col justify-center max-w-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest" style={{ background: 'rgba(160,120,255,0.2)', color: '#d0bcff', border: '1px solid rgba(160,120,255,0.3)' }}>Featured</span>
                  <span className="text-sm font-mono" style={{ color: '#958ea0' }}>{featuredAgent.category.toUpperCase()}</span>
                </div>
                <h1 className="text-4xl font-black tracking-tight leading-none" style={{ color: '#fff' }}>{featuredAgent.name}</h1>
                <p className="text-base leading-relaxed" style={{ color: '#cbc3d7' }}>{featuredAgent.description}</p>
                <div className="flex items-center gap-3 pt-1">
                  <ActionButton agent={featuredAgent} installed={installedMap[featuredAgent.id]} onAction={handleAction} />
                  <button
                    onClick={() => handleToggleFavorite(featuredAgent.id)}
                    className="glass-panel px-4 py-2.5 rounded-lg font-bold text-sm"
                    style={{ color: favorites.includes(featuredAgent.id) ? '#d0bcff' : '#958ea0', borderRadius: '0.5rem' }}
                  >
                    {favorites.includes(featuredAgent.id) ? '❤️ 已收藏' : '🤍 收藏'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Catalog Grid */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-bold" style={{ color: '#d4e4fa' }}>
                {activeCategory === 'all' ? '所有 Agent' : CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory}
                <span className="text-sm font-mono ml-2" style={{ color: '#958ea0' }}>{filteredAgents.length} 個結果</span>
              </h2>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#958ea0' }}>
                <div style={{ fontSize: '32px', marginBottom: 12 }}>⏳</div>
                載入中...
              </div>
            ) : filteredAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    installed={installedMap[agent.id]}
                    onAction={handleAction}
                    isFavorite={favorites.includes(agent.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <section style={{ textAlign: 'center', padding: '48px 0', color: '#958ea0' }}>
                <div style={{ fontSize: '48px', marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: 8, color: '#d4e4fa' }}>找不到符合的 Agent</div>
                <div style={{ fontSize: '14px', marginBottom: 24 }}>試試其他關鍵字或分類</div>
                <button className="btn-primary" onClick={() => setShowImport(true)}>📦 從 GitHub 匯入</button>
              </section>
            )}
          </section>

          {/* FOOTER */}
          <footer className="text-center py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="font-black text-sm" style={{ color: '#d4e4fa' }}>AgentOS</span>
            <p className="text-xs mt-1" style={{ color: '#494454' }}>© 2026 AgentOS Platform. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
