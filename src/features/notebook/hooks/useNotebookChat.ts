import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, NotebookSettings } from '../types'
import type { Note, Notebook } from '../../../types'
import * as service from '../services/notebook.service'

export function useNotebookChat(settings: NotebookSettings) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [extractLoading, setExtractLoading] = useState(false)
  const [outlineLoading, setOutlineLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const requireModel = useCallback((): string | null => {
    if (!settings.modelId) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '請先到設定頁面設定模型' }])
      return null
    }
    return settings.modelId
  }, [settings.modelId])

  const sendChat = useCallback(async (selectedNote: Note | null) => {
    if (!chatInput.trim() || !selectedNote || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    try {
      const model = requireModel()
      if (!model) return

      const context = `以下是筆記內容（標題：${selectedNote.title}）：\n\n${selectedNote.content || '（空白筆記）'}`
      const systemPrompt = '你是一個筆記助理。根據用戶提供的筆記內容回答問題。如果筆記內容不足以回答，誠實說明。回答請用繁體中文。'
      const userPrompt = `${context}\n\n---\n\n問題：${question}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await service.aiChat({ model, messages })
      const answer = reply || '無法取得回覆'
      setChatMessages(prev => [...prev, { role: 'assistant', content: answer }])

      try {
        await service.saveConversation(`Notebook-${selectedNote.title}`, [
          { role: 'user', content: question },
          { role: 'assistant', content: answer },
        ])
      } catch { /* silent */ }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `錯誤：${e instanceof Error ? e.message : String(e)}` }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, requireModel])

  const summarizeNote = useCallback(async (selectedNote: Note | null) => {
    if (!selectedNote || summaryLoading) return
    setSummaryLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '摘要全文', type: 'chat' }])
    try {
      const model = requireModel()
      if (!model) return
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個知識助手。請根據提供的筆記內容生成簡潔的摘要，保留關鍵要點。用繁體中文回答。'
      const userPrompt = `請將以下筆記濃縮成 3-5 個重點，用繁體中文條列：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await service.aiChat({ model, messages })
      if (reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply, type: 'summary' }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `摘要生成失敗：${e instanceof Error ? e.message : String(e)}`, type: 'summary' }])
    } finally {
      setSummaryLoading(false)
    }
  }, [summaryLoading, requireModel])

  const extractTags = useCallback(async (selectedNote: Note | null, selectedNotebook: Notebook | null, onTagsSaved: () => void) => {
    if (!selectedNote || extractLoading) return
    setExtractLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '提取標籤', type: 'chat' }])
    try {
      const model = requireModel()
      if (!model) return
      const noteContent = selectedNote.content || '（空白筆記）'
      const systemPrompt = '你是一個標籤提取助手。從筆記內容中提取關鍵字作為標籤。'
      const userPrompt = `從以下筆記提取 3-5 個關鍵字，只回傳關鍵字，用逗號分隔，不要其他文字：\n\n${noteContent}`
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
      const reply = await service.aiChat({ model, messages })
      if (reply) {
        const keywords = reply
          .split(/[,，、\n]/)
          .map(k => k.trim())
          .filter(k => k.length > 0 && k.length < 30)
          .slice(0, 5)

        if (keywords.length > 0) {
          const newTags = [...new Set([...selectedNote.tags, ...keywords])]
          await service.updateNote(selectedNote.id, { tags: newTags })
          if (selectedNotebook) onTagsSaved()
        }

        setChatMessages(prev => [...prev, { role: 'assistant', content: `已提取標籤：${keywords.join('、')}`, type: 'tags' }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `標籤提取失敗：${e instanceof Error ? e.message : String(e)}`, type: 'tags' }])
    } finally {
      setExtractLoading(false)
    }
  }, [extractLoading, requireModel])

  const generateOutline = useCallback(async (selectedNotebook: Notebook | null) => {
    if (!selectedNotebook || outlineLoading) return
    const model = requireModel()
    if (!model) return
    setOutlineLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: '生成大綱', type: 'chat' }])
    try {
      const [noteList, sourceList] = await Promise.all([
        service.listNotes(selectedNotebook.id),
        service.getSources(selectedNotebook.id),
      ])

      const notesText = noteList.map(n => `【${n.title}】\n${n.content || '（空白）'}`).join('\n\n---\n\n')
      const sourcesText = sourceList.map(s => `【${s.title}】\n${s.preview.substring(0, 500)}`).join('\n\n---\n\n')

      const systemPrompt = '請分析以下所有筆記和來源資料，生成一份完整的階層式大綱。\n用繁體中文，使用 Markdown 格式（# ## ### 標題層級）。'
      const userPrompt = `筆記內容：\n${notesText || '（尚無筆記）'}\n\n來源資料：\n${sourcesText || '（尚無來源）'}`

      const reply = await service.aiChat({ model, messages: [
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
  }, [outlineLoading, requireModel])

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return {
    chatMessages, chatInput, chatLoading, summaryLoading, extractLoading, outlineLoading, chatEndRef,
    setChatInput, sendChat, summarizeNote, extractTags, generateOutline, scrollToBottom,
  }
}
