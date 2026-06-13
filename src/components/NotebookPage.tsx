import { useState, useEffect, useCallback, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Notebook, Note, Source } from '../types/electron'

const COLORS = ['#a078ff', '#0566d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
const ICONS = ['📓', '📔', '📕', '📗', '📘', '📙', '🗂️', '💡', '🔬', '🎯', '🚀', '🧠']

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Settings {
  apiKey: string
  modelId: string
  providerId: string
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Note[]>([])
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('📓')
  const [selectedColor, setSelectedColor] = useState('#a078ff')
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([])
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // AI feature states
  const [settings, setSettings] = useState<Settings>({ apiKey: '', modelId: '', providerId: 'ollama' })
  const [summary, setSummary] = useState<string>('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [extractLoading, setExtractLoading] = useState(false)
  const [outlineLoading, setOutlineLoading] = useState(false)

  // Obsidian auto-sync
  const [obsidianVault, setObsidianVault] = useState('')
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('obsidianAutoSync') === 'true')
  const [syncing, setSyncing] = useState(false)

  // Source management
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null)

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
          apiKey: (s.apiKey as string) || '',
          modelId: (s.modelId as string) || '',
          providerId: (s.providerId as string) || 'ollama',
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
    setSummary('')
    const noteList = await window.electronAPI.noteList(nb.id)
    setNotes(noteList)
    loadSources(nb.id)
  }

  const selectNote = (note: Note) => {
    setSelectedNote(note)
    setEditContent(note.content)
    setEditorMode('edit')
    setChatMessages([])
    setShowChat(false)
    setSummary('')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const results = await window.electronAPI.noteSearch(searchQuery, selectedNotebook?.id)
    setSearchResults(results)
  }

  useEffect(() => { handleSearch() }, [searchQuery])

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
      const apiKey = settings.apiKey
      const model = settings.modelId
      if (!apiKey || !model) {
        throw new Error('請先到設定頁面設定 API Key 和模型')
      }
      const context = `以下是筆記內容（標題：${selectedNote.title}）：\n\n${selectedNote.content || '（空白筆記）'}`
      const systemPrompt = '你是一個筆記助理。根據用戶提供的筆記內容回答問題。如果筆記內容不足以回答，誠實說明。回答請用繁體中文。'
      const userPrompt = `${context}\n\n---\n\n問題：${question}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.openrouterChat(apiKey, model, messages)
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
    setSummary('')
    try {
      const apiKey = settings.apiKey
      const model = settings.modelId
      if (!apiKey || !model) {
        throw new Error('請先到設定頁面設定 API Key 和模型')
      }
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個知識助手。請根據提供的筆記內容生成簡潔的摘要，保留關鍵要點。用繁體中文回答。'
      const userPrompt = `請將以下筆記濃縮成 3-5 個重點，用繁體中文條列：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.openrouterChat(apiKey, model, messages)
      if (reply) {
        setSummary(reply)
      }
    } catch (e) {
      console.error('Summarize error:', e)
      setSummary('摘要生成失敗')
    } finally {
      setSummaryLoading(false)
    }
  }

  const extractTags = async () => {
    if (!selectedNote || extractLoading) return
    setExtractLoading(true)
    try {
      const apiKey = settings.apiKey
      const model = settings.modelId
      if (!apiKey || !model) {
        throw new Error('請先到設定頁面設定 API Key 和模型')
      }
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個標籤提取助手。從筆記內容中提取關鍵字作為標籤。'
      const userPrompt = `從以下筆記提取 3-5 個關鍵字，只回傳關鍵字，用逗號分隔，不要其他文字：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await window.electronAPI.openrouterChat(apiKey, model, messages)
      if (reply) {
        // Parse keywords from reply
        const keywords = reply
          .split(/[,，、\n]/)
          .map(k => k.trim())
          .filter(k => k.length > 0 && k.length < 30)
          .slice(0, 5)

        // Add keywords as tags
        if (keywords.length > 0 && selectedNote) {
          const newTags = [...new Set([...selectedNote.tags, ...keywords])]
          await window.electronAPI.noteUpdate(selectedNote.id, { tags: newTags })
          if (selectedNotebook) await selectNotebook(selectedNotebook)
          loadTags()
        }
      }
    } catch (e) {
      console.error('Extract tags error:', e)
    } finally {
      setExtractLoading(false)
    }
  }

  const generateOutline = async () => {
    if (!selectedNotebook || outlineLoading) return
    const apiKey = settings.apiKey
    const model = settings.modelId
    if (!apiKey || !model) {
      alert('請先到設定頁面設定 API Key 和模型')
      return
    }
    setOutlineLoading(true)
    try {
      const [noteList, sourceList] = await Promise.all([
        window.electronAPI.noteList(selectedNotebook.id),
        window.electronAPI.sourceGet(selectedNotebook.id),
      ])

      const notesText = noteList.map(n => `【${n.title}】\n${n.content || '（空白）'}`).join('\n\n---\n\n')
      const sourcesText = sourceList.map(s => `【${s.title}】\n${s.preview.substring(0, 500)}`).join('\n\n---\n\n')

      const systemPrompt = '請分析以下所有筆記和來源資料，生成一份完整的階層式大綱。\n用繁體中文，使用 Markdown 格式（# ## ### 標題層級）。'
      const userPrompt = `筆記內容：\n${notesText || '（尚無筆記）'}\n\n來源資料：\n${sourcesText || '（尚無來源）'}`

      const reply = await window.electronAPI.openrouterChat(apiKey, model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      if (!reply) {
        alert('AI 未回傳內容')
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const title = `大綱 - ${selectedNotebook.name} - ${today}`
      await window.electronAPI.noteCreate(selectedNotebook.id, title, reply)
      await selectNotebook(selectedNotebook)
      alert('✅ 大綱已生成並存為新筆記')
    } catch (e) {
      console.error('Generate outline error:', e)
      alert(`生成大綱失敗：${e instanceof Error ? e.message : String(e)}`)
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

  const displayNotes = filterTag
    ? notes.filter(n => n.tags.includes(filterTag))
    : searchResults.length > 0 || searchQuery
      ? searchResults
      : notes

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Column 1: Notebooks */}
      <div style={{
        width: '220px', minWidth: '220px',
        background: 'rgba(18, 33, 49, 0.9)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#d0bcff', fontSize: '16px' }}>Notebooks</span>
          <button
            onClick={() => setShowNewNotebook(true)}
            style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '20px', cursor: 'pointer' }}
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
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                background: selectedNotebook?.id === nb.id ? 'rgba(160,120,255,0.2)' : 'transparent',
                border: selectedNotebook?.id === nb.id ? '1px solid rgba(160,120,255,0.3)' : '1px solid transparent',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{nb.icon}</span>
                <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nb.name}</span>
                <span style={{ color: '#958ea0', fontSize: '11px' }}>{nb.noteCount}</span>
              </div>
              {nb.description && (
                <div style={{ color: '#958ea0', fontSize: '11px', marginTop: '2px', marginLeft: '26px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nb.description}</div>
              )}
            </div>
          ))}
          {notebooks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#958ea0', padding: '40px 16px', fontSize: '13px' }}>
              尚無筆記本<br/>點擊 + 建立第一個
            </div>
          )}
        </div>

        {/* Sources Section */}
        {selectedNotebook && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ color: '#d0bcff', fontSize: '13px', fontWeight: 600 }}>來源</span>
              <span style={{ color: '#958ea0', fontSize: '11px' }}>
                {sourcesExpanded ? '▾' : '▸'} {sources.length}
              </span>
            </div>

            {sourcesExpanded && (
              <div style={{ padding: '0 8px 8px', maxHeight: '200px', overflow: 'auto' }}>
                {sources.map(src => (
                  <div key={src.id} style={{ padding: '6px 8px', borderRadius: '4px', marginBottom: '2px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>
                      {src.type === 'pdf' ? '📄' : src.type === 'url' ? '🔗' : '📝'}
                    </span>
                    <span style={{ color: '#e0d8e8', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {src.title}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSource(src.id) }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', padding: 0, opacity: 0.6 }}
                    >✕</button>
                  </div>
                ))}
                {sources.length === 0 && (
                  <div style={{ color: '#958ea0', fontSize: '11px', textAlign: 'center', padding: '8px' }}>尚無來源</div>
                )}

                {/* URL Input */}
                {showUrlInput && (
                  <div style={{ marginTop: '6px' }}>
                    <input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="貼上網址..."
                      onKeyDown={e => { if (e.key === 'Enter') handleImportURL() }}
                      style={{ width: '100%', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button onClick={handleImportURL} disabled={sourceLoading || !urlInput.trim()}
                        style={{ flex: 1, padding: '4px', background: 'rgba(160,120,255,0.3)', border: 'none', borderRadius: '3px', color: '#d0bcff', fontSize: '10px', cursor: 'pointer' }}>擷取</button>
                      <button onClick={() => { setShowUrlInput(false); setUrlInput('') }}
                        style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>取消</button>
                    </div>
                  </div>
                )}

                {/* Text Input */}
                {showTextInput && (
                  <div style={{ marginTop: '6px' }}>
                    <textarea
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      placeholder="貼上文字內容..."
                      rows={3}
                      style={{ width: '100%', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', boxSizing: 'border-box', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button onClick={handleImportText} disabled={sourceLoading || !textInput.trim()}
                        style={{ flex: 1, padding: '4px', background: 'rgba(160,120,255,0.3)', border: 'none', borderRadius: '3px', color: '#d0bcff', fontSize: '10px', cursor: 'pointer' }}>儲存</button>
                      <button onClick={() => { setShowTextInput(false); setTextInput('') }}
                        style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '3px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>取消</button>
                    </div>
                  </div>
                )}

                {/* Add Source Buttons */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button onClick={handleImportPDF} disabled={sourceLoading}
                    style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>+ PDF</button>
                  <button onClick={() => setShowUrlInput(!showUrlInput)} disabled={sourceLoading}
                    style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>+ 網址</button>
                  <button onClick={() => setShowTextInput(!showTextInput)} disabled={sourceLoading}
                    style={{ flex: 1, padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#958ea0', fontSize: '10px', cursor: 'pointer' }}>+ 文字</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Column 2: Notes */}
      <div style={{
        width: '280px', minWidth: '280px',
        background: 'rgba(18, 33, 49, 0.7)',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜尋筆記..."
            style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }} />
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              {filterTag && (
                <button onClick={() => setFilterTag(null)} style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(160,120,255,0.3)', border: 'none', color: '#d0bcff', fontSize: '11px', cursor: 'pointer' }}>✕ 清除</button>
              )}
              {allTags.slice(0, 8).map(t => (
                <button key={t.tag} onClick={() => setFilterTag(filterTag === t.tag ? null : t.tag)}
                  style={{ padding: '2px 8px', borderRadius: '10px', border: 'none', fontSize: '11px', cursor: 'pointer', background: filterTag === t.tag ? 'rgba(160,120,255,0.4)' : 'rgba(255,255,255,0.05)', color: filterTag === t.tag ? '#d0bcff' : '#958ea0' }}>
                  {t.tag} ({t.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedNotebook && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#958ea0', fontSize: '12px' }}>{displayNotes.length} 筆</span>
            <button onClick={createNote} style={{ background: 'none', border: 'none', color: '#a078ff', fontSize: '13px', cursor: 'pointer' }}>+ 新增</button>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {displayNotes.map(note => (
            <div key={note.id} onClick={() => selectNote(note)}
              onMouseEnter={() => setHoveredNoteId(note.id)}
              onMouseLeave={() => setHoveredNoteId(null)}
              style={{ position: 'relative', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px', background: selectedNote?.id === note.id ? 'rgba(160,120,255,0.15)' : 'transparent', border: selectedNote?.id === note.id ? '1px solid rgba(160,120,255,0.2)' : '1px solid transparent' }}>
              {hoveredNoteId === note.id && (
                <button onClick={e => { e.stopPropagation(); if (window.confirm(`確定要刪除「${note.title}」？此操作無法復原。`)) { deleteNote(note.id) } }}
                  style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer', padding: '2px 6px', lineHeight: '14px', zIndex: 1 }}>✕</button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {note.pinned && <span style={{ fontSize: '10px' }}>📌</span>}
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
              </div>
              <div style={{ color: '#958ea0', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                {note.content.substring(0, 80) || '空白筆記'}
              </div>
              {note.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {note.tags.slice(0, 3).map(tag => (
                    <span key={tag} style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(160,120,255,0.15)', color: '#b0a0c0', fontSize: '10px' }}>{tag}</span>
                  ))}
                  {note.tags.length > 3 && <span style={{ color: '#958ea0', fontSize: '10px' }}>+{note.tags.length - 3}</span>}
                </div>
              )}
            </div>
          ))}
          {!selectedNotebook && (
            <div style={{ textAlign: 'center', color: '#958ea0', padding: '40px 16px', fontSize: '13px' }}>選擇一個筆記本</div>
          )}
          {selectedNotebook && displayNotes.length === 0 && (
            <div style={{ textAlign: 'center', color: '#958ea0', padding: '40px 16px', fontSize: '13px' }}>{searchQuery ? '找不到結果' : '尚無筆記'}</div>
          )}
        </div>
      </div>

      {/* Column 3: Editor + Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(12, 20, 30, 0.9)', minWidth: 0 }}>
        {selectedNote ? (
          <>
            {/* Title bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input value={selectedNote.title}
                onChange={e => { const v = e.target.value; setSelectedNote(p => p ? { ...p, title: v } : null); window.electronAPI.noteUpdate(selectedNote.id, { title: v }) }}
                style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '16px', fontWeight: 600, outline: 'none' }} />
              <button onClick={() => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: editorMode === 'preview' ? 'rgba(160,120,255,0.2)' : 'rgba(255,255,255,0.05)', color: '#d0bcff', fontSize: '12px', cursor: 'pointer' }}>
                {editorMode === 'edit' ? '👁 預覽' : '✏️ 編輯'}
              </button>
              <button onClick={summarizeNote} disabled={summaryLoading}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#958ea0', fontSize: '12px', cursor: summaryLoading ? 'wait' : 'pointer', opacity: summaryLoading ? 0.5 : 1 }}>
                {summaryLoading ? '⏳' : '📝'} 摘要
              </button>
              <button onClick={extractTags} disabled={extractLoading}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#958ea0', fontSize: '12px', cursor: extractLoading ? 'wait' : 'pointer', opacity: extractLoading ? 0.5 : 1 }}>
                {extractLoading ? '⏳' : '🏷️'} 提取標籤
              </button>
              <button onClick={generateOutline} disabled={outlineLoading}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#958ea0', fontSize: '12px', cursor: outlineLoading ? 'wait' : 'pointer', opacity: outlineLoading ? 0.5 : 1 }}>
                {outlineLoading ? '⏳' : '📋'} 大綱
              </button>
              <button onClick={() => setShowChat(!showChat)}
                style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: showChat ? 'rgba(160,120,255,0.2)' : 'rgba(255,255,255,0.05)', color: '#d0bcff', fontSize: '12px', cursor: 'pointer' }}>
                💬 對話
              </button>
              <button onClick={() => togglePin(selectedNote)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', opacity: selectedNote.pinned ? 1 : 0.4 }}>📌</button>
              <button onClick={() => deleteNote(selectedNote.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '14px', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
              {obsidianVault && (
                <button onClick={toggleAutoSync}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', background: syncing ? 'rgba(160,120,255,0.2)' : autoSync ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: syncing ? '#a078ff' : autoSync ? '#10b981' : '#958ea0', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {syncing ? '⏳ 同步中...' : autoSync ? '✅ Obsidian 同步：開啟' : '🔄 Obsidian 同步：關閉'}
                </button>
              )}
            </div>

            {/* Tags bar */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedNote.tags.map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(160,120,255,0.2)', color: '#d0bcff', fontSize: '11px' }}>
                  {tag}
                  <button onClick={() => removeTag(selectedNote, tag)} style={{ background: 'none', border: 'none', color: '#d0bcff', fontSize: '10px', cursor: 'pointer', padding: 0 }}>✕</button>
                </span>
              ))}
              <input placeholder="+ 標籤"
                onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { addTag(selectedNote, (e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = '' } }}
                style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '11px', outline: 'none', width: '60px' }} />
            </div>

            {/* Main content area */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Editor / Preview + Summary */}
              <div style={{ flex: showChat ? '0 0 60%' : '1', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'auto', minWidth: 0 }}>
                {editorMode === 'edit' ? (
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} onBlur={saveNote} placeholder="支援 Markdown 語法..."
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '14px', lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: "'Consolas', 'Monaco', monospace" }} />
                ) : (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: '6px', padding: '16px', overflow: 'auto' }}>
                    {editContent ? (
                      <Markdown remarkPlugins={[remarkGfm]} components={{
                        h1: ({ children }) => <h1 style={mdStyles.h1}>{children}</h1>,
                        h2: ({ children }) => <h2 style={mdStyles.h2}>{children}</h2>,
                        h3: ({ children }) => <h3 style={mdStyles.h3}>{children}</h3>,
                        p: ({ children }) => <p style={mdStyles.p}>{children}</p>,
                        li: ({ children }) => <li style={mdStyles.li}>{children}</li>,
                        code: MdCode,
                        pre: MdPre,
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
                      <div style={{ color: '#958ea0', fontSize: '14px' }}>空白筆記</div>
                    )}
                  </div>
                )}

                {/* Summary display (below editor) */}
                {summary && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(160,120,255,0.1)', borderRadius: '8px', border: '1px solid rgba(160,120,255,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: '#d0bcff', fontSize: '13px', fontWeight: 600 }}>📝 AI 摘要</span>
                      <button onClick={() => setSummary('')} style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '11px', cursor: 'pointer' }}>✕ 關閉</button>
                    </div>
                    <div style={{ color: '#e0d8e8', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{summary}</div>
                  </div>
                )}
              </div>

              {/* Chat panel */}
              {showChat && (
                <div style={{ flex: '0 0 40%', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', background: 'rgba(10, 16, 24, 0.95)', minWidth: 0 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#d0bcff', fontSize: '13px' }}>💬 筆記對話</span>
                    <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#958ea0', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                    {chatMessages.length === 0 && (
                      <div style={{ color: '#958ea0', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                        基於這份筆記的內容<br/>向 AI 提問
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', color: msg.role === 'user' ? '#a078ff' : '#10b981', marginBottom: '4px', fontWeight: 600 }}>
                          {msg.role === 'user' ? '你' : 'AI'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#e0d8e8', lineHeight: 1.6, background: msg.role === 'user' ? 'rgba(160,120,255,0.1)' : 'rgba(16,185,129,0.1)', padding: '8px 10px', borderRadius: '6px' }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ fontSize: '12px', color: '#958ea0', textAlign: 'center', padding: '8px' }}>
                        <span style={{ animation: 'orch-spin 1s linear infinite', display: 'inline-block' }}>⟳</span> 思考中...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                        placeholder="問問題..." disabled={chatLoading}
                        style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }} />
                      <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                        style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #a078ff, #0566d9)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: chatLoading ? 'wait' : 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>
                        送
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#958ea0', fontSize: '11px' }}>{editContent.length} 字元</span>
              <span style={{ color: '#958ea0', fontSize: '11px' }}>{new Date(selectedNote.updatedAt).toLocaleString()}</span>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#958ea0', fontSize: '14px' }}>
            選擇或建立一筆筆記開始編輯
          </div>
        )}
      </div>
    </div>
  )
}
