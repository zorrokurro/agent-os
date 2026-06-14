import BrainChat from './BrainChat'
import AgentPanel from './AgentPanel'

interface BrainLayoutProps {
  onNavigate: (page: 'brain' | 'library' | 'memory' | 'research' | 'store' | 'ump' | 'sysagents' | 'settings' | 'orchestrator' | 'council' | 'notebook') => void
}

export default function BrainLayout({ onNavigate }: BrainLayoutProps) {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <BrainChat />
      </div>
      <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
        <AgentPanel />
      </div>
    </div>
  )
}
