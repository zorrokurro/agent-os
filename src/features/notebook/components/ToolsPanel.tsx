import type { Notebook, Note } from '../types'

interface Props {
  notes: Note[]
  selectedNote: Note | null
  selectedNotebook: Notebook | null
  outlineLoading: boolean
  summaryLoading: boolean
  extractLoading: boolean
  onSelectNote: (note: Note) => void
  onCreateNote: () => void
  onGenerateOutline: () => void
  onSummarizeNote: () => void
  onExtractTags: () => void
  onFusionAnalysis: () => void
}

export function ToolsPanel({ notes, selectedNote, selectedNotebook, outlineLoading, summaryLoading, extractLoading, onSelectNote, onCreateNote, onGenerateOutline, onSummarizeNote, onExtractTags, onFusionAnalysis }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(18, 33, 49, 0.7)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 12px 8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 8px 8px' }}>
        {[
          { icon: '🌳', label: '大綱生成', color: '#a078ff', fn: onGenerateOutline, loading: outlineLoading },
          { icon: '📝', label: '全文摘要', color: '#10b981', fn: onSummarizeNote, loading: summaryLoading },
          { icon: '🏷️', label: '標籤提取', color: '#f59e0b', fn: onExtractTags, loading: extractLoading },
          { icon: '💬', label: '深度對話', color: '#0566d9', fn: () => { document.querySelector<HTMLInputElement>('[placeholder="問問題..."]')?.focus() }, loading: false },
        ].map(({ icon, label, fn, loading }) => (
          <button key={label} onClick={fn} disabled={loading}
            style={{ padding: '10px 8px', borderRadius: '8px', border: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: loading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: loading ? 0.5 : 1 }}>
            <span style={{ fontSize: '16px' }}>{loading ? '⏳' : icon}</span>
            <span style={{ fontSize: '10px', color: '#958ea0' }}>{label}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
        <button onClick={onCreateNote} style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '14px', cursor: 'pointer', padding: '2px 4px' }}>+</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {notes.map(note => (
          <div key={note.id} onClick={() => onSelectNote(note)}
            style={{
              padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
              background: selectedNote?.id === note.id ? 'rgba(160,120,255,0.1)' : 'transparent',
              border: selectedNote?.id === note.id ? '0.5px solid rgba(160,120,255,0.2)' : '0.5px solid transparent',
            }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#e0d8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {note.pinned && <span style={{ fontSize: '9px', marginRight: '3px' }}>📌</span>}
              {note.title}
            </div>
            <div style={{ fontSize: '10px', color: '#958ea0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {note.content.substring(0, 40) || '空白筆記'}
            </div>
          </div>
        ))}
        {notes.length === 0 && selectedNotebook && (
          <div style={{ textAlign: 'center', color: '#958ea0', padding: '20px 8px', fontSize: '11px' }}>尚無筆記</div>
        )}
        {!selectedNotebook && (
          <div style={{ textAlign: 'center', color: '#958ea0', padding: '20px 8px', fontSize: '11px' }}>選擇一個筆記本</div>
        )}
        <button onClick={onCreateNote} disabled={!selectedNotebook}
          style={{ width: '100%', padding: '6px', marginTop: '4px', borderRadius: '6px', border: '0.5px dashed rgba(255,255,255,0.1)', background: 'transparent', color: '#958ea0', fontSize: '11px', cursor: selectedNotebook ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: selectedNotebook ? 1 : 0.4 }}>
          + 新增筆記
        </button>
      </div>

      <div style={{ padding: '8px' }}>
        <button onClick={onFusionAnalysis}
          style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#7F77DD', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          ✨ Fusion 深度分析
        </button>
      </div>
    </div>
  )
}
