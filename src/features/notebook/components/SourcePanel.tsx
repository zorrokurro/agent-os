import type { Source } from '../types'

interface Props {
  sources: Source[]
  showUrlInput: boolean
  urlInput: string
  showTextInput: boolean
  textInput: string
  sourceLoading: boolean
  setShowUrlInput: (v: boolean) => void
  setUrlInput: (v: string) => void
  setShowTextInput: (v: boolean) => void
  setTextInput: (v: string) => void
  onImportPDF: () => void
  onImportURL: () => void
  onImportText: () => void
  onDeleteSource: (id: string) => void
}

export function SourcePanel({ sources, showUrlInput, urlInput, showTextInput, textInput, sourceLoading, setShowUrlInput, setUrlInput, setShowTextInput, setTextInput, onImportPDF, onImportURL, onImportText, onDeleteSource }: Props) {
  return (
    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sources</span>
        <span style={{ color: '#958ea0', fontSize: '10px' }}>{sources.length}</span>
      </div>

      <div style={{ padding: '0 8px 8px', maxHeight: '200px', overflow: 'auto' }}>
        {sources.map(src => (
          <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', marginBottom: '4px', border: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: '12px', flexShrink: 0 }}>
              {src.type === 'pdf' ? '📄' : src.type === 'url' ? '🔗' : '📝'}
            </span>
            <span style={{ color: '#e0d8e8', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title}</span>
            <button onClick={(e) => { e.stopPropagation(); onDeleteSource(src.id) }}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', padding: 0, opacity: 0.5 }}>✕</button>
          </div>
        ))}
        {sources.length === 0 && (
          <div style={{ color: '#958ea0', fontSize: '11px', textAlign: 'center', padding: '8px' }}>尚無來源</div>
        )}

        {showUrlInput && (
          <div style={{ marginTop: '6px' }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="貼上網址..."
              onKeyDown={e => { if (e.key === 'Enter') onImportURL() }}
              style={{ width: '100%', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button onClick={onImportURL} disabled={sourceLoading || !urlInput.trim()}
                style={{ flex: 1, padding: '4px', background: 'rgba(160,120,255,0.3)', border: 'none', borderRadius: '3px', color: '#d0bcff', fontSize: '10px', cursor: 'pointer' }}>擷取</button>
              <button onClick={() => { setShowUrlInput(false); setUrlInput('') }}
                style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        )}

        {showTextInput && (
          <div style={{ marginTop: '6px' }}>
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="貼上文字內容..." rows={3}
              style={{ width: '100%', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', boxSizing: 'border-box', resize: 'none' }} />
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button onClick={onImportText} disabled={sourceLoading || !textInput.trim()}
                style={{ flex: 1, padding: '4px', background: 'rgba(160,120,255,0.3)', border: 'none', borderRadius: '3px', color: '#d0bcff', fontSize: '10px', cursor: 'pointer' }}>儲存</button>
              <button onClick={() => { setShowTextInput(false); setTextInput('') }}
                style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '6px' }}>
          <button onClick={() => { setShowUrlInput(!showUrlInput); setShowTextInput(false) }} disabled={sourceLoading}
            style={{ width: '100%', padding: '5px', background: 'rgba(255,255,255,0.04)', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: '4px', color: '#958ea0', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            + 新增來源
          </button>
          {showUrlInput && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button onClick={onImportPDF} disabled={sourceLoading}
                style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>PDF</button>
              <button onClick={() => { setShowUrlInput(true); setShowTextInput(false) }}
                style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>網址</button>
              <button onClick={() => { setShowTextInput(true); setShowUrlInput(false) }}
                style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>文字</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
