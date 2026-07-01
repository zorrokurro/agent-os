import React from 'react'
import type { AgentInfo } from '../types'

interface AgentDetailProps {
  agent: AgentInfo
  agentStatus: string
  isFavorite: boolean
  onToggleAgent: () => void
}

export const AgentDetail = React.memo(function AgentDetail({ agent, agentStatus, isFavorite, onToggleAgent }: AgentDetailProps) {
  return (
    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{agent.name}</h1>
          {isFavorite && <span style={{ fontSize: 16 }}>❤️</span>}
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
            onClick={onToggleAgent}
          >
            {agentStatus === 'running' ? '⏹ 停止' : '▶ 啟動'}
          </button>
        )}
      </div>
    </div>
  )
})
