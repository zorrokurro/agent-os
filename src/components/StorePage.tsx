import { useState, useRef, useEffect } from 'react'

// ---------------------------------------------------------------------------
// GitHub Installer Page
// ---------------------------------------------------------------------------

interface RepoAnalysis {
  name: string
  description: string
  stack: 'node' | 'python' | 'unknown'
  installCommands: string[]
}

const RECOMMENDED_PROJECTS = [
  { name: 'OpenCode', url: 'https://github.com/sst/opencode', tags: ['程式碼'] },
  { name: 'Headroom', url: 'https://github.com/chopratejas/headroom', tags: ['AI'] },
  { name: 'Odysseus', url: 'https://github.com/pewdiepie-archdaemon/odysseus', tags: ['workspace'] },
  { name: 'Hermes', url: 'https://github.com/zorrokurro/hermes', tags: ['agent'] },
]

const STACK_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  node: { label: 'Node.js', color: '#5c8a2a', bg: 'rgba(92,138,42,0.15)' },
  python: { label: 'Python', color: '#0566d9', bg: 'rgba(5,102,217,0.15)' },
  unknown: { label: '未知', color: '#958ea0', bg: 'rgba(149,142,160,0.15)' },
}

export default function StorePage() {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installLogs, setInstallLogs] = useState<string[]>([])
  const [installResult, setInstallResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [installLogs])

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setAnalyzing(true)
    setAnalysis(null)
    setAnalysisError(null)
    setInstallResult(null)
    setInstallLogs([])
    try {
      const result = await window.electronAPI.githubAnalyze(url.trim())
      setAnalysis(result)
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : String(e))
    }
    setAnalyzing(false)
  }

  const handleInstall = async () => {
    if (!url.trim()) return
    setInstalling(true)
    setInstallLogs([])
    setInstallResult(null)
    try {
      const result = await window.electronAPI.githubInstall(url.trim(), (line: string) => {
        setInstallLogs(prev => [...prev, line])
      })
      setInstallResult(result)
    } catch (e: unknown) {
      setInstallResult({ success: false, error: e instanceof Error ? e.message : String(e) })
      setInstallLogs(prev => [...prev, `❌ 錯誤: ${e instanceof Error ? e.message : String(e)}`])
    }
    setInstalling(false)
  }

  const handleQuickInstall = (projectUrl: string) => {
    setUrl(projectUrl)
    setAnalysis(null)
    setAnalysisError(null)
    setInstallResult(null)
    setInstallLogs([])
    // Auto-analyze
    setTimeout(async () => {
      setAnalyzing(true)
      try {
        const result = await window.electronAPI.githubAnalyze(projectUrl)
        setAnalysis(result)
      } catch (e: unknown) {
        setAnalysisError(e instanceof Error ? e.message : String(e))
      }
      setAnalyzing(false)
    }, 100)
  }

  const stackInfo = analysis ? STACK_LABELS[analysis.stack] || STACK_LABELS.unknown : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div className="max-w-[900px] mx-auto space-y-8">

          {/* Page Header */}
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#d4e4fa' }}>GitHub 安裝器</h1>
            <p style={{ fontSize: '14px', color: '#958ea0', marginTop: '4px' }}>
              貼上任何 GitHub 專案網址，自動安裝
            </p>
          </div>

          {/* Install Input Section */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !analyzing && !installing && handleAnalyze()}
                placeholder="https://github.com/username/repo"
                style={{
                  flex: 1, padding: '14px 18px', borderRadius: '0.5rem',
                  background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#d4e4fa', fontSize: '15px', outline: 'none', fontFamily: "'Consolas', monospace",
                }}
              />
              <button
                onClick={handleAnalyze}
                disabled={analyzing || installing || !url.trim()}
                style={{
                  padding: '14px 28px', borderRadius: '0.5rem', border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontSize: '14px', fontWeight: 600, cursor: analyzing || installing ? 'wait' : 'pointer',
                  opacity: analyzing || installing || !url.trim() ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {analyzing ? '分析中...' : '🔍 分析'}
              </button>
            </div>

            {/* Analysis Error */}
            {analysisError && (
              <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '0.5rem', background: 'rgba(196,58,58,0.15)', border: '1px solid rgba(196,58,58,0.3)', color: '#c43a3a', fontSize: '13px' }}>
                {analysisError}
              </div>
            )}

            {/* Analysis Result */}
            {analysis && (
              <div style={{ marginTop: '20px', padding: '20px', borderRadius: '0.5rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#d4e4fa', margin: 0 }}>{analysis.name}</h3>
                    {analysis.description && (
                      <p style={{ fontSize: '13px', color: '#958ea0', marginTop: '4px', marginBottom: 0 }}>{analysis.description}</p>
                    )}
                  </div>
                  {stackInfo && (
                    <span style={{ padding: '4px 12px', borderRadius: '2rem', fontSize: '12px', fontWeight: 600, color: stackInfo.color, background: stackInfo.bg, border: `1px solid ${stackInfo.color}33` }}>
                      {stackInfo.label}
                    </span>
                  )}
                </div>

                {analysis.installCommands.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#958ea0', marginBottom: '6px' }}>預計執行的指令：</div>
                    {analysis.installCommands.map((cmd, i) => (
                      <code key={i} style={{ display: 'block', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', color: '#d0bcff', fontSize: '13px', fontFamily: "'Consolas', monospace", marginBottom: '4px' }}>
                        {cmd}
                      </code>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleInstall}
                  disabled={installing}
                  style={{
                    padding: '10px 24px', borderRadius: '0.5rem', border: 'none',
                    background: installing ? 'rgba(92,138,42,0.3)' : 'linear-gradient(135deg, #5c8a2a, #4c6b22)',
                    color: '#fff', fontSize: '14px', fontWeight: 600, cursor: installing ? 'wait' : 'pointer',
                    opacity: installing ? 0.6 : 1,
                  }}
                >
                  {installing ? '⏳ 安裝中...' : '✅ 確認安裝'}
                </button>
              </div>
            )}

            {/* Install Progress */}
            {installLogs.length > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', color: '#958ea0', marginBottom: '8px', fontWeight: 600 }}>安裝進度</div>
                {installLogs.map((log, i) => (
                  <div key={i} style={{ fontSize: '12px', fontFamily: "'Consolas', monospace", color: log.startsWith('✅') ? '#5c8a2a' : log.startsWith('❌') ? '#c43a3a' : log.startsWith('⚠️') ? '#d0bcff' : '#cbc3d7', marginBottom: '2px', lineHeight: 1.6 }}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            {/* Install Result */}
            {installResult && (
              <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '0.5rem', background: installResult.success ? 'rgba(92,138,42,0.15)' : 'rgba(196,58,58,0.15)', border: `1px solid ${installResult.success ? 'rgba(92,138,42,0.3)' : 'rgba(196,58,58,0.3)'}`, color: installResult.success ? '#5c8a2a' : '#c43a3a', fontSize: '13px', fontWeight: 600 }}>
                {installResult.success ? '✅ 安裝完成' : `❌ 安裝失敗: ${installResult.error}`}
              </div>
            )}
          </div>

          {/* Recommended Projects */}
          <section>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#d4e4fa', marginBottom: '16px' }}>推薦專案</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RECOMMENDED_PROJECTS.map(project => (
                <div
                  key={project.url}
                  className="glass-panel"
                  style={{ padding: '16px 20px', borderRadius: '0.75rem', cursor: 'default' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#d4e4fa', margin: 0 }}>{project.name}</h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        {project.tags.map(tag => (
                          <span key={tag} style={{ padding: '2px 8px', borderRadius: '2rem', fontSize: '10px', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#d0bcff' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickInstall(project.url)}
                      disabled={installing}
                      style={{
                        padding: '8px 16px', borderRadius: '0.5rem', border: 'none',
                        background: 'linear-gradient(135deg, #5c8a2a, #4c6b22)',
                        color: '#fff', fontSize: '12px', fontWeight: 600, cursor: installing ? 'wait' : 'pointer',
                        opacity: installing ? 0.5 : 1, transition: 'opacity 0.15s', whiteSpace: 'nowrap',
                      }}
                    >
                      ⬇ 一鍵安裝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="font-black text-sm" style={{ color: '#d4e4fa' }}>AgentOS</span>
            <p className="text-xs mt-1" style={{ color: '#494454' }}>© 2026 AgentOS Platform. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
