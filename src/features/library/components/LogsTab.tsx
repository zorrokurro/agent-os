import React, { useState, useEffect } from 'react'
import * as service from '../services/library.service'

interface LogsTabProps {
  agentId: string
}

export const LogsTab = React.memo(function LogsTab({ agentId }: LogsTabProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const result = await service.getAgentLogs(agentId)
        if (active) setLogs(result.logs)
      } catch {
        if (active) setLogs([])
      }
      if (active) setLoading(false)
    }
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [agentId])

  return (
    <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px', height: '100%' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', minHeight: '400px', maxHeight: '600px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ color: '#494454' }}>載入中...</div>
        ) : logs.length > 0 ? logs.map((line, i) => (
          <div key={i} style={{ padding: '2px 0', color: line.includes('[ERR]') ? '#c43a3a' : '#958ea0' }}>{line}</div>
        )) : (
          <div style={{ color: '#494454' }}>尚無日誌</div>
        )}
      </div>
    </div>
  )
})
