import { useEffect } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  chatLoading: boolean
  chatEndRef: React.RefObject<HTMLDivElement>
}

export function ChatMessages({ messages, chatLoading, chatEndRef }: Props) {
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatEndRef])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {messages.length === 0 && (
        <div style={{ color: '#958ea0', fontSize: '12px', textAlign: 'center', padding: '40px 20px', lineHeight: 1.8 }}>
          基於這份筆記的內容<br />向 AI 提問
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <div style={{ maxWidth: msg.role === 'user' ? '75%' : '90%' }}>
            {msg.role === 'assistant' && (
              <div style={{ fontSize: '10px', color: '#10b981', marginBottom: '3px', fontWeight: 600 }}>AI</div>
            )}
            <div style={{
              background: msg.role === 'user' ? '#EEEDFE' : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user' ? '0.5px solid #CECBF6' : '0.5px solid rgba(255,255,255,0.06)',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              padding: msg.role === 'user' ? '8px 12px' : '10px 13px',
              fontSize: '13px', lineHeight: 1.6,
              color: msg.role === 'user' ? '#3C3489' : '#e0d8e8',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
            {msg.type && msg.type !== 'chat' && msg.role === 'assistant' && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                <button onClick={() => navigator.clipboard.writeText(msg.content)}
                  style={{ padding: '3px 8px', borderRadius: '4px', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>複製</button>
              </div>
            )}
          </div>
        </div>
      ))}
      {chatLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
          <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 600 }}>AI</span>
          <span style={{ fontSize: '12px', color: '#958ea0' }}>
            <span style={{ animation: 'orch-spin 1s linear infinite', display: 'inline-block' }}>⟳</span> 思考中...
          </span>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  )
}
