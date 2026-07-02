import { useState, useRef, useEffect } from 'react'
import { sendToBrain } from '../../agents/BrainService'
import { useModelConfig } from '../../hooks/useModelConfig'
import ModelSelector from './ModelSelector'

interface Message {
  id: string
  role: 'user' | 'brain'
  content: string
  timestamp: number
  rounds?: number
  usedFusion?: boolean
}

type PageKey = 'brain' | 'library' | 'memory' | 'research' | 'store' | 'ump' | 'settings' | 'orchestrator' | 'council' | 'notebook'

interface BrainChatProps {
  onNavigate: (page: PageKey) => void
}

export default function BrainChat({ onNavigate }: BrainChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [useFusion, setUseFusion] = useState(true)
  const [useLoop, setUseLoop] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const { config, models, loading: configLoading, saveConfig } = useModelConfig()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      const res = await sendToBrain({ prompt: userMsg.content, useFusion, useLoop, modelConfig: config })
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'brain',
        content: res.result,
        timestamp: res.timestamp,
        rounds: res.rounds,
        usedFusion: res.usedFusion,
      }])

      const stored = JSON.parse(localStorage.getItem('agentOS:metrics') || '{"totalTasks":0,"totalToolCalls":0,"avgLoops":0,"count":0}')
      const newCount = stored.count + 1
      localStorage.setItem('agentOS:metrics', JSON.stringify({
        totalTasks: stored.totalTasks + 1,
        totalToolCalls: stored.totalToolCalls + 1,
        avgLoops: (stored.avgLoops * stored.count + res.rounds) / newCount,
        count: newCount,
      }))
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'brain',
        content: '發生錯誤，請確認 Ollama 是否運行中。',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  const pillOn = { background: '#EEEDFE', color: '#534AB7', borderColor: '#AFA9EC' }
  const pillOff = { background: 'transparent', color: '#958ea0', borderColor: 'rgba(255,255,255,0.12)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#7F77DD',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>psychology</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>Fusion-Loop 大腦</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {useFusion && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#EEEDFE', color: '#534AB7', fontWeight: 500 }}>
                Fusion · 2 panel
              </span>
            )}
            {useLoop && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#E1F5EE', color: '#0F6E56', fontWeight: 500 }}>
                Loop · max 3
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="no-drag" title="日誌" onClick={() => setShowLogs(v => !v)} style={{
          width: 32, height: 32, borderRadius: 6, border: 'none',
          background: showLogs ? 'rgba(127,119,221,0.15)' : 'transparent',
          color: showLogs ? '#d0bcff' : '#958ea0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>history</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button className="no-drag" title="模型設定" onClick={() => setShowModelSelector(v => !v)} style={{
            width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent',
            color: '#958ea0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
          </button>
          {showModelSelector && (
            <ModelSelector
              config={config}
              models={models}
              onSave={(newConfig) => { saveConfig(newConfig); setShowModelSelector(false) }}
              onClose={() => setShowModelSelector(false)}
            />
          )}
        </div>
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div style={{
          maxHeight: 200, overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)', padding: '10px 18px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#958ea0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            對話紀錄 ({messages.length})
          </div>
          {messages.length === 0 ? (
            <div style={{ fontSize: 12, color: '#958ea0', padding: '8px 0' }}>尚無紀錄</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...messages].reverse().map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11 }}>
                  <span style={{
                    color: msg.role === 'user' ? '#534AB7' : '#0F6E56', fontWeight: 600, flexShrink: 0, width: 40,
                  }}>
                    {msg.role === 'user' ? 'User' : 'Brain'}
                  </span>
                  <span style={{ color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.content}
                  </span>
                  <span style={{ color: '#64748b', flexShrink: 0 }}>{fmtTime(msg.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#958ea0' }}>交辦任務給 Fusion-Loop 大腦</span>
          </div>
        )}
        {messages.map(msg => msg.role === 'user' ? (
          <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                background: '#EEEDFE', border: '0.5px solid #CECBF6', color: '#3C3489',
                padding: '10px 14px', borderRadius: '10px 10px 2px 10px', fontSize: 13, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
              <div style={{ textAlign: 'right', marginTop: 3, fontSize: 10, color: '#958ea0' }}>
                {fmtTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ) : (
          <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ maxWidth: '90%' }}>
              <div style={{
                background: 'var(--muted, rgba(255,255,255,0.06))', border: '0.5px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0', padding: '10px 14px', borderRadius: '10px 10px 10px 2px',
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
              <div style={{ marginTop: 3, fontSize: 10, color: '#958ea0' }}>
                {fmtTime(msg.timestamp)} · Fusion-Loop{msg.rounds != null ? ` · Loop ${msg.rounds} 輪收斂` : ''}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#7F77DD',
                    animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#958ea0' }}>Fusion 合成中...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 18px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[
            { label: 'Fusion', active: useFusion, onClick: () => setUseFusion(v => !v) },
            { label: 'Loop', active: useLoop, onClick: () => setUseLoop(v => !v) },
            { label: '研究', active: false, onClick: () => onNavigate('research') },
          ].map(btn => (
            <button key={btn.label} className="no-drag" onClick={btn.onClick} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${btn.active ? '#AFA9EC' : 'rgba(255,255,255,0.12)'}`,
              fontWeight: 500, transition: 'all 0.15s',
              ...(btn.active ? pillOn : pillOff),
            }}>
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="輸入任務..."
            className="no-drag"
            style={{
              flex: 1, resize: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, lineHeight: 1.5, maxHeight: 120,
              background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button className="no-drag" onClick={handleSend} disabled={loading || !input.trim()} style={{
            width: 38, height: 38, borderRadius: 8, border: 'none',
            background: '#7F77DD', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0,
            transition: 'opacity 0.15s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_upward</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
