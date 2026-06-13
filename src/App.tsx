import { useState, useEffect } from 'react';
import LibraryPage from './components/LibraryPage';
import InstallPage from './components/InstallPage';
import MemoryPage from './components/MemoryPage';
import ResearchPage from './components/ResearchPage';
import StorePage from './components/StorePage';
import SettingsPage from './components/SettingsPage';
import UMPage from './components/UMPage';
import SystemAgentsPage from './components/SystemAgentsPage';
import OrchestratorPage from './pages/OrchestratorPage';
import CouncilPage from './components/CouncilPage';
import NotebookPage from './components/NotebookPage';
import CurrentTimeButton from './components/CurrentTimeButton';

type PageKey = 'library' | 'memory' | 'research' | 'store' | 'ump' | 'sysagents' | 'settings' | 'orchestrator' | 'council' | 'notebook'

function applyDarkClass(darkMode: boolean) {
  if (darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function App() {
  const [page, setPage] = useState<PageKey>('library')
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    // Apply initial theme from stored settings
    window.electronAPI.getSettings().then((s) => {
      if (s && typeof s.darkMode === 'boolean') {
        applyDarkClass(s.darkMode)
      } else {
        applyDarkClass(true) // default dark
      }
    }).catch(() => applyDarkClass(true))

    // Listen for runtime theme changes
    const unsub = window.electronAPI.onThemeChanged((darkMode: boolean) => {
      applyDarkClass(darkMode)
    })
    return unsub
  }, [])

  const handleInstallComplete = () => {
    setShowInstall(false)
  }

  if (showInstall) {
    return <InstallPage onComplete={handleInstallComplete} onClose={() => setShowInstall(false)} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#051424' }}>
      {/* 側邊欄導航 — AIVault 風格 */}
      <nav style={{
        width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'rgba(18, 33, 49, 0.7)', backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Logo */}
        <div className="drag-region" style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="no-drag" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1 }}>A</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>AgentOS</span>
          </div>
        </div>

        {/* Current Time */}
        <div style={{ padding: '12px 16px 8px' }}>
          <CurrentTimeButton label="Time" />
        </div>

        {/* 主導航 */}
        <div style={{ flex: 1, padding: '12px' }}>
          <div style={{ padding: '0 8px 8px', fontSize: '11px', fontWeight: 600, color: '#958ea0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Menu
          </div>
          <NavButton active={page === 'library'} onClick={() => setPage('library')} icon="inventory_2" label="收藏庫" />
          <NavButton active={page === 'memory'} onClick={() => setPage('memory')} icon="psychology" label="記憶層" />
          <NavButton active={page === 'notebook'} onClick={() => setPage('notebook')} icon="menu_book" label="Notebook" />
          <NavButton active={page === 'research'} onClick={() => setPage('research')} icon="analytics" label="研究模式" />
          <div style={{ margin: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          <NavButton active={page === 'store'} onClick={() => setPage('store')} icon="storefront" label="商城" />
          <NavButton active={page === 'ump'} onClick={() => setPage('ump')} icon="hub" label="UMP 記憶協議" />
          <NavButton active={page === 'sysagents'} onClick={() => setPage('sysagents')} icon="radar" label="系統 Agent 偵測" />
          <div style={{ margin: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          <NavButton active={page === 'orchestrator'} onClick={() => setPage('orchestrator')} icon="hub" label="Orchestrator" />
          <NavButton active={page === 'council'} onClick={() => setPage('council')} icon="groups" label="LLM Council" />
        </div>

        {/* 底部 */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <NavButton active={page === 'settings'} onClick={() => setPage('settings')} icon="settings" label="設定" />
        </div>
      </nav>

      {/* 主內容 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="drag-region h-10 shrink-0" style={{ background: 'rgba(5, 20, 36, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {page === 'library' && <LibraryPage onInstall={() => setShowInstall(true)} />}
          {page === 'memory' && <MemoryPage />}
          {page === 'notebook' && <NotebookPage />}
          {page === 'research' && <ResearchPage />}
          {page === 'store' && <StorePage />}
          {page === 'ump' && <UMPage />}
          {page === 'sysagents' && <SystemAgentsPage />}
          {page === 'orchestrator' && <OrchestratorPage />}
          {page === 'council' && <CouncilPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}

function NavButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string
}) {
  return (
    <button
      onClick={onClick}
      className="no-drag"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '10px 12px', borderRadius: '0.25rem',
        background: active ? 'rgba(208, 188, 255, 0.15)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: active ? '#d0bcff' : '#cbc3d7',
        fontWeight: active ? 600 : 400,
        fontSize: '14px',
        marginBottom: '2px',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: 20,
        color: active ? '#d0bcff' : '#958ea0',
        fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
      }}>{icon}</span>
      {label}
    </button>
  )
}

export default App
