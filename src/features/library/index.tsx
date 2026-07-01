import { useState } from 'react'
import { useLibrary } from './hooks/useLibrary'
import { useLibraryStreaming } from './hooks/useLibraryStreaming'
import { AgentSidebar } from './components/AgentSidebar'
import { AgentDetail } from './components/AgentDetail'
import { ControlsTab } from './components/ControlsTab'
import { LogsTab } from './components/LogsTab'
import { ConfigTab } from './components/ConfigTab'
import { DocsTab } from './components/DocsTab'
import type { AgentDetailTab } from './types'

type PageKey = 'brain' | 'library' | 'memory' | 'research' | 'store' | 'ump' | 'settings' | 'orchestrator' | 'council' | 'notebook'

export default function LibraryPage({ onInstall, onNavigate }: { onInstall: () => void; onNavigate?: (page: PageKey) => void }) {
  const lib = useLibrary()
  const streaming = useLibraryStreaming()
  const [detailTab, setDetailTab] = useState<AgentDetailTab>('controls')

  const handleCheckOllama = () => {
    lib.selectAgent(lib.selectedAgentId || '')
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <AgentSidebar
        agents={lib.agents}
        displayAgents={lib.displayAgents}
        favorites={lib.favorites}
        agentStatuses={lib.agentStatuses}
        selectedAgentId={lib.selectedAgentId}
        libTab={lib.libTab}
        ollamaStatus={lib.ollamaStatus}
        onSetLibTab={lib.setLibTab}
        onSelectAgent={lib.selectAgent}
        onToggleFavorite={lib.toggleFavorite}
        onInstall={onInstall}
        onCheckOllama={handleCheckOllama}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {lib.agent ? (
          <>
            <AgentDetail
              agent={lib.agent}
              agentStatus={lib.agentStatus}
              isFavorite={lib.favorites.includes(lib.agent.id)}
              onToggleAgent={() => lib.toggleAgent(lib.agent!)}
            />

            <div className="flex shrink-0" style={{ background: 'rgba(1,15,31,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {(['controls', 'logs', 'config', 'docs'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)} className={`tab-btn ${detailTab === t ? 'active' : 'inactive'}`}>
                  {t === 'controls' ? '控制台' : t === 'logs' ? '日誌' : t === 'config' ? '設定' : '文件'}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {detailTab === 'controls' && (
                <ControlsTab
                  agent={lib.agent}
                  agentStatus={lib.agentStatus}
                  streaming={streaming}
                  onToggleAgent={() => lib.toggleAgent(lib.agent!)}
                  onTabChange={setDetailTab}
                />
              )}
              {detailTab === 'logs' && <LogsTab agentId={lib.agent.id} />}
              {detailTab === 'config' && <ConfigTab agent={lib.agent} />}
              {detailTab === 'docs' && <DocsTab agent={lib.agent} />}
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
