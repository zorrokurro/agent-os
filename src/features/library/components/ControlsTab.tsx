import React, { useState, useEffect } from 'react'
import { formatModelLabel } from '../../../hooks/useModelConfig'
import type { AgentInfo } from '../types'
import type { useLibraryStreaming } from '../hooks/useLibraryStreaming'

interface ControlsTabProps {
  agent: AgentInfo
  agentStatus: string
  streaming: ReturnType<typeof useLibraryStreaming>
  onToggleAgent: () => void
  onTabChange: (tab: 'controls' | 'logs' | 'config' | 'docs') => void
}

export const ControlsTab = React.memo(function ControlsTab({ agent, agentStatus, streaming, onToggleAgent, onTabChange }: ControlsTabProps) {
  const [input, setInput] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')

  useEffect(() => {
    Promise.all([
      window.electronAPI.listModels(),
      window.electronAPI.listApiModels().catch((): string[] => []),
    ]).then(([ollama, api]) => {
      const all = [...ollama, ...api]
      setModels(all)
      if (all.length > 0 && !selectedModel) setSelectedModel(all[0])
    })
  }, [])

  const handleSend = async () => {
    if (!input.trim() || streaming.loading) return
    const task = input.trim()
    setInput('')
    await streaming.sendTask(task, agent.name, agent.description, selectedModel || models[0] || 'llama3.1:8b', streaming.messages)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div className="glass-panel" style={{ flex: 1, minHeight: '300px', overflowY: 'auto', borderRadius: '0.5rem', padding: '20px' }}>
        {streaming.messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: 480, padding: '24px', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{agent.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{agent.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span className={`status-dot ${agentStatus}`} style={{ width: 7, height: 7, borderRadius: '50%', background: agentStatus === 'running' ? '#5c8a2a' : '#958ea0', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: agentStatus === 'running' ? '#5c8a2a' : '#958ea0' }}>{agentStatus === 'running' ? '運行中' : '已停止'}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#958ea0', lineHeight: '1.6' }}>{agent.description}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {agent.runtimeType !== 'external' && (
                  <button
                    className={agentStatus === 'running' ? 'btn-danger' : 'btn-primary'}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
                    onClick={onToggleAgent}
                  >
                    {agentStatus === 'running' ? '⏹ 停止' : '▶ 啟動'}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
                  onClick={() => onTabChange('logs')}
                >
                  📋 查看日誌
                </button>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#494454' }}>從這裡發送任務給 {agent.name}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {streaming.messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px', borderRadius: '0.5rem', fontSize: '14px',
                  background: msg.role === 'user' ? 'rgba(160, 120, 255, 0.2)' : 'rgba(39, 54, 71, 0.5)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(160, 120, 255, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: msg.role === 'user' ? '#d0bcff' : '#d4e4fa',
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            ))}
            {streaming.loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '12px 16px', borderRadius: '0.5rem', fontSize: '14px', background: 'rgba(39,54,71,0.5)', color: '#958ea0' }}>思考中...</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {models.length > 1 && (
          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: '0.25rem', fontSize: '13px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa', minWidth: 160 }}>
            {models.map(m => <option key={m} value={m}>{formatModelLabel(m)}</option>)}
          </select>
        )}
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="輸入任務..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
        />
        <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }} onClick={handleSend} disabled={streaming.loading || !selectedModel}>
          {streaming.loading ? '⏳' : '送出'}
        </button>
      </div>
    </div>
  )
})
