import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Notebook, Note } from '../../../types'
import * as service from '../services/notebook.service'

export function useNotebook() {
  const queryClient = useQueryClient()

  const { data: notebooks = [] } = useQuery({
    queryKey: ['notebooks'],
    queryFn: service.listNotebooks,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: service.getAllTags,
  })

  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', selectedNotebook?.id],
    queryFn: () => service.listNotes(selectedNotebook!.id),
    enabled: !!selectedNotebook,
  })

  const createNotebookMutation = useMutation({
    mutationFn: (params: { name: string; desc: string; icon: string; color: string }) =>
      service.createNotebook(params.name, params.desc, params.icon, params.color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    },
  })

  const deleteNotebookMutation = useMutation({
    mutationFn: (id: string) => service.deleteNotebook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] })
      setSelectedNotebook(null)
    },
  })

  const createNoteMutation = useMutation({
    mutationFn: (params: { notebookId: string; title: string }) =>
      service.createNote(params.notebookId, params.title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', selectedNotebook?.id] })
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: (params: { noteId: string; patch: Record<string, unknown> }) =>
      service.updateNote(params.noteId, params.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', selectedNotebook?.id] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => service.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', selectedNotebook?.id] })
      setSelectedNote(null)
      setEditContent('')
    },
  })

  const selectNotebook = useCallback((nb: Notebook) => {
    setSelectedNotebook(nb)
    setSelectedNote(null)
    setEditContent('')
  }, [])

  const selectNote = useCallback((note: Note) => {
    setSelectedNote(note)
    setEditContent(note.content)
  }, [])

  const createNotebook = useCallback(async (name: string, desc: string, icon: string, color: string) => {
    if (!name.trim()) return
    await createNotebookMutation.mutateAsync({ name, desc, icon, color })
  }, [createNotebookMutation])

  const createNote = useCallback(async () => {
    if (!selectedNotebook) return
    const note = await createNoteMutation.mutateAsync({ notebookId: selectedNotebook.id, title: '未命名筆記' })
    selectNote(note)
  }, [selectedNotebook, createNoteMutation, selectNote])

  const saveNote = useCallback(async () => {
    if (!selectedNote) return
    await updateNoteMutation.mutateAsync({ noteId: selectedNote.id, patch: { content: editContent } })
  }, [selectedNote, editContent, updateNoteMutation])

  const deleteNotebookFn = useCallback(async (id: string) => {
    await deleteNotebookMutation.mutateAsync(id)
  }, [deleteNotebookMutation])

  const deleteNoteFn = useCallback(async (id: string) => {
    await deleteNoteMutation.mutateAsync(id)
  }, [deleteNoteMutation])

  const togglePin = useCallback(async (note: Note) => {
    await updateNoteMutation.mutateAsync({ noteId: note.id, patch: { pinned: !note.pinned } })
  }, [updateNoteMutation])

  const addTag = useCallback(async (note: Note, tag: string) => {
    if (!tag.trim() || note.tags.includes(tag)) return
    await updateNoteMutation.mutateAsync({ noteId: note.id, patch: { tags: [...note.tags, tag] } })
  }, [updateNoteMutation])

  const removeTag = useCallback(async (note: Note, tag: string) => {
    await updateNoteMutation.mutateAsync({ noteId: note.id, patch: { tags: note.tags.filter(t => t !== tag) } })
  }, [updateNoteMutation])

  const updateEditContent = useCallback((content: string) => {
    setEditContent(content)
  }, [])

  const updateSelectedNoteTitle = useCallback((title: string) => {
    setSelectedNote(p => p ? { ...p, title } : null)
    if (selectedNote) service.updateNote(selectedNote.id, { title })
  }, [selectedNote])

  return {
    notebooks, selectedNotebook, notes, selectedNote, editContent, allTags,
    selectNotebook, selectNote, createNotebook, createNote, saveNote,
    deleteNotebook: deleteNotebookFn, deleteNote: deleteNoteFn,
    togglePin, addTag, removeTag,
    updateEditContent, updateSelectedNoteTitle,
  }
}
