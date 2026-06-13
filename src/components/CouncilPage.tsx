import { useState, useCallback, useEffect } from 'react';
import {
  type Deliberation,
  type Councillor,
  DEFAULT_COUNCILLORS,
  DEFAULT_CHAIRMAN,
  MODE_DESCRIPTIONS,
  generateId,
} from '../types/council';

// ---------------------------------------------------------------------------
// Council Page — Multi-model deliberation UI (real API calls)
// ---------------------------------------------------------------------------

type PageView = 'list' | 'new' | 'detail';

export default function CouncilPage() {
  const [view, setView] = useState<PageView>('list');
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // New deliberation form
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<Deliberation['mode']>('general');
  const [isRunning, setIsRunning] = useState(false);

  // Settings for API key and model
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  const activeDeliberation = deliberations.find(d => d.id === activeId) || null;

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s = await window.electronAPI.getSettings();
        if (s) {
          setApiKey((s.apiKey as string) || '');
          setModel((s.modelId as string) || '');
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    loadSettings();
  }, []);

  // Start a new deliberation
  const startDeliberation = useCallback(() => {
    if (!question.trim() || isRunning || !apiKey || !model) return;

    const id = generateId();
    const now = new Date().toISOString();

    const councillors: Councillor[] = DEFAULT_COUNCILLORS.map(c => ({
      ...c,
      status: 'thinking' as const,
      response: '',
    }));

    const chairman: Councillor = {
      ...DEFAULT_CHAIRMAN,
      status: 'idle' as const,
      response: '',
    };

    const deliberation: Deliberation = {
      id,
      question: question.trim(),
      mode,
      status: 'stage1',
      councillors,
      chairman,
      rankings: {},
      synthesis: '',
      createdAt: now,
      completedAt: null,
    };

    setDeliberations(prev => [deliberation, ...prev]);
    setActiveId(id);
    setView('detail');
    setIsRunning(true);

    // Run real deliberation
    runDeliberation(id, question.trim(), mode, councillors, chairman);
  }, [question, mode, isRunning, apiKey, model]);

  // Run the 3-stage deliberation with real API calls
  const runDeliberation = async (
    id: string,
    q: string,
    m: Deliberation['mode'],
    councillors: Councillor[],
    chairman: Councillor,
  ) => {
    try {
      // Stage 1: Councillor responses (parallel)
      const councillorResponses = await window.electronAPI.councilGetCouncillorResponses(
        apiKey, model, q, m
      );

      // Update UI with councillor responses
      setDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'stage1',
          councillors: d.councillors.map((c, i) => {
            const resp = councillorResponses.find(r => r.id === c.id);
            return {
              ...c,
              status: resp?.error ? 'error' as const : 'done' as const,
              response: resp?.response || '',
              error: resp?.error,
            };
          }),
        };
      }));

      // Stage 2: Peer review rankings
      const validResponses = councillorResponses.filter(r => r.response && !r.error);
      const rankings = await window.electronAPI.councilGetPeerRankings(
        apiKey, model, q, validResponses
      );

      setDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'stage2',
          rankings,
        };
      }));

      // Stage 3: Chairman synthesis
      const synthesis = await window.electronAPI.councilGetChairmanSynthesis(
        apiKey, model, q, validResponses, rankings
      );

      setDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'complete',
          chairman: {
            ...d.chairman!,
            status: 'done' as const,
            response: synthesis,
          },
          synthesis,
          completedAt: new Date().toISOString(),
        };
      }));
    } catch (e) {
      console.error('Deliberation error:', e);
      setDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d;
        return {
          ...d,
          status: 'error',
          completedAt: new Date().toISOString(),
        };
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const canStart = !!question.trim() && !isRunning && !!apiKey && !!model;

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      {view === 'list' && (
        <CouncilList
          deliberations={deliberations}
          onNew={() => setView('new')}
          onSelect={(id) => { setActiveId(id); setView('detail'); }}
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
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CouncilList({
  deliberations,
  onNew,
  onSelect,
}: {
  deliberations: Deliberation[];
  onNew: () => void;
  onSelect: (id: string) => void;
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
  );
}

function NewDeliberation({
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
  question: string;
  setQuestion: (q: string) => void;
  mode: Deliberation['mode'];
  setMode: (m: Deliberation['mode']) => void;
  isRunning: boolean;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  hasApiKey: boolean;
  hasModel: boolean;
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

      {/* Question input */}
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

      {/* Mode selector */}
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

      {/* Council lineup preview */}
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

      {/* Start button */}
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
  );
}

function DeliberationDetail({
  deliberation,
  onBack,
}: {
  deliberation: Deliberation;
  onBack: () => void;
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

      {/* Stage 1: Councillor Responses */}
      <Section title="Stage 1: Councillor Responses" number={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {deliberation.councillors.map((c, i) => (
            <CouncillorCard key={c.id} councillor={c} letter={String.fromCharCode(65 + i)} />
          ))}
        </div>
      </Section>

      {/* Stage 2: Peer Review Rankings */}
      {deliberation.status !== 'pending' && deliberation.status !== 'stage1' && (
        <Section title="Stage 2: Peer Review Rankings" number={2}>
          {Object.keys(deliberation.rankings).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(deliberation.rankings)
                .sort(([, a], [, b]) => b - a)
                .map(([id, score]) => {
                  const c = deliberation.councillors.find(x => x.id === id);
                  return (
                    <div key={id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                      background: 'rgba(18, 33, 49, 0.5)', borderRadius: '6px',
                    }}>
                      <span style={{ color: '#d0bcff', fontSize: '14px' }}>{c?.name || id}</span>
                      <span style={{ color: '#a078ff', fontSize: '14px', fontWeight: 600 }}>{score} pts</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p style={{ color: '#958ea0', fontSize: '14px' }}>Rankings pending...</p>
          )}
        </Section>
      )}

      {/* Stage 3: Chairman Synthesis */}
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
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Section({ title, number, children }: { title: string; number: number; children: React.ReactNode }) {
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
  );
}

function CouncillorCard({ councillor, letter }: { councillor: Councillor; letter: string }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: 'rgba(18, 33, 49, 0.7)',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '6px',
            background: 'rgba(160,120,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#d0bcff',
          }}>
            {letter}
          </div>
          <span style={{ color: '#d0bcff', fontSize: '14px', fontWeight: 600 }}>{councillor.name}</span>
        </div>
        <StatusBadge status={councillor.status} />
      </div>
      {councillor.response && (
        <div style={{ color: '#c0b8d0', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {councillor.response}
        </div>
      )}
      {councillor.status === 'thinking' && (
        <div style={{ color: '#958ea0', fontSize: '13px' }}>⏳ Thinking...</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(153,153,153,0.2)', color: '#999', label: 'Pending' },
    stage1: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 1' },
    stage2: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 2' },
    stage3: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Stage 3' },
    complete: { bg: 'rgba(72,187,120,0.2)', color: '#48bb78', label: 'Complete' },
    error: { bg: 'rgba(245,101,101,0.2)', color: '#f56565', label: 'Error' },
    idle: { bg: 'rgba(153,153,153,0.2)', color: '#999', label: 'Idle' },
    thinking: { bg: 'rgba(160,120,255,0.2)', color: '#a078ff', label: 'Thinking' },
    done: { bg: 'rgba(72,187,120,0.2)', color: '#48bb78', label: 'Done' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px',
      background: c.bg, color: c.color,
      fontSize: '11px', fontWeight: 600,
    }}>
      {c.label}
    </span>
  );
}
