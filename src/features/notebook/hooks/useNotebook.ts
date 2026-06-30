import { useState, useCallback, useEffect } from 'react'
import type { Notebook, Note } from '../types'
import * as service from '../services/notebook.service'

export function useNotebook() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([])

  const loadNotebooks = useCallback(async () => {
    setNotebooks(await service.listNotebooks())
  }, [])

  const loadTags = useCallback(async () => {
    setAllTags(await service.getAllTags())
  }, [])

  useEffect(() => { loadNotebooks(); loadTags() }, [loadNotebooks, loadTags])

  const selectNotebook = useCallback(async (nb: Notebook) => {
    setSelectedNotebook(nb)
    setSelectedNote(null)
    setEditContent('')
    setNotes(await service.listNotes(nb.id))
  }, [])

  const selectNote = useCallback((note: Note) => {
    setSelectedNote(note)
    setEditContent(note.content)
  }, [])

  const createNotebook = useCallback(async (name: string, desc: string, icon: string, color: string) => {
    if (!name.trim()) return
    const result = await service.createNotebook(name, desc, icon, color)
    if (result && 'error' in result) return
    await loadNotebooks()
  }, [loadNotebooks])

  const createNote = useCallback(async () => {
    if (!selectedNotebook) return
    const note = await service.createNote(selectedNotebook.id, '未命名筆記')
    await selectNotebook(selectedNotebook)
    selectNote(note)
  }, [selectedNotebook, selectNotebook, selectNote])

  const saveNote = useCallback(async () => {
    if (!selectedNote) return
    await service.updateNote(selectedNote.id, { content: editContent })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
  }, [selectedNote, editContent, selectedNotebook, selectNotebook])

  const deleteNotebook = useCallback(async (id: string) => {
    await service.deleteNotebook(id)
    if (selectedNotebook?.id === id) {
      setSelectedNotebook(null)
      setNotes([])
      setSelectedNote(null)
    }
    await loadNotebooks()
  }, [selectedNotebook, loadNotebooks])

  const deleteNote = useCallback(async (id: string) => {
    await service.deleteNote(id)
    if (selectedNote?.id === id) {
      setSelectedNote(null)
      setEditContent('')
    }
    if (selectedNotebook) await selectNotebook(selectedNotebook)
  }, [selectedNote, selectedNotebook, selectNotebook])

  const togglePin = useCallback(async (note: Note) => {
    await service.updateNote(note.id, { pinned: !note.pinned })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
  }, [selectedNotebook, selectNotebook])

  const addTag = useCallback(async (note: Note, tag: string) => {
    if (!tag.trim() || note.tags.includes(tag)) return
    await service.updateNote(note.id, { tags: [...note.tags, tag] })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    await loadTags()
  }, [selectedNotebook, selectNotebook, loadTags])

  const removeTag = useCallback(async (note: Note, tag: string) => {
    await service.updateNote(note.id, { tags: note.tags.filter(t => t !== tag) })
    if (selectedNotebook) await selectNotebook(selectedNotebook)
    await loadTags()
  }, [selectedNotebook, selectNotebook, loadTags])

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
    deleteNotebook, deleteNote, togglePin, addTag, removeTag,
    updateEditContent, updateSelectedNoteTitle,
    loadNotebooks, loadTags,
  }
}
