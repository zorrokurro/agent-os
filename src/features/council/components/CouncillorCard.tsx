import React from 'react'
import type { Councillor } from '../types'
import { StatusBadge } from './StatusBadge'

export const CouncillorCard = React.memo(function CouncillorCard({ councillor, letter }: { councillor: Councillor; letter: string }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: 'rgba(18, 33, 49, 0.7)',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '6px',
            background: 'rgba(160,120,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#d0bcff',
          }}>
            {letter}
          </div>
          <span style={{ color: '#d0bcff', fontSize: '14px', fontWeight: 600 }}>{councillor.name}</span>
        </div>
        <StatusBadge status={councillor.status} />
      </div>
      {councillor.response && (
        <div style={{ color: '#c0b8d0', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {councillor.response}
        </div>
      )}
      {councillor.status === 'thinking' && (
        <div style={{ color: '#958ea0', fontSize: '13px' }}>⏳ Thinking...</div>
      )}
    </div>
  )
})
