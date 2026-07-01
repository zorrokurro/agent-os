import React, { useState } from 'react'
import type { Notebook, Source } from '../types'
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS } from '../types'
import { SourcePanel } from './SourcePanel'

interface Props {
  notebooks: Notebook[]
  selectedNotebook: Notebook | null
  sources: Source[]
  onSelectNotebook: (nb: Notebook) => void
  onCreateNotebook: (name: string, desc: string, icon: string, color: string) => void
  sourceProps: {
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
}

export const NotebookSidebar = React.memo(function NotebookSidebar({   notebooks, selectedNotebook, sources, onSelectNotebook, onCreateNotebook, sourceProps }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('📓')
  const [selectedColor, setSelectedColor] = useState('#a078ff')

  const handleCreate = () => {
    onCreateNotebook(newName, newDesc, selectedIcon, selectedColor)
    setShowNew(false)
    setNewName('')
    setNewDesc('')
  }

  return (
    <div style={{
      background: 'var(--color-background-primary, rgba(18, 33, 49, 0.9))',
      borderRight: '0.5px solid rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notebooks</span>
        <button onClick={() => setShowNew(true)}
          style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}>+</button>
      </div>

      {showNew && (
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名稱" autoFocus
            style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="描述（選填）"
            style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
            {NOTEBOOK_ICONS.map(icon => (
              <button key={icon} onClick={() => setSelectedIcon(icon)}
                style={{ background: selectedIcon === icon ? 'rgba(160,120,255,0.3)' : 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}>{icon}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {NOTEBOOK_COLORS.map(color => (
              <button key={color} onClick={() => setSelectedColor(color)}
                style={{ width: '18px', height: '18px', borderRadius: '50%', background: color, border: selectedColor === color ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleCreate} style={{ flex: 1, padding: '6px', background: 'linear-gradient(135deg, #a078ff, #0566d9)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>建立</button>
            <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#958ea0', fontSize: '12px', cursor: 'pointer' }}>取消</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {notebooks.map(nb => (
          <div key={nb.id} onClick={() => onSelectNotebook(nb)}
            style={{
              padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
              background: selectedNotebook?.id === nb.id ? 'rgba(160,120,255,0.1)' : 'transparent',
              border: selectedNotebook?.id === nb.id ? '0.5px solid rgba(160,120,255,0.2)' : '0.5px solid transparent',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: nb.color || '#a078ff', flexShrink: 0 }} />
              <span style={{ color: '#e0d8e8', fontSize: '13px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nb.name}</span>
            </div>
            <div style={{ paddingLeft: '14px', fontSize: '11px', color: '#958ea0', marginTop: '1px' }}>
              {nb.noteCount} 篇筆記
            </div>
          </div>
        ))}
        {notebooks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#958ea0', padding: '32px 12px', fontSize: '12px' }}>尚無筆記本</div>
        )}
      </div>

      {selectedNotebook && (
        <SourcePanel sources={sources} {...sourceProps} />
      )}
    </div>
  )
})
