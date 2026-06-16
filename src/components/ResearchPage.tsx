import { useState, useEffect } from 'react'
import type { ResearchReport } from '../types'

interface ResearchProgress { stage: 'idle' | 'searching' | 'generating' | 'done' | 'error'; message: string; percent: number }

const SOURCE_OPTIONS = [
  { key: 'news', label: '🌍 國際新聞', default: true },
  { key: 'zh_news', label: '🇹🇼 台灣新聞', default: true },
  { key: 'arxiv', label: '📄 學術論文', default: true },
  { key: 'web', label: '🔍 網路搜尋', default: true },
  { key: 'youtube', label: '🎬 YouTube', default: false },
  { key: 'github', label: '💻 GitHub', default: false },
  { key: 'hackernews', label: '👨‍💻 HN 討論', default: true },
]

function ResearchPage() {
  const [query, setQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(SOURCE_OPTIONS.filter(o => o.default).map(o => o.key))
  const [progress, setProgress] = useState<ResearchProgress>({ stage: 'idle', message: '', percent: 0 })
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [history, setHistory] = useState<Array<{ query: string; date: string; path: string }>>([])
  const [activeTab, setActiveTab] = useState<'write' | 'preview' | 'history'>('write')

  useEffect(() => { loadHistory() }, [])
  const loadHistory = async () => {
    try {
      const memory = await window.electronAPI.getMemoryItems()
      const reports = memory.items.filter((i: any) => i.path.includes('research'))
      setHistory(reports.map((r: any) => ({ query: r.name, date: r.modified, path: r.path })))
    } catch { /* ignore */ }
  }

  const toggleSource = (key: string) => { setSelectedSources(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }

  const startResearch = async () => {
    if (!query.trim()) return
    setReport(null)
    setProgress({ stage: 'searching', message: '正在搜尋多個平台...', percent: 10 })
    try {
      const result = await window.electronAPI.runResearch({ query: query.trim(), sources: selectedSources })
      setProgress({ stage: 'done', message: `完成！找到 ${(result.research as any).results?.length ?? 0} 筆資料`, percent: 100 })
      setReport(result.report as ResearchReport)
      setActiveTab('preview')
      await loadHistory()
    } catch (e) { setProgress({ stage: 'error', message: `錯誤: ${e}`, percent: 0 }) }
  }

  const openReport = async (path: string) => {
    try {
      const memory = await window.electronAPI.getMemoryItems()
      const item = memory.items.find((i: any) => i.path === path)
      if (item) {
        setReport({ title: item.name, abstract: '', sections: [{ heading: item.name, level: 1, content: item.content || '', sources: [] }], references: [], metadata: { query: item.name, generatedAt: item.modified, totalSources: 0, sourcesBreakdown: {}, reportPath: path } })
        setActiveTab('preview')
      }
    } catch (e) { console.error('載入報告失敗:', e) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>🔬 研究模式</h1>
        <p style={{ fontSize: '13px', color: '#958ea0', marginTop: 4 }}>多平台深度研究，自動生成論文格式報告</p>
      </div>

      <div className="flex shrink-0" style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { key: 'write', label: '📝 新研究' },
          { key: 'preview', label: '📄 報告預覽' },
          { key: 'history', label: '📚 歷史報告' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-btn ${activeTab === t.key ? 'active' : 'inactive'}`}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'write' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>研究主題</h3>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="輸入研究主題或問題..."
                style={{ width: '100%', padding: '12px 16px', borderRadius: '0.25rem', fontSize: '16px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
                onKeyDown={e => e.key === 'Enter' && startResearch()}
              />
            </div>
            <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>搜尋來源</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SOURCE_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => toggleSource(opt.key)}
                    style={{ padding: '8px 14px', borderRadius: '0.25rem', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                      background: selectedSources.includes(opt.key) ? 'rgba(160, 120, 255, 0.2)' : '#0d1c2d',
                      color: selectedSources.includes(opt.key) ? '#d0bcff' : '#958ea0',
                      border: `1px solid ${selectedSources.includes(opt.key) ? 'rgba(160,120,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >{opt.label}</button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: '#494454', marginTop: 8 }}>已選擇 {selectedSources.length} 個來源</div>
            </div>
            {progress.stage !== 'idle' && (
              <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '14px', color: '#958ea0' }}>{progress.message}</span>
                  <span style={{ fontSize: '14px', color: '#d0bcff' }}>{progress.percent}%</span>
                </div>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} /></div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '14px' }} onClick={startResearch} disabled={!query.trim() || selectedSources.length === 0 || progress.stage === 'searching'}>
                {progress.stage === 'searching' ? '⏳ 研究中...' : '🔬 開始研究'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div>
            {report ? (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: 8 }}>{report.title}</h1>
                  <div style={{ fontSize: '13px', color: '#494454', display: 'flex', gap: 16 }}>
                    <span>📅 {report.metadata.generatedAt.split('T')[0]}</span>
                    <span>📊 {report.metadata.totalSources} 筆來源</span>
                  </div>
                </div>
                <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px', marginBottom: 20 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d4e4fa', marginBottom: 12 }}>來源統計</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {Object.entries(report.metadata.sourcesBreakdown).map(([source, count]) => (
                      <span key={source} style={{ padding: '4px 12px', borderRadius: '0.25rem', fontSize: '13px', background: '#0d1c2d', color: '#d4e4fa', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {source}: <span style={{ color: '#d0bcff' }}>{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
                {report.sections.map((section, i) => (
                  <div key={i} style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: section.level === 1 ? '20px' : '16px', fontWeight: 700, color: '#fff', marginBottom: 12 }}>{section.heading}</h2>
                    <div style={{ color: '#958ea0', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>                    {section.content.length > 2000
                      ? section.content.substring(0, 2000) + '\n\n...（內容過長，已截斷）'
                      : section.content}</div>
                  </div>
                ))}
                {report.references.length > 0 && (
                  <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: 16 }}>參考文獻</h2>
                    {report.references.map(ref => (
                      <div key={ref.index} style={{ fontSize: '14px', marginBottom: 12 }}>
                        <span style={{ color: '#d0bcff', marginRight: 8 }}>[{ref.index}]</span>
                        <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ color: '#d4e4fa', textDecoration: 'none' }}>{ref.title}</a>
                        <span style={{ color: '#494454', marginLeft: 8 }}>— {ref.source}{ref.date ? ` (${ref.date})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#958ea0', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: 12 }}>📄</div>
                <div>尚無報告，請先執行研究</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((item, i) => (
                  <div key={i} className="glass-panel" style={{ borderRadius: '0.5rem', padding: '16px', cursor: 'pointer' }} onClick={() => openReport(item.path)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(208,188,255,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: '#d4e4fa', fontWeight: 600 }}>{item.query}</div>
                        <div style={{ fontSize: '12px', color: '#494454', marginTop: 4 }}>{item.date}</div>
                      </div>
                      <span style={{ color: '#d0bcff' }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#958ea0', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: 12 }}>📚</div>
                <div>尚無歷史報告</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ResearchPage
