import { useEffect, useState } from 'react'
import type { MemoryItem, MemoryStats } from '../types'

interface UmpSearchResult {
  id: string
  content: string
  memory_type: string
  group_id: string | null
  tags: string[]
  importance: number
}

function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'projects' | 'conversations' | 'outputs'>('profile')
  const [editContent, setEditContent] = useState('')
  const [editFile, setEditFile] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UmpSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadMemory() }, [])

  const loadMemory = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.getMemoryItems()
      setItems(result.items)
      setStats(result.stats)
    } catch (e) { console.error('載入記憶層失敗:', e) }
    setLoading(false)
  }

  const openEdit = async (item: MemoryItem) => {
    setEditFile(item.path)
    setEditContent('載入中...')
    try {
      const result = await window.electronAPI.getMemoryItemContent(item.path)
      setEditContent(result.content || '')
    } catch { setEditContent('') }
  }
  const saveEdit = async () => {
    if (!editFile) return
    await window.electronAPI.saveMemoryItem(editFile, editContent)
    setEditFile(''); setEditContent('')
    await loadMemory()
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await window.electronAPI.umpHubSearch(searchQuery, { limit: 30 }) as UmpSearchResult[]
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
  }

  const isSearching = searchQuery.trim().length > 0
  const filteredItems = items.filter(i => i.type === activeTab)

  if (editFile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '13px', color: '#958ea0', fontFamily: 'JetBrains Mono, monospace' }}>{editFile}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary btn-sm" style={{ padding: '6px 16px', fontSize: '13px' }} onClick={() => setEditFile('')}>取消</button>
            <button className="btn-primary btn-sm" style={{ padding: '6px 16px', fontSize: '13px' }} onClick={saveEdit}>儲存</button>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px' }}>
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
            style={{ width: '100%', height: '100%', background: '#010f1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', padding: '16px', color: '#d4e4fa', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', resize: 'none', outline: 'none' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>🧠 記憶層</h1>
            <p style={{ fontSize: '13px', color: '#958ea0', marginTop: 4 }}>AgentOS 的永久記憶 — 所有 Agent 共享的知識庫</p>
          </div>
          <button className="btn-secondary btn-sm" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={loadMemory}>🔄 重新整理</button>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: '24px', marginTop: 12, fontSize: '12px', color: '#958ea0' }}>
            <div>檔案數: <span style={{ color: '#d4e4fa' }}>{stats.totalFiles}</span></div>
            <div>總大小: <span style={{ color: '#d4e4fa' }}>{(stats.totalSize / 1024).toFixed(1)} KB</span></div>
            <div>最後更新: <span style={{ color: '#d4e4fa' }}>{stats.lastUpdated || '從未'}</span></div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); if (e.key === 'Escape') clearSearch() }}
            placeholder="搜尋記憶..."
            style={{
              flex: 1, padding: '8px 14px', borderRadius: '0.25rem', fontSize: '13px',
              background: '#010f1f', border: '1px solid rgba(255,255,255,0.1)',
              color: '#d4e4fa', outline: 'none',
            }}
          />
          <button className="btn-secondary btn-sm" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={handleSearch} disabled={searching}>
            {searching ? '搜尋中...' : '搜尋'}
          </button>
          {isSearching && (
            <button className="btn-secondary btn-sm" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={clearSearch}>清除</button>
          )}
        </div>
      </div>

      <div className="flex shrink-0" style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { key: 'profile', label: '👤 使用者檔案' },
          { key: 'projects', label: '📁 專案記憶' },
          { key: 'conversations', label: '💬 對話摘要' },
          { key: 'outputs', label: '📄 產出歸檔' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-btn ${activeTab === t.key ? 'active' : 'inactive'}`}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#958ea0', padding: '48px' }}>載入中...</div>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#958ea0', padding: '48px' }}>
              <div style={{ fontSize: '36px', marginBottom: 12 }}>🔍</div>
              <div>找不到符合「{searchQuery}」的記憶</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: '#958ea0', marginBottom: 12 }}>
                找到 {searchResults.length} 筆結果
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.map((m) => (
                  <div key={m.id} className="glass-panel" style={{ borderRadius: '0.5rem', padding: '16px', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(208,188,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '1rem', background: 'rgba(99,102,241,0.15)', color: '#d0bcff', fontWeight: 600 }}>
                          {m.memory_type}
                        </span>
                        {m.group_id && (
                          <span style={{ fontSize: '11px', color: '#494454', fontFamily: 'JetBrains Mono, monospace' }}>{m.group_id}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#494454' }}>
                        重要性: {(m.importance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <pre style={{ fontSize: '12px', color: '#958ea0', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', fontFamily: 'JetBrains Mono, monospace' }}>
                      {m.content.substring(0, 300)}
                    </pre>
                    {m.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: 8, flexWrap: 'wrap' }}>
                        {m.tags.map(tag => (
                          <span key={tag} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '1rem', background: 'rgba(39,54,71,0.6)', color: '#958ea0' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#958ea0', padding: '48px' }}>
            <div style={{ fontSize: '36px', marginBottom: 12 }}>📭</div>
            <div>此分類尚無資料</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredItems.map((item, i) => (
              <div key={i} className="glass-panel" style={{ borderRadius: '0.5rem', padding: '16px', cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => openEdit(item)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(208,188,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#494454' }}>{item.modified}</div>
                </div>
                <pre style={{ fontSize: '12px', color: '#958ea0', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.content?.substring(0, 200) || '點擊查看內容...'}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryPage
