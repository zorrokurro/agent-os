import { useState, useEffect } from 'react'
import type { AgentInfo } from '../../types'

interface PanelAgent {
  id: string
  name: string
  role: string
  color: string
  status: 'active' | 'running' | 'idle' | 'stopped'
  load: number
}

const COLOR_POOL = ['purple', 'teal', 'blue', 'coral', 'gray']

const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  purple: { bg: '#EEEDFE', fg: '#534AB7' },
  teal: { bg: '#E1F5EE', fg: '#0F6E56' },
  blue: { bg: '#E6F1FB', fg: '#185FA5' },
  coral: { bg: '#FAECE7', fg: '#993C1D' },
  gray: { bg: '#D3D1C7', fg: '#444441' },
}

const STATUS_COLOR: Record<string, string> = {
  running: '#1D9E75',
  active: '#7F77DD',
  idle: '#B4B2A9',
  stopped: '#B4B2A9',
}

const ROLE_MAP: Record<string, string> = {
  hermes: 'Supervisor · 調度',
  opencode: '程式執行',
  openhuman: '人類介面',
  headroom: 'LLM Proxy',
}

function mapStatus(s: AgentInfo['status']): PanelAgent['status'] {
  if (s === 'running') return 'running'
  return 'idle'
}

interface Metrics {
  totalTasks: number
  totalToolCalls: number
  avgLoops: number
}

function loadMetrics(): Metrics {
  try {
    const raw = localStorage.getItem('agentOS:metrics')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        totalTasks: parsed.totalTasks ?? 0,
        totalToolCalls: parsed.totalToolCalls ?? 0,
        avgLoops: parsed.avgLoops ?? 0,
      }
    }
  } catch { /* ignore */ }
  return { totalTasks: 0, totalToolCalls: 0, avgLoops: 0 }
}

export default function AgentPanel() {
  const [agents, setAgents] = useState<PanelAgent[]>([])
  const [metrics, setMetrics] = useState<Metrics>(loadMetrics)

  const fetchAgents = async () => {
    try {
      const result: AgentInfo[] = await window.electronAPI.getAgents()
      const mapped: PanelAgent[] = result.map((a, i) => ({
        id: a.id,
        name: a.name,
        role: ROLE_MAP[a.id] || a.description?.slice(0, 20) || 'Agent',
        color: COLOR_POOL[i % COLOR_POOL.length],
        status: mapStatus(a.status),
        load: a.status === 'running' ? 40 : 0,
      }))
      setAgents(mapped)
    } catch {
      setAgents([])
    }
  }

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(() => {
      fetchAgents()
      setMetrics(loadMetrics())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(18,33,49,0.4)' }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#958ea0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          已安裝 Agents
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {agents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#958ea0', fontSize: 12, padding: '24px 8px' }}>
            尚無已安裝的 Agent
          </div>
        )}
        {agents.map(agent => {
          const c = COLOR_MAP[agent.color] ?? COLOR_MAP.gray
          return (
            <div key={agent.id} style={{
              background: 'var(--background, #0a1929)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: c.bg, color: c.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>
                  {agent.name.slice(0, 2)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>{agent.name}</span>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: STATUS_COLOR[agent.status] ?? STATUS_COLOR.idle,
                  boxShadow: agent.status === 'active' ? '0 0 6px #7F77DD' : undefined,
                  animation: agent.status === 'active' ? 'pulse 2s ease-in-out infinite' : undefined,
                  flexShrink: 0,
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#958ea0', marginTop: 2 }}>{agent.role}</div>
              <div style={{ marginTop: 4, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  width: `${agent.load}%`,
                  background: agent.load > 0 ? '#7F77DD' : 'transparent',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#958ea0' }}>今日任務</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{metrics.totalTasks}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#958ea0' }}>工具呼叫</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{metrics.totalToolCalls}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#958ea0' }}>平均 Loop</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{metrics.avgLoops.toFixed(1)} 輪</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
