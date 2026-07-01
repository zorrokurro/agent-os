import React from 'react'

export const StatusBadge = React.memo(function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(153,153,153,0.2)', color: '#999', label: 'Pending' },
    stage1: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 1' },
    stage2: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 2' },
    stage3: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 3' },
    complete: { bg: 'rgba(72,187,120,0.2)', color: '#48bb78', label: 'Complete' },
    error: { bg: 'rgba(245,101,101,0.2)', color: '#f56565', label: 'Error' },
    idle: { bg: 'rgba(153,153,153,0.2)', color: '#999', label: 'Idle' },
    thinking: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Thinking' },
    done: { bg: 'rgba(72,187,120,0.2)', color: '#48bb78', label: 'Done' },
  }
  const c = config[status] || config.pending
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px',
      background: c.bg, color: c.color,
      fontSize: '11px', fontWeight: 600,
    }}>
      {c.label}
    </span>
  )
})
