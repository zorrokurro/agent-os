import React, { useState, useEffect } from 'react'
import * as service from '../services/library.service'
import type { AgentInfo } from '../types'

interface DocsTabProps {
  agent: AgentInfo
}

export const DocsTab = React.memo(function DocsTab({ agent }: DocsTabProps) {
  const [docs, setDocs] = useState<{ description: string; readme: string }>({ description: '', readme: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    service.getAgentDocs(agent.id).then(result => {
      if (active) setDocs(result)
      if (active) setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [agent.id])

  if (loading) {
    return (
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <div style={{ color: '#494454', fontSize: '14px' }}>載入中...</div>
      </div>
    )
  }

  if (!docs.description && !docs.readme) {
    return (
      <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: 16 }}>{agent.name} 使用說明</h2>
        <div style={{ color: '#494454', fontSize: '14px' }}>此 Agent 未提供說明文件</div>
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
      <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: 16 }}>{agent.name} 使用說明</h2>
      <div style={{ color: '#958ea0', fontSize: '14px', lineHeight: '1.8' }}>
        {docs.description && (
          <p style={{ marginBottom: 16 }}>{docs.description}</p>
        )}
        {docs.readme && (
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
            {docs.readme}
          </div>
        )}
      </div>
    </div>
  )
})
