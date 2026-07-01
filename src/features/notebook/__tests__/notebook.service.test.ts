import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as service from '../services/notebook.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notebook.service', () => {
  describe('listNotebooks', () => {
    it('should call electronAPI.notebookList', async () => {
      const mockNotebooks = [{ id: '1', name: 'Test', noteCount: 0 }]
      vi.mocked(window.electronAPI.notebookList).mockResolvedValue(mockNotebooks as any)

      const result = await service.listNotebooks()

      expect(window.electronAPI.notebookList).toHaveBeenCalledOnce()
      expect(result).toEqual(mockNotebooks)
    })
  })

  describe('createNotebook', () => {
    it('should call electronAPI.notebookCreate with correct params', async () => {
      await service.createNotebook('My Notebook', 'Description', '📓', '#a078ff')

      expect(window.electronAPI.notebookCreate).toHaveBeenCalledWith(
        'My Notebook', 'Description', '📓', '#a078ff'
      )
    })
  })

  describe('deleteNotebook', () => {
    it('should call electronAPI.notebookDelete with id', async () => {
      await service.deleteNotebook('notebook-123')

      expect(window.electronAPI.notebookDelete).toHaveBeenCalledWith('notebook-123')
    })
  })

  describe('listNotes', () => {
    it('should return notes for a notebook', async () => {
      const mockNotes = [{ id: '1', title: 'Note 1', content: 'Content' }]
      vi.mocked(window.electronAPI.noteList).mockResolvedValue(mockNotes as any)

      const result = await service.listNotes('nb-1')

      expect(window.electronAPI.noteList).toHaveBeenCalledWith('nb-1')
      expect(result).toEqual(mockNotes)
    })
  })

  describe('createNote', () => {
    it('should create note with title', async () => {
      await service.createNote('nb-1', 'My Note')

      expect(window.electronAPI.noteCreate).toHaveBeenCalledWith('nb-1', 'My Note')
    })
  })

  describe('updateNote', () => {
    it('should update note with patch', async () => {
      await service.updateNote('note-1', { title: 'Updated', content: 'New content' })

      expect(window.electronAPI.noteUpdate).toHaveBeenCalledWith('note-1', {
        title: 'Updated',
        content: 'New content',
      })
    })
  })

  describe('deleteNote', () => {
    it('should delete note by id', async () => {
      await service.deleteNote('note-1')

      expect(window.electronAPI.noteDelete).toHaveBeenCalledWith('note-1')
    })
  })

  describe('getAllTags', () => {
    it('should return tags', async () => {
      const mockTags = [{ tag: 'ai', count: 5 }]
      vi.mocked(window.electronAPI.noteAllTags).mockResolvedValue(mockTags as any)

      const result = await service.getAllTags()

      expect(result).toEqual(mockTags)
    })
  })

  describe('parseSettings', () => {
    it('should parse settings with apiModel', () => {
      const result = service.parseSettings({ apiModel: 'gpt-4', obsidianVault: '/vault' })

      expect(result).toEqual({ modelId: 'gpt-4', obsidianVault: '/vault' })
    })

    it('should parse settings with modelId fallback', () => {
      const result = service.parseSettings({ modelId: 'llama3' })

      expect(result).toEqual({ modelId: 'llama3', obsidianVault: '' })
    })

    it('should return defaults for null', () => {
      const result = service.parseSettings(null)

      expect(result).toEqual({ modelId: '', obsidianVault: '' })
    })
  })

  describe('aiChat', () => {
    it('should call aiChat with model and messages', async () => {
      vi.mocked(window.electronAPI.aiChat).mockResolvedValue('AI response')

      const result = await service.aiChat({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(window.electronAPI.aiChat).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      })
      expect(result).toBe('AI response')
    })
  })

  describe('source management', () => {
    it('should get sources for notebook', async () => {
      await service.getSources('nb-1')

      expect(window.electronAPI.sourceGet).toHaveBeenCalledWith('nb-1')
    })

    it('should delete source by id', async () => {
      await service.deleteSource('src-1')

      expect(window.electronAPI.sourceDelete).toHaveBeenCalledWith('src-1')
    })

    it('should import URL', async () => {
      await service.importURL('https://example.com', 'nb-1')

      expect(window.electronAPI.sourceImportURL).toHaveBeenCalledWith('https://example.com', 'nb-1')
    })

    it('should import text', async () => {
      await service.importText('Some text', 'nb-1')

      expect(window.electronAPI.sourceImportText).toHaveBeenCalledWith('Some text', 'nb-1')
    })
  })
})
