import React from 'react'
import type { Deliberation } from '../types'
import { DEFAULT_COUNCILLORS, DEFAULT_CHAIRMAN, MODE_DESCRIPTIONS } from '../types'

export const NewDeliberation = React.memo(function NewDeliberation({
  question,
  setQuestion,
  mode,
  setMode,
  isRunning,
  canStart,
  onStart,
  onCancel,
  hasApiKey,
  hasModel,
}: {
  question: string
  setQuestion: (q: string) => void
  mode: Deliberation['mode']
  setMode: (m: Deliberation['mode']) => void
  isRunning: boolean
  canStart: boolean
  onStart: () => void
  onCancel: () => void
  hasApiKey: boolean
  hasModel: boolean
}) {
  return (
    <div>
      <button onClick={onCancel} className="no-drag" style={{
        background: 'none', border: 'none', color: '#958ea0', cursor: 'pointer', fontSize: '14px', marginBottom: '16px',
      }}>
        ← Back to list
      </button>

      <h1 style={{ color: '#d0bcff', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        New Deliberation
      </h1>
      <p style={{ color: '#958ea0', fontSize: '14px', marginBottom: '24px' }}>
        Ask a question and get perspectives from all 5 agents. The chairman will synthesise the best answer.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#d0bcff', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. Should AgentOS support a plugin system?"
          disabled={isRunning}
          className="no-drag"
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px 16px',
            background: 'rgba(18, 33, 49, 0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ color: '#d0bcff', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Mode
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(Object.keys(MODE_DESCRIPTIONS) as Deliberation['mode'][]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={isRunning}
              className="no-drag"
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: `1px solid ${mode === m ? '#a078ff' : 'rgba(255,255,255,0.1)'}`,
                background: mode === m ? 'rgba(160,120,255,0.2)' : 'transparent',
                color: mode === m ? '#d0bcff' : '#958ea0',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p style={{ color: '#958ea0', fontSize: '12px', marginTop: '6px' }}>
          {MODE_DESCRIPTIONS[mode]}
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ color: '#d0bcff', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Council Lineup
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DEFAULT_COUNCILLORS.map(c => (
            <div key={c.id} style={{
              padding: '6px 12px',
              background: 'rgba(18, 33, 49, 0.7)',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '12px',
              color: '#958ea0',
            }}>
              {c.name}
            </div>
          ))}
          <div style={{
            padding: '6px 12px',
            background: 'rgba(160,120,255,0.15)',
            borderRadius: '6px',
            border: '1px solid rgba(160,120,255,0.3)',
            fontSize: '12px',
            color: '#d0bcff',
            fontWeight: 600,
          }}>
            👑 {DEFAULT_CHAIRMAN.name}
          </div>
        </div>
      </div>

      {!hasApiKey && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,101,101,0.1)', borderRadius: '8px', border: '1px solid rgba(245,101,101,0.3)', marginBottom: '16px', fontSize: '13px', color: '#f56565' }}>
          ⚠️ API Key 未設定。請先到設定頁面設定 OpenRouter API Key。
        </div>
      )}
      {!hasModel && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,101,101,0.1)', borderRadius: '8px', border: '1px solid rgba(245,101,101,0.3)', marginBottom: '16px', fontSize: '13px', color: '#f56565' }}>
          ⚠️ 未選擇模型。請先到設定頁面選擇一個模型。
        </div>
      )}
      <button
        onClick={onStart}
        disabled={!canStart}
        className="no-drag"
        style={{
          padding: '12px 32px',
          background: isRunning ? 'rgba(160,120,255,0.3)' : 'linear-gradient(135deg, #a078ff, #0566d9)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: canStart ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          fontSize: '14px',
          opacity: canStart ? 1 : 0.5,
        }}
      >
        {isRunning ? '⏳ Running...' : '🚀 Start Deliberation'}
      </button>
    </div>
  )
})
