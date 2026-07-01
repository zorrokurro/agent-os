import React from 'react'
import type { Deliberation } from '../types'
import { Section } from './Section'
import { CouncillorCard } from './CouncillorCard'
import { StatusBadge } from './StatusBadge'

export const DeliberationDetail = React.memo(function DeliberationDetail({
  deliberation,
  onBack,
}: {
  deliberation: Deliberation
  onBack: () => void
}) {
  return (
    <div>
      <button onClick={onBack} className="no-drag" style={{
        background: 'none', border: 'none', color: '#958ea0', cursor: 'pointer', fontSize: '14px', marginBottom: '16px',
      }}>
        ← Back to list
      </button>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{ color: '#d0bcff', fontSize: '20px', fontWeight: 700, margin: 0, flex: 1 }}>
            {deliberation.question}
          </h1>
          <StatusBadge status={deliberation.status} />
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#958ea0', marginTop: '8px' }}>
          <span>Mode: {deliberation.mode}</span>
          <span>•</span>
          <span>{new Date(deliberation.createdAt).toLocaleString()}</span>
          {deliberation.completedAt && (
            <>
              <span>•</span>
              <span>Completed: {new Date(deliberation.completedAt).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      <Section title="Stage 1: Councillor Responses" number={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {deliberation.councillors.map((c, i) => (
            <CouncillorCard key={c.id} councillor={c} letter={String.fromCharCode(65 + i)} />
          ))}
        </div>
      </Section>

      {deliberation.status !== 'pending' && deliberation.status !== 'stage1' && (
        <Section title="Stage 2: Peer Review Rankings" number={2}>
          {Object.keys(deliberation.rankings).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(deliberation.rankings)
                .sort(([, a], [, b]) => b - a)
                .map(([id, score]) => {
                  const c = deliberation.councillors.find(x => x.id === id)
                  return (
                    <div key={id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                      background: 'rgba(18, 33, 49, 0.5)', borderRadius: '6px',
                    }}>
                      <span style={{ color: '#d0bcff', fontSize: '14px' }}>{c?.name || id}</span>
                      <span style={{ color: '#a078ff', fontSize: '14px', fontWeight: 600 }}>{score} pts</span>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p style={{ color: '#958ea0', fontSize: '14px' }}>Rankings pending...</p>
          )}
        </Section>
      )}

      {deliberation.synthesis && (
        <Section title="Stage 3: Chairman Synthesis" number={3}>
          <div style={{
            padding: '16px',
            background: 'rgba(160,120,255,0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(160,120,255,0.2)',
          }}>
            <div style={{ color: '#d0bcff', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {deliberation.synthesis}
            </div>
          </div>
        </Section>
      )}
    </div>
  )
})
