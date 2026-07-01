import React from 'react'
import type { Deliberation } from '../types'
import { StatusBadge } from './StatusBadge'

export const CouncilList = React.memo(function CouncilList({
  deliberations,
  onNew,
  onSelect,
}: {
  deliberations: Deliberation[]
  onNew: () => void
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#d0bcff', fontSize: '24px', fontWeight: 700, margin: 0 }}>
            🏛️ LLM Council
          </h1>
          <p style={{ color: '#958ea0', fontSize: '14px', marginTop: '4px' }}>
            Multi-model deliberation — Five agents debate. One chairman synthesises.
          </p>
        </div>
        <button
          onClick={onNew}
          className="no-drag"
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #a078ff, #0566d9)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          + New Deliberation
        </button>
      </div>

      {deliberations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#958ea0',
          background: 'rgba(18, 33, 49, 0.5)',
          borderRadius: '12px',
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏛️</div>
          <h3 style={{ color: '#d0bcff', marginBottom: '8px' }}>No deliberations yet</h3>
          <p style={{ fontSize: '14px' }}>
            Start a new deliberation to get multi-agent perspectives on important decisions.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {deliberations.map(d => (
            <div
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="no-drag"
              style={{
                padding: '16px 20px',
                background: 'rgba(18, 33, 49, 0.7)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: '#d0bcff', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>
                    {d.question.length > 80 ? d.question.substring(0, 80) + '...' : d.question}
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#958ea0' }}>
                    <span>Mode: {d.mode}</span>
                    <span>•</span>
                    <span>{new Date(d.createdAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>{d.councillors.length} councillors</span>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
