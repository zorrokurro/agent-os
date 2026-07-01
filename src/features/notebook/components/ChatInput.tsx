import React from 'react'

interface Props {
  chatInput: string
  chatLoading: boolean
  onInputChange: (v: string) => void
  onSend: () => void
  onSummarize: () => void
  onExtractTags: () => void
  onGenerateOutline: () => void
  onDeepAnalysis: () => void
}

export const ChatInput = React.memo(function ChatInput({ chatInput, chatLoading, onInputChange, onSend, onSummarize, onExtractTags, onGenerateOutline, onDeepAnalysis }: Props) {
  return (
    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', padding: '10px 16px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { label: '生成大綱', fn: onGenerateOutline },
          { label: '摘要全文', fn: onSummarize },
          { label: '提取標籤', fn: onExtractTags },
          { label: '深入分析', fn: onDeepAnalysis },
        ].map(({ label, fn }) => (
          <button key={label} onClick={fn}
            style={{ padding: '3px 10px', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#958ea0', fontSize: '11px', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <textarea value={chatInput} onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder="問問題..." disabled={chatLoading} rows={1}
          style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0d8e8', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
        <button onClick={onSend} disabled={chatLoading || !chatInput.trim()}
          style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #a078ff, #0566d9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: chatLoading ? 'wait' : 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1, alignSelf: 'flex-end' }}>
          送
        </button>
      </div>
    </div>
  )
})
