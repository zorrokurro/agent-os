import { useState, useCallback } from 'react'
import type { Source } from '../types'
import * as service from '../services/notebook.service'

export function useNotebookSources() {
  const [sources, setSources] = useState<Source[]>([])
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)

  const loadSources = useCallback(async (notebookId: string) => {
    try {
      setSources(await service.getSources(notebookId))
    } catch {
      setSources([])
    }
  }, [])

  const handleImportPDF = useCallback(async (notebookId: string) => {
    setSourceLoading(true)
    try {
      const result = await service.importPDF(notebookId)
      if (result && 'error' in result) return
      if (result && 'canceled' in result) return
      await loadSources(notebookId)
    } finally {
      setSourceLoading(false)
    }
  }, [loadSources])

  const handleImportURL = useCallback(async (notebookId: string) => {
    if (!urlInput.trim()) return
    setSourceLoading(true)
    try {
      const result = await service.importURL(urlInput.trim(), notebookId)
      if (result && 'error' in result) return
      setUrlInput('')
      setShowUrlInput(false)
      await loadSources(notebookId)
    } finally {
      setSourceLoading(false)
    }
  }, [urlInput, loadSources])

  const handleImportText = useCallback(async (notebookId: string) => {
    if (!textInput.trim()) return
    setSourceLoading(true)
    try {
      const result = await service.importText(textInput.trim(), notebookId)
      if (result && 'error' in result) return
      setTextInput('')
      setShowTextInput(false)
      await loadSources(notebookId)
    } finally {
      setSourceLoading(false)
    }
  }, [textInput, loadSources])

  const handleDeleteSource = useCallback(async (sourceId: string, notebookId: string) => {
    await service.deleteSource(sourceId)
    await loadSources(notebookId)
  }, [loadSources])

  return {
    sources, showUrlInput, urlInput, showTextInput, textInput, sourceLoading,
    setShowUrlInput, setUrlInput, setShowTextInput, setTextInput,
    loadSources, handleImportPDF, handleImportURL, handleImportText, handleDeleteSource,
  }
}
