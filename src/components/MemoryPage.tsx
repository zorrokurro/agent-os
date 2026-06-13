import { useEffect, useState } from 'react'
import type { MemoryItem, MemoryStats } from '../types'

function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'projects' | 'conversations' | 'outputs'>('profile')
  const [editContent, setEditContent] = useState('')
  const [editFile, setEditFile] = useState('')

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
