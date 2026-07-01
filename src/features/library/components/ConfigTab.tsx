import React, { useState, useEffect } from 'react'
import { formatModelLabel } from '../../../hooks/useModelConfig'
import type { AgentInfo } from '../types'

interface ConfigTabProps {
  agent: AgentInfo
}

export const ConfigTab = React.memo(function ConfigTab({ agent }: ConfigTabProps) {
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    Promise.all([
      window.electronAPI.listModels(),
      window.electronAPI.listApiModels().catch((): string[] => []),
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
})
