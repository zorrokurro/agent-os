import { useState, useEffect, useCallback } from 'react'
import { useNotebook } from './hooks/useNotebook'
import { useNotebookChat } from './hooks/useNotebookChat'
import { useNotebookSources } from './hooks/useNotebookSources'
import { parseSettings, syncObsidian } from './services/notebook.service'
import { NotebookSidebar } from './components/NotebookSidebar'
import { NoteEditor } from './components/NoteEditor'
import { ChatMessages } from './components/ChatMessages'
import { ChatInput } from './components/ChatInput'
import { ToolsPanel } from './components/ToolsPanel'

export default function NotebookPage() {
  const nb = useNotebook()
  const [settings, setSettings] = useState({ modelId: '', obsidianVault: '' })
  const [autoSync] = useState(() => localStorage.getItem('obsidianAutoSync') === 'true')

  const chat = useNotebookChat(settings)
  const src = useNotebookSources()

  useEffect(() => {
    (async () => {
      const raw = await window.electronAPI.getSettings()
      setSettings(parseSettings(raw))
    })()
  }, [])

  useEffect(() => {
    if (nb.selectedNotebook) src.loadSources(nb.selectedNotebook.id)
  }, [nb.selectedNotebook, src.loadSources])

  const triggerSync = useCallback(async () => {
    if (!autoSync || !settings.obsidianVault) return
    try { await syncObsidian() } catch { /* silent */ }
  }, [autoSync, settings.obsidianVault])

  const handleCreateNotebook = useCallback(async (name: string, desc: string, icon: string, color: string) => {
    await nb.createNotebook(name, desc, icon, color)
    triggerSync()
  }, [nb.createNotebook, triggerSync])

  const handleCreateNote = useCallback(async () => {
    await nb.createNote()
    triggerSync()
  }, [nb.createNote, triggerSync])

  const handleSaveNote = useCallback(async () => {
    await nb.saveNote()
    triggerSync()
  }, [nb.saveNote, triggerSync])

  const handleGenerateOutline = useCallback(() => {
    chat.generateOutline(nb.selectedNotebook)
  }, [chat.generateOutline, nb.selectedNotebook])

  const handleSummarize = useCallback(() => {
    chat.summarizeNote(nb.selectedNote)
  }, [chat.summarizeNote, nb.selectedNote])

  const handleExtractTags = useCallback(() => {
    chat.extractTags(nb.selectedNote, nb.selectedNotebook, async () => {
      if (nb.selectedNotebook) await nb.selectNotebook(nb.selectedNotebook)
      await nb.loadTags()
    })
  }, [chat.extractTags, nb.selectedNote, nb.selectedNotebook, nb.selectNotebook, nb.loadTags])

  const handleFusionAnalysis = useCallback(() => {
    chat.setChatInput('請用 Fusion 模式深度分析這篇筆記的所有論點')
  }, [chat.setChatInput])

  const handleDeepAnalysis = useCallback(() => {
    chat.setChatInput('請深入分析這篇筆記的所有論點')
  }, [chat.setChatInput])

  const handleImportPDF = useCallback(async () => {
    if (!nb.selectedNotebook) return
    await src.handleImportPDF(nb.selectedNotebook.id)
    triggerSync()
  }, [src.handleImportPDF, nb.selectedNotebook, triggerSync])

  const handleImportURL = useCallback(async () => {
    if (!nb.selectedNotebook) return
    await src.handleImportURL(nb.selectedNotebook.id)
    triggerSync()
  }, [src.handleImportURL, nb.selectedNotebook, triggerSync])

  const handleImportText = useCallback(async () => {
    if (!nb.selectedNotebook) return
    await src.handleImportText(nb.selectedNotebook.id)
    triggerSync()
  }, [src.handleImportText, nb.selectedNotebook, triggerSync])

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    if (!nb.selectedNotebook) return
    await src.handleDeleteSource(sourceId, nb.selectedNotebook.id)
    triggerSync()
  }, [src.handleDeleteSource, nb.selectedNotebook, triggerSync])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', height: '100%', overflow: 'hidden' }}>
      <NotebookSidebar
        notebooks={nb.notebooks}
        selectedNotebook={nb.selectedNotebook}
        sources={src.sources}
        onSelectNotebook={nb.selectNotebook}
        onCreateNotebook={handleCreateNotebook}
        sourceProps={{
          showUrlInput: src.showUrlInput,
          urlInput: src.urlInput,
          showTextInput: src.showTextInput,
          textInput: src.textInput,
          sourceLoading: src.sourceLoading,
          setShowUrlInput: src.setShowUrlInput,
          setUrlInput: src.setUrlInput,
          setShowTextInput: src.setShowTextInput,
          setTextInput: src.setTextInput,
          onImportPDF: handleImportPDF,
          onImportURL: handleImportURL,
          onImportText: handleImportText,
          onDeleteSource: handleDeleteSource,
        }}
      />

      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'rgba(12, 20, 30, 0.9)',
        borderRight: '0.5px solid rgba(255,255,255,0.1)',
        minWidth: 0,
      }}>
        {nb.selectedNote ? (
          <>
            <NoteEditor
              selectedNote={nb.selectedNote}
              editContent={nb.editContent}
              onContentChange={nb.updateEditContent}
              onTitleChange={nb.updateSelectedNoteTitle}
              onSave={handleSaveNote}
              onAddTag={nb.addTag}
              onRemoveTag={nb.removeTag}
            />
            <ChatMessages messages={chat.chatMessages} chatLoading={chat.chatLoading} chatEndRef={chat.chatEndRef} />
            <ChatInput
              chatInput={chat.chatInput}
              chatLoading={chat.chatLoading}
              onInputChange={chat.setChatInput}
              onSend={() => chat.sendChat(nb.selectedNote)}
              onSummarize={handleSummarize}
              onExtractTags={handleExtractTags}
              onGenerateOutline={handleGenerateOutline}
              onDeepAnalysis={handleDeepAnalysis}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#958ea0', fontSize: '14px' }}>
            選擇或建立一筆筆記開始編輯
          </div>
        )}
      </div>

      <ToolsPanel
        notes={nb.notes}
        selectedNote={nb.selectedNote}
        selectedNotebook={nb.selectedNotebook}
        outlineLoading={chat.outlineLoading}
        summaryLoading={chat.summaryLoading}
        extractLoading={chat.extractLoading}
        onSelectNote={nb.selectNote}
        onCreateNote={handleCreateNote}
        onGenerateOutline={handleGenerateOutline}
        onSummarizeNote={handleSummarize}
        onExtractTags={handleExtractTags}
        onFusionAnalysis={handleFusionAnalysis}
      />
    </div>
  )
}
