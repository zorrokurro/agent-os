import { useState, useCallback, useRef, useEffect } from 'react'
import * as service from '../services/library.service'

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
}

export function useLibraryStreaming() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const streamingCleanupRef = useRef<(() => void)[]>([])

  useEffect(() => {
    return () => {
      streamingCleanupRef.current.forEach(fn => fn())
      streamingCleanupRef.current = []
    }
  }, [])

  const sendTask = useCallback(async (input: string, agentName: string, agentDescription: string, model: string, conversationHistory: ChatMessage[]) => {
    if (!input.trim() || loading) return

    const task = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: task }])
    setLoading(true)

    try {
      const chatMessages = [
        { role: 'system', content: `你是 AgentOS 的 AI Agent「${agentName}」。${agentDescription}。請用繁體中文回覆。` },
        ...conversationHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: task },
      ]

      setMessages(prev => [...prev, { role: 'agent', content: '' }])
      let fullReply = ''

      const cleanupAll = () => {
        streamingCleanupRef.current.forEach(fn => fn())
        streamingCleanupRef.current = []
      }

      const removeToken = service.onChatToken((token) => {
        fullReply += token
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'agent', content: fullReply }
          return updated
        })
      })

      const removeDone = service.onChatDone(async () => {
        cleanupAll()
        setLoading(false)
        try {
          const allMessages = [...conversationHistory, { role: 'user' as const, content: task }, { role: 'agent' as const, content: fullReply }]
          await service.saveConversation(agentName, allMessages)
        } catch { /* ignore save errors */ }
      })

      const removeError = service.onChatError((error) => {
        cleanupAll()
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'agent', content: `❌ 錯誤：${error}\n\n請確認 Ollama 已啟動且模型已下載。` }
          return updated
        })
        setLoading(false)
      })

      streamingCleanupRef.current = [removeToken, removeDone, removeError]

      await service.chatStream(model, chatMessages)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', content: `❌ 錯誤：${String(e)}\n\n請確認 Ollama 已啟動且模型已下載。` }])
      setLoading(false)
    }
  }, [loading])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    loading,
    sendTask,
    clearMessages,
  }
}
