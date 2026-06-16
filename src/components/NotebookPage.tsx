import { useState, useEffect, useCallback, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Notebook, Note, Source } from '../types/electron'

const COLORS = ['#a078ff', '#0566d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
const ICONS = ['📓', '📔', '📕', '📗', '📘', '📙', '🗂️', '💡', '🔬', '🎯', '🚀', '🧠']

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  type?: 'summary' | 'outline' | 'tags' | 'chat'
}

interface Settings {
  modelId: string
}

const mdStyles: Record<string, React.CSSProperties> = {
  h1: { color: '#d0bcff', fontSize: '24px', fontWeight: 700, margin: '16px 0 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' },
  h2: { color: '#d0bcff', fontSize: '20px', fontWeight: 600, margin: '14px 0 6px' },
  h3: { color: '#d0bcff', fontSize: '16px', fontWeight: 600, margin: '12px 0 4px' },
  p: { color: '#e0d8e8', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' },
  li: { color: '#e0d8e8', fontSize: '14px', lineHeight: 1.6 },
  code: { background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#f0a0ff', fontFamily: "'Consolas', monospace" },
  pre: { background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '6px', overflow: 'auto', margin: '8px 0' },
  blockquote: { borderLeft: '3px solid #a078ff', paddingLeft: '12px', color: '#958ea0', margin: '8px 0' },
  a: { color: '#0566d9', textDecoration: 'underline' },
  table: { borderCollapse: 'collapse', margin: '8px 0', width: '100%' },
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
        <div style={{ position: 'absolute', top: '4px', right: '8px', fontSize: '10px', color: '#958ea0' }}>
          {match[1]}
        </div>
      )}
      <code className={className} style={mdStyles.code}>{children}</code>
    </div>
  )
}

function MdPre({ children }: { children?: React.ReactNode }) {
  return <pre style={mdStyles.pre}>{children}</pre>
}

