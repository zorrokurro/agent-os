import React from 'react'
import type { AgentInfo, LibraryTab, OllamaStatus } from '../types'

interface AgentSidebarProps {
  agents: AgentInfo[]
  displayAgents: AgentInfo[]
  favorites: string[]
  agentStatuses: Record<string, string>
  selectedAgentId: string | null
  libTab: LibraryTab
  ollamaStatus: OllamaStatus
  onSetLibTab: (tab: LibraryTab) => void
  onSelectAgent: (id: string) => void
  onToggleFavorite: (agentId: string) => void
  onInstall: () => void
  onCheckOllama: () => void
}

export const AgentSidebar = React.memo(function AgentSidebar({
  agents,
  displayAgents,
  favorites,
  agentStatuses,
  selectedAgentId,
  libTab,
  ollamaStatus,
  onSetLibTab,
  onSelectAgent,
  onToggleFavorite,
  onInstall,
  onCheckOllama,
}: AgentSidebarProps) {
  return (
    <div style={{
      width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(1, 15, 31, 0.8)', borderRight: '1px solid rgba(255,255,255,0.1)'
    }}>
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#958ea0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>我的 Agent</h2>
      </div>

      <div style={{ display: 'flex', padding: '8px 12px', gap: '4px' }}>
        <button
          onClick={() => onSetLibTab('all')}
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
          onClick={() => onSetLibTab('favorites')}
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {displayAgents.map(a => {
          const status = agentStatuses[a.id] || 'stopped'
          const isSelected = selectedAgentId === a.id
          const isFav = favorites.includes(a.id)
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(a.id) }}
                style={{
                  flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', borderRadius: '0.25rem',
                  fontSize: 14, color: isFav ? '#d0bcff' : '#494454',
                }}
                title={isFav ? '取消收藏' : '加入收藏'}
              >
                {isFav ? '❤️' : '🤍'}
              </button>

              <button
                onClick={() => onSelectAgent(a.id)}
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

        {agents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#958ea0', fontSize: '14px', padding: '48px 16px' }}>
            <div style={{ fontSize: '36px', marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 600 }}>尚無 Agent</div>
            <button className="btn-primary btn-sm" style={{ marginTop: 12, padding: '8px 16px', fontSize: '13px' }} onClick={onInstall}>➕ 安裝第一個 Agent</button>
          </div>
        )}

        {libTab === 'favorites' && agents.length > 0 && displayAgents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#494454', fontSize: '13px', padding: '32px 16px' }}>
            <div style={{ fontSize: '28px', marginBottom: 8 }}>💜</div>
            <div>尚未收藏任何 Agent</div>
            <div style={{ marginTop: 4, fontSize: '12px' }}>到商城收藏 Agent 後會顯示在這裡</div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="btn-primary btn-sm" style={{ width: '100%', padding: '8px', fontSize: '13px' }} onClick={onInstall}>➕ 安裝新 Agent</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span className={`status-dot ${ollamaStatus.running ? 'running' : ollamaStatus.installed ? 'stopped' : 'error'}`} />
          <span style={{ color: '#958ea0' }}>Ollama {ollamaStatus.running ? '運行中' : ollamaStatus.installed ? '已停止' : '未安裝'}</span>
          <button onClick={onCheckOllama} style={{ marginLeft: 'auto', color: '#d0bcff', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>檢查</button>
        </div>
      </div>
    </div>
  )
})
