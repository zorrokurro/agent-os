import React from 'react'

export const Section = React.memo(function Section({ title, number, children }: { title: string; number: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(160,120,255,0.2)', border: '1px solid rgba(160,120,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#d0bcff',
        }}>
          {number}
        </div>
        <h3 style={{ color: '#d0bcff', fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
})
