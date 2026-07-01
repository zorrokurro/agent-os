import React, { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Note } from '../types'

const mdStyles: Record<string, React.CSSProperties> = {
  h1: { color: '#d0bcff', fontSize: '18px', fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' },
  h2: { color: '#d0bcff', fontSize: '16px', fontWeight: 600, margin: '14px 0 6px' },
  h3: { color: '#d0bcff', fontSize: '14px', fontWeight: 600, margin: '12px 0 4px' },
  p: { color: '#e0d8e8', fontSize: '13px', lineHeight: 1.7, margin: '8px 0' },
  li: { color: '#e0d8e8', fontSize: '13px', lineHeight: 1.6 },
  code: { background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#f0a0ff', fontFamily: "'Consolas', monospace" },
  pre: { background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '6px', overflow: 'auto', margin: '8px 0' },
  blockquote: { borderLeft: '3px solid #a078ff', paddingLeft: '12px', color: '#958ea0', margin: '8px 0' },
  a: { color: '#0566d9', textDecoration: 'underline' as const },
  table: { borderCollapse: 'collapse' as const, margin: '8px 0', width: '100%' },
  th: { border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', background: 'rgba(160,120,255,0.1)', color: '#d0bcff', fontSize: '13px' },
  td: { border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', color: '#e0d8e8', fontSize: '13px' },
  ul: { paddingLeft: '20px', margin: '4px 0' },
  ol: { paddingLeft: '20px', margin: '4px 0' },
  hr: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' },
}

function MdCode({ className, children }: { className?: string; children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || '')
  return (
    <div style={{ position: 'relative' }}>
      {match && (
        <div style={{ position: 'absolute', top: '4px', right: '8px', fontSize: '10px', color: '#958ea0' }}>{match[1]}</div>
      )}
      <code className={className} style={mdStyles.code}>{children}</code>
    </div>
  )
}

function MdPre({ children }: { children?: React.ReactNode }) {
  return <pre style={mdStyles.pre}>{children}</pre>
}

interface Props {
  selectedNote: Note
  editContent: string
  onContentChange: (content: string) => void
  onTitleChange: (title: string) => void
  onSave: () => void
  onAddTag: (note: Note, tag: string) => void
  onRemoveTag: (note: Note, tag: string) => void
}

export const NoteEditor = React.memo(function NoteEditor({ selectedNote, editContent, onContentChange, onTitleChange, onSave, onAddTag, onRemoveTag }: Props) {
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')

  return (
    <>
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input value={selectedNote.title}
          onChange={e => onTitleChange(e.target.value)}
          style={{ flex: 1, background: 'none', border: 'none', color: '#e0d8e8', fontSize: '15px', fontWeight: 500, outline: 'none' }} />
        <span style={{ fontSize: '11px', color: '#958ea0', whiteSpace: 'nowrap' }}>{editContent.length} 字</span>
        <button onClick={() => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '0.5px solid rgba(255,255,255,0.1)', background: editorMode === 'preview' ? 'rgba(160,120,255,0.15)' : 'rgba(255,255,255,0.04)', color: '#d0bcff', fontSize: '12px', cursor: 'pointer' }}>
          {editorMode === 'edit' ? '👁' : '✏️'}
        </button>
      </div>

      <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
        {editorMode === 'edit' ? (
          <textarea value={editContent} onChange={e => onContentChange(e.target.value)} onBlur={onSave}
            placeholder="支援 Markdown 語法..."
            style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.2)', border: 'none', padding: '12px 16px', color: '#e0d8e8', fontSize: '13px', lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: "'Consolas', 'Monaco', monospace", boxSizing: 'border-box' }} />
        ) : (
          <div style={{ maxHeight: '150px', overflow: 'hidden', padding: '12px 16px', position: 'relative' }}>
            {editContent ? (
              <Markdown remarkPlugins={[remarkGfm]} components={{
                h1: ({ children }) => <h1 style={mdStyles.h1}>{children}</h1>,
                h2: ({ children }) => <h2 style={mdStyles.h2}>{children}</h2>,
                h3: ({ children }) => <h3 style={mdStyles.h3}>{children}</h3>,
                p: ({ children }) => <p style={mdStyles.p}>{children}</p>,
                li: ({ children }) => <li style={mdStyles.li}>{children}</li>,
                code: MdCode, pre: MdPre,
                blockquote: ({ children }) => <blockquote style={mdStyles.blockquote}>{children}</blockquote>,
                a: ({ href, children }) => <a href={href} style={mdStyles.a} target="_blank" rel="noopener noreferrer">{children}</a>,
                table: ({ children }) => <table style={mdStyles.table}>{children}</table>,
                th: ({ children }) => <th style={mdStyles.th}>{children}</th>,
                td: ({ children }) => <td style={mdStyles.td}>{children}</td>,
                ul: ({ children }) => <ul style={mdStyles.ul}>{children}</ul>,
                ol: ({ children }) => <ol style={mdStyles.ol}>{children}</ol>,
                hr: () => <hr style={mdStyles.hr} />,
              }}>
                {editContent}
              </Markdown>
            ) : (
              <div style={{ color: '#958ea0', fontSize: '13px' }}>空白筆記</div>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, rgba(12,20,30,0.95))' }} />
          </div>
        )}
      </div>

      <div style={{ padding: '6px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {selectedNote.tags.map(tag => (
          <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(160,120,255,0.15)', color: '#b0a0c0', fontSize: '10px' }}>
            {tag}
            <button onClick={() => onRemoveTag(selectedNote, tag)} style={{ background: 'none', border: 'none', color: '#b0a0c0', fontSize: '9px', cursor: 'pointer', padding: 0 }}>✕</button>
          </span>
        ))}
        <input placeholder="+ 標籤"
          onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { onAddTag(selectedNote, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = '' } }}
          style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '10px', outline: 'none', width: '50px' }} />
      </div>
    </>
  )
})
