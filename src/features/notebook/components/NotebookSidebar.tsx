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

export const NotebookSidebar = React.memo(function NotebookSidebar({ notebooks, selectedNotebook, sources, onSelectNotebook, onCreateNotebook, sourceProps }: Props) {
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
    <div className="flex flex-col h-full" style={{ background: 'var(--color-background-primary, rgba(18, 33, 49, 0.9))' }}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="font-semibold text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary, #958ea0)' }}>Notebooks</span>
        <button onClick={() => setShowNew(true)}
          className="bg-transparent border-none text-[#a078ff] text-base cursor-pointer px-1.5 py-0.5 rounded">+</button>
      </div>

      {showNew && (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名稱" autoFocus
            className="w-full py-1.5 px-2 bg-black/30 border border-white/10 rounded text-white text-[13px] mb-1.5 box-border" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="描述（選填）"
            className="w-full py-1.5 px-2 bg-black/30 border border-white/10 rounded text-white text-[13px] mb-1.5 box-border" />
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {NOTEBOOK_ICONS.map(icon => (
              <button key={icon} onClick={() => setSelectedIcon(icon)}
                className={`${selectedIcon === icon ? 'bg-[rgba(160,120,255,0.3)]' : 'bg-transparent'} border-none text-base cursor-pointer p-0.5 rounded`}>{icon}</button>
            ))}
          </div>
          <div className="flex gap-1 mb-2">
            {NOTEBOOK_COLORS.map(color => (
              <button key={color} onClick={() => setSelectedColor(color)}
                className="w-[18px] h-[18px] rounded-full cursor-pointer" style={{ background: color, border: selectedColor === color ? '2px solid #fff' : '2px solid transparent' }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleCreate} className="flex-1 py-1.5 rounded-none border-none rounded text-white text-xs cursor-pointer" style={{ background: 'linear-gradient(135deg, #a078ff, #0566d9)' }}>建立</button>
            <button onClick={() => setShowNew(false)} className="flex-1 py-1.5 bg-white/10 border-none rounded text-[#958ea0] text-xs cursor-pointer">取消</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-2">
        {notebooks.map(nb => (
          <div key={nb.id} onClick={() => onSelectNotebook(nb)}
            className={`px-2 py-1.5 rounded-md cursor-pointer mb-0.5 ${selectedNotebook?.id === nb.id ? 'bg-[rgba(160,120,255,0.1)] border border-[rgba(160,120,255,0.2)]' : 'border border-transparent'}`}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: nb.color || '#a078ff' }} />
              <span className="text-[#e0d8e8] text-[13px] font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{nb.name}</span>
            </div>
            <div className="pl-[14px] text-[11px] text-[#958ea0] mt-px">
              {nb.noteCount} 篇筆記
            </div>
          </div>
        ))}
        {notebooks.length === 0 && (
          <div className="text-center text-[#958ea0] py-8 px-3 text-xs">尚無筆記本</div>
        )}
      </div>

      {selectedNotebook && (
        <SourcePanel sources={sources} {...sourceProps} />
      )}
    </div>
  )
})