export default function NotebookPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('📓')
  const [selectedColor, setSelectedColor] = useState('#a078ff')
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([])
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // AI feature states
  const [settings, setSettings] = useState<Settings>({ modelId: '' })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [extractLoading, setExtractLoading] = useState(false)
  const [outlineLoading, setOutlineLoading] = useState(false)

  // Obsidian auto-sync
  const [obsidianVault, setObsidianVault] = useState('')
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('obsidianAutoSync') === 'true')
  const [syncing, setSyncing] = useState(false)

  // Source management
  const [sources, setSources] = useState<Source[]>([])
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)

  const loadNotebooks = useCallback(async () => {
    const list = await window.electronAPI.notebookList()
    setNotebooks(list)
  }, [])

  const loadSources = useCallback(async (notebookId: string) => {
    try {
      const list = await window.electronAPI.sourceGet(notebookId)
      setSources(list)
    } catch (e) {
      console.error('Failed to load sources:', e)
      setSources([])
    }
  }, [])

  const loadTags = useCallback(async () => {
    const tags = await window.electronAPI.noteAllTags()
    setAllTags(tags)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const s = await window.electronAPI.getSettings()
      if (s) {
        setSettings({
          modelId: (s.apiModel as string) || (s.modelId as string) || '',
        })
        setObsidianVault((s.obsidianVault as string) || '')
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadNotebooks(); loadTags(); loadSettings() }, [loadNotebooks, loadTags, loadSettings])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const triggerSync = useCallback(async () => {
    if (!autoSync || !obsidianVault) return
    setSyncing(true)
    try { await window.electronAPI.obsidianSync() } catch { /* silent */ }
    finally { setSyncing(false) }
  }, [autoSync, obsidianVault])

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    localStorage.setItem('obsidianAutoSync', String(next))
  }

  const selectNotebook = async (nb: Notebook) => {
    setSelectedNotebook(nb)
    setSelectedNote(null)
    setEditContent('')
    const noteList = await window.electronAPI.noteList(nb.id)
    setNotes(noteList)
    loadSources(nb.id)
  }

  const selectNote = (note: Note) => {
    setSelectedNote(note)
    setEditContent(note.content)
    setEditorMode('edit')
    setChatMessages([])
  }

  const createNotebook = async () => {
    if (!newName.trim()) return
    console.log(`嘗試建立筆記本：${newName}`)
    try {
      const result = await window.electronAPI.notebookCreate(newName, newDesc, selectedIcon, selectedColor)
      if (result && (result as any).error) {
        console.error('建立筆記本失敗：', (result as any).error)
        return
      }
      console.log('建立筆記本成功：', result)
      setShowNewNotebook(false)
      setNewName(''); setNewDesc('')
      loadNotebooks()
      triggerSync()
    } catch (e) {
      console.error('建立筆記本例外：', e)
    }
  }

  const createNote = async () => {
    if (!selectedNotebook) return
    const note = await window.electronAPI.noteCreate(selectedNotebook.id, '未命名筆記')
    await selectNotebook(selectedNotebook)
    selectNote(note)
    triggerSync()
  }

  const saveNote = async () => {
    if (!selectedNote) return
    await window.electronAPI.noteUpdate(selectedNote.id, { content: editContent })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    triggerSync()
  }

  const deleteNotebook = async (id: string) => {
    await window.electronAPI.notebookDelete(id)
    if (selectedNotebook?.id === id) { setSelectedNotebook(null); setNotes([]); setSelectedNote(null) }
    loadNotebooks()
    triggerSync()
  }

  const deleteNote = async (id: string) => {
    await window.electronAPI.noteDelete(id)
    if (selectedNote?.id === id) { setSelectedNote(null); setEditContent('') }
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    triggerSync()
  }

  const togglePin = async (note: Note) => {
    await window.electronAPI.noteUpdate(note.id, { pinned: !note.pinned })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
  }

  const addTag = async (note: Note, tag: string) => {
    if (!tag.trim() || note.tags.includes(tag)) return
    await window.electronAPI.noteUpdate(note.id, { tags: [...note.tags, tag] })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    loadTags()
  }

  const removeTag = async (note: Note, tag: string) => {
    await window.electronAPI.noteUpdate(note.id, { tags: note.tags.filter(t => t !== tag) })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    loadTags()
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedNote || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    try {
      const model = settings.modelId
      if (!model) {
        throw new Error('請先到設定頁面設定模型')
      }
      const context = `以下是筆記內容（標題：${selectedNote.title}）：\n\n${selectedNote.content || '（空白筆記）'}`
      const systemPrompt = '你是一個筆記助理。根據用戶提供的筆記內容回答問題。如果筆記內容不足以回答，誠實說明。回答請用繁體中文。'
      const userPrompt = `${context}\n\n---\n\n問題：${question}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.aiChat({ model, messages })
      const answer = reply || '無法取得回覆'
      setChatMessages(prev => [...prev, { role: 'assistant', content: answer }])

      // Save conversation to UMP Hub
      try {
        await window.electronAPI.saveConversation(`Notebook-${selectedNote.title}`, [
          { role: 'user', content: question },
          { role: 'assistant', content: answer },
        ])
      } catch (e) {
        console.error('Failed to save conversation:', e)
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `錯誤：${e instanceof Error ? e.message : String(e)}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const summarizeNote = async () => {
    if (!selectedNote || summaryLoading) return
    setSummaryLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '摘要全文', type: 'chat' }])
    try {
      const model = settings.modelId
      if (!model) {
        throw new Error('請先到設定頁面設定模型')
      }
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個知識助手。請根據提供的筆記內容生成簡潔的摘要，保留關鍵要點。用繁體中文回答。'
      const userPrompt = `請將以下筆記濃縮成 3-5 個重點，用繁體中文條列：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.aiChat({ model, messages })
      if (reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply, type: 'summary' }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `摘要生成失敗：${e instanceof Error ? e.message : String(e)}`, type: 'summary' }])
    } finally {
      setSummaryLoading(false)
    }
  }

  const extractTags = async () => {
    if (!selectedNote || extractLoading) return
    setExtractLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '提取標籤', type: 'chat' }])
    try {
      const model = settings.modelId
      if (!model) {
        throw new Error('請先到設定頁面設定模型')
      }
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個標籤提取助手。從筆記內容中提取關鍵字作為標籤。'
      const userPrompt = `從以下筆記提取 3-5 個關鍵字，只回傳關鍵字，用逗號分隔，不要其他文字：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.aiChat({ model, messages })
      if (reply) {
        const keywords = reply
          .split(/[,，、\n]/)
          .map(k => k.trim())
          .filter(k => k.length > 0 && k.length < 30)
          .slice(0, 5)

        if (keywords.length > 0 && selectedNote) {
          const newTags = [...new Set([...selectedNote.tags, ...keywords])]
          await window.electronAPI.noteUpdate(selectedNote.id, { tags: newTags })
          if (selectedNotebook) await selectNotebook(selectedNotebook)
          loadTags()
        }

        setChatMessages(prev => [...prev, { role: 'assistant', content: `已提取標籤：${keywords.join('、')}`, type: 'tags' }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `標籤提取失敗：${e instanceof Error ? e.message : String(e)}`, type: 'tags' }])
    } finally {
      setExtractLoading(false)
    }
  }

  const generateOutline = async () => {
    if (!selectedNotebook || outlineLoading) return
    const model = settings.modelId
    if (!model) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '請先到設定頁面設定模型', type: 'outline' }])
      return
    }
    setOutlineLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '生成大綱', type: 'chat' }])
    try {
      const [noteList, sourceList] = await Promise.all([
        window.electronAPI.noteList(selectedNotebook.id),
        window.electronAPI.sourceGet(selectedNotebook.id),
      ])

      const notesText = noteList.map(n => `【${n.title}】\n${n.content || '（空白）'}`).join('\n\n---\n\n')
      const sourcesText = sourceList.map(s => `【${s.title}】\n${s.preview.substring(0, 500)}`).join('\n\n---\n\n')

      const systemPrompt = '請分析以下所有筆記和來源資料，生成一份完整的階層式大綱。\n用繁體中文，使用 Markdown 格式（# ## ### 標題層級）。'
      const userPrompt = `筆記內容：\n${notesText || '（尚無筆記）'}\n\n來源資料：\n${sourcesText || '（尚無來源）'}`

      const reply = await window.electronAPI.aiChat({ model, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] })

      if (!reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'AI 未回傳內容', type: 'outline' }])
        return
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, type: 'outline' }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `生成大綱失敗：${e instanceof Error ? e.message : String(e)}`, type: 'outline' }])
    } finally {
      setOutlineLoading(false)
    }
  }

  const handleImportPDF = async () => {
    if (!selectedNotebook) return
    setSourceLoading(true)
    try {
      const result = await window.electronAPI.sourceImportPDF(selectedNotebook.id)
      if (result && 'error' in result) {
        console.error('PDF import failed:', result.error)
        return
      }
      if (result && 'canceled' in result) return
      loadSources(selectedNotebook.id)
      triggerSync()
    } catch (e) {
      console.error('PDF import error:', e)
    } finally {
      setSourceLoading(false)
    }
  }

  const handleImportURL = async () => {
    if (!selectedNotebook || !urlInput.trim()) return
    setSourceLoading(true)
    try {
      const result = await window.electronAPI.sourceImportURL(urlInput.trim(), selectedNotebook.id)
      if (result && 'error' in result) {
        console.error('URL import failed:', result.error)
        return
      }
      setUrlInput('')
      setShowUrlInput(false)
      loadSources(selectedNotebook.id)
      triggerSync()
    } catch (e) {
      console.error('URL import error:', e)
    } finally {
      setSourceLoading(false)
    }
  }

  const handleImportText = async () => {
    if (!selectedNotebook || !textInput.trim()) return
    setSourceLoading(true)
    try {
      const result = await window.electronAPI.sourceImportText(textInput.trim(), selectedNotebook.id)
      if (result && 'error' in result) {
        console.error('Text import failed:', result.error)
        return
      }
      setTextInput('')
      setShowTextInput(false)
      loadSources(selectedNotebook.id)
      triggerSync()
    } catch (e) {
      console.error('Text import error:', e)
    } finally {
      setSourceLoading(false)
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    if (!selectedNotebook) return
    try {
      await window.electronAPI.sourceDelete(sourceId)
      loadSources(selectedNotebook.id)
      triggerSync()
    } catch (e) {
      console.error('Delete source error:', e)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', height: '100%', overflow: 'hidden' }}>
      {/* Column 1: Notebooks + Sources */}
      <div style={{
        background: 'var(--color-background-primary, rgba(18, 33, 49, 0.9))',
        borderRight: '0.5px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notebooks</span>
          <button
            onClick={() => setShowNewNotebook(true)}
            style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
          >+</button>
        </div>

        {showNewNotebook && (
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名稱" autoFocus
              style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="描述（選填）"
              style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {ICONS.map(icon => (
                <button key={icon} onClick={() => setSelectedIcon(icon)}
                  style={{ background: selectedIcon === icon ? 'rgba(160,120,255,0.3)' : 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                >{icon}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              {COLORS.map(color => (
                <button key={color} onClick={() => setSelectedColor(color)}
                  style={{ width: '18px', height: '18px', borderRadius: '50%', background: color, border: selectedColor === color ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={createNotebook} style={{ flex: 1, padding: '6px', background: 'linear-gradient(135deg, #a078ff, #0566d9)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>建立</button>
              <button onClick={() => setShowNewNotebook(false)} style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: '#958ea0', fontSize: '12px', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {notebooks.map(nb => (
            <div key={nb.id} onClick={() => selectNotebook(nb)}
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
                {nb.noteCount} 篆筆記
              </div>
            </div>
          ))}
          {notebooks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#958ea0', padding: '32px 12px', fontSize: '12px' }}>
              尚無筆記本
            </div>
          )}
        </div>

        {selectedNotebook && (
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
                  <span style={{ color: '#e0d8e8', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {src.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSource(src.id) }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', padding: 0, opacity: 0.5 }}
                  >✕</button>
                </div>
              ))}
              {sources.length === 0 && (
                <div style={{ color: '#958ea0', fontSize: '11px', textAlign: 'center', padding: '8px' }}>尚無來源</div>
              )}

              {showUrlInput && (
                <div style={{ marginTop: '6px' }}>
                  <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="貼上網址..."
                    onKeyDown={e => { if (e.key === 'Enter') handleImportURL() }}
                    style={{ width: '100%', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button onClick={handleImportURL} disabled={sourceLoading || !urlInput.trim()}
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
                    <button onClick={handleImportText} disabled={sourceLoading || !textInput.trim()}
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
                    <button onClick={handleImportPDF} disabled={sourceLoading}
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
        )}
      </div>

      {/* Column 2: Chat (main body) */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'rgba(12, 20, 30, 0.9)',
        borderRight: '0.5px solid rgba(255,255,255,0.1)',
        minWidth: 0,
      }}>
        {selectedNote ? (
          <>
            {/* Header */}
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input value={selectedNote.title}
                onChange={e => { const v = e.target.value; setSelectedNote(p => p ? { ...p, title: v } : null); window.electronAPI.noteUpdate(selectedNote.id, { title: v }) }}
                style={{ flex: 1, background: 'none', border: 'none', color: '#e0d8e8', fontSize: '15px', fontWeight: 500, outline: 'none' }} />
              <span style={{ fontSize: '11px', color: '#958ea0', whiteSpace: 'nowrap' }}>{editContent.length} 字</span>
              <button onClick={() => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '0.5px solid rgba(255,255,255,0.1)', background: editorMode === 'preview' ? 'rgba(160,120,255,0.15)' : 'rgba(255,255,255,0.04)', color: '#d0bcff', fontSize: '12px', cursor: 'pointer' }}>
                {editorMode === 'edit' ? '👁' : '✏️'}
              </button>
            </div>

            {/* Note preview (collapsible) */}
            <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
              {editorMode === 'edit' ? (
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} onBlur={saveNote}
                  placeholder="支援 Markdown 語法..."
                  style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.2)', border: 'none', padding: '12px 16px', color: '#e0d8e8', fontSize: '13px', lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: "'Consolas', 'Monaco', monospace", boxSizing: 'border-box' }} />
              ) : (
                <div style={{ maxHeight: '150px', overflow: 'hidden', padding: '12px 16px', position: 'relative' }}>
                  {editContent ? (
                    <Markdown remarkPlugins={[remarkGfm]} components={{
                      h1: ({ children }) => <h1 style={{ ...mdStyles.h1, fontSize: '18px' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ ...mdStyles.h2, fontSize: '16px' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ ...mdStyles.h3, fontSize: '14px' }}>{children}</h3>,
                      p: ({ children }) => <p style={{ ...mdStyles.p, fontSize: '13px' }}>{children}</p>,
                      li: ({ children }) => <li style={{ ...mdStyles.li, fontSize: '13px' }}>{children}</li>,
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

            {/* Tags bar */}
            <div style={{ padding: '6px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedNote.tags.map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(160,120,255,0.15)', color: '#b0a0c0', fontSize: '10px' }}>
                  {tag}
                  <button onClick={() => removeTag(selectedNote, tag)} style={{ background: 'none', border: 'none', color: '#b0a0c0', fontSize: '9px', cursor: 'pointer', padding: 0 }}>✕</button>
                </span>
              ))}
              <input placeholder="+ 標籤"
                onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { addTag(selectedNote, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = '' } }}
                style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '10px', outline: 'none', width: '50px' }} />
            </div>

            {/* Chat messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chatMessages.length === 0 && (
                <div style={{ color: '#958ea0', fontSize: '12px', textAlign: 'center', padding: '40px 20px', lineHeight: 1.8 }}>
                  基於這份筆記的內容<br />向 AI 提問
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: msg.role === 'user' ? '75%' : '90%' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ fontSize: '10px', color: '#10b981', marginBottom: '3px', fontWeight: 600 }}>AI</div>
                    )}
                    <div style={{
                      background: msg.role === 'user' ? '#EEEDFE' : 'rgba(255,255,255,0.04)',
                      border: msg.role === 'user' ? '0.5px solid #CECBF6' : '0.5px solid rgba(255,255,255,0.06)',
                      borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                      padding: msg.role === 'user' ? '8px 12px' : '10px 13px',
                      fontSize: '13px', lineHeight: 1.6,
                      color: msg.role === 'user' ? '#3C3489' : '#e0d8e8',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                    {msg.type && msg.type !== 'chat' && msg.role === 'assistant' && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        <button onClick={() => navigator.clipboard.writeText(msg.content)}
                          style={{ padding: '3px 8px', borderRadius: '4px', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>複製</button>
                        {msg.type === 'outline' && (
                          <button onClick={() => { window.electronAPI.noteCreate(selectedNotebook!.id, `大綱 - ${selectedNote.title}`, msg.content); if (selectedNotebook) selectNotebook(selectedNotebook) }}
                            style={{ padding: '3px 8px', borderRadius: '4px', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(160,120,255,0.15)', color: '#d0bcff', fontSize: '10px', cursor: 'pointer' }}>存為筆記</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
                  <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 600 }}>AI</span>
                  <span style={{ fontSize: '12px', color: '#958ea0' }}>
                    <span style={{ animation: 'orch-spin 1s linear infinite', display: 'inline-block' }}>⟳</span> 思考中...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', padding: '10px 16px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: '生成大綱', fn: () => generateOutline() },
                  { label: '摘要全文', fn: () => summarizeNote() },
                  { label: '提取標籤', fn: () => extractTags() },
                  { label: '深入分析', fn: () => setChatInput('請深入分析這篇筆記的所有論點') },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    style={{ padding: '3px 10px', borderRadius: '12px', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#958ea0', fontSize: '11px', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder="問問題..." disabled={chatLoading} rows={1}
                  style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e0d8e8', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #a078ff, #0566d9)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: chatLoading ? 'wait' : 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1, alignSelf: 'flex-end' }}>
                  送
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#958ea0', fontSize: '14px' }}>
            選擇或建立一筆筆記開始編輯
          </div>
        )}
      </div>

      {/* Column 3: Tools + Notes */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'rgba(18, 33, 49, 0.7)',
        overflow: 'hidden',
      }}>
        {/* Tools Header */}
        <div style={{ padding: '12px 12px 8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools</span>
        </div>

        {/* Tool Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 8px 8px' }}>
          {[
            { icon: '🌳', label: '大綱生成', color: '#a078ff', fn: () => generateOutline(), loading: outlineLoading },
            { icon: '📝', label: '全文摘要', color: '#10b981', fn: () => summarizeNote(), loading: summaryLoading },
            { icon: '🏷️', label: '標籤提取', color: '#f59e0b', fn: () => extractTags(), loading: extractLoading },
            { icon: '💬', label: '深度對話', color: '#0566d9', fn: () => { document.querySelector<HTMLInputElement>('[placeholder="問問題..."]')?.focus() }, loading: false },
          ].map(({ icon, label, color, fn, loading }) => (
            <button key={label} onClick={fn} disabled={loading}
              style={{ padding: '10px 8px', borderRadius: '8px', border: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: loading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: loading ? 0.5 : 1 }}>
              <span style={{ fontSize: '16px' }}>{loading ? '⏳' : icon}</span>
              <span style={{ fontSize: '10px', color: '#958ea0' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Notes Header */}
        <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary, #958ea0)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
          <button onClick={createNote} style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '14px', cursor: 'pointer', padding: '2px 4px' }}>+</button>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {notes.map(note => (
            <div key={note.id} onClick={() => selectNote(note)}
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
          <button onClick={createNote} disabled={!selectedNotebook}
            style={{ width: '100%', padding: '6px', marginTop: '4px', borderRadius: '6px', border: '0.5px dashed rgba(255,255,255,0.1)', background: 'transparent', color: '#958ea0', fontSize: '11px', cursor: selectedNotebook ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: selectedNotebook ? 1 : 0.4 }}>
            + 新增筆記
          </button>
        </div>

        {/* Fusion Button */}
        <div style={{ padding: '8px' }}>
          <button onClick={() => setChatInput('請用 Fusion 模式深度分析這篇筆記的所有論點')}
            style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#7F77DD', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            ✨ Fusion 深度分析
          </button>
        </div>
      </div>
    </div>
  )
}
