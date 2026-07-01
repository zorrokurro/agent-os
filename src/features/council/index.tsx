import { useCouncil } from './hooks/useCouncil'
import { CouncilList } from './components/CouncilList'
import { NewDeliberation } from './components/NewDeliberation'
import { DeliberationDetail } from './components/DeliberationDetail'

export default function CouncilPage() {
  const {
    view,
    setView,
    setActiveId,
    question,
    setQuestion,
    mode,
    setMode,
    isRunning,
    allDeliberations,
    activeDeliberation,
    canStart,
    startDeliberation,
    apiKey,
    model,
  } = useCouncil()

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {view === 'list' && (
        <CouncilList
          deliberations={allDeliberations}
          onNew={() => setView('new')}
          onSelect={(id) => { setActiveId(id); setView('detail') }}
        />
      )}
      {view === 'new' && (
        <NewDeliberation
          question={question}
          setQuestion={setQuestion}
          mode={mode}
          setMode={setMode}
          isRunning={isRunning}
          canStart={canStart}
          onStart={startDeliberation}
          onCancel={() => setView('list')}
          hasApiKey={!!apiKey}
          hasModel={!!model}
        />
      )}
      {view === 'detail' && activeDeliberation && (
        <DeliberationDetail
          deliberation={activeDeliberation}
          onBack={() => setView('list')}
        />
      )}
    </div>
  )
}
