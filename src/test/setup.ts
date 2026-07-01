import '@testing-library/jest-dom'

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    notebookList: vi.fn().mockResolvedValue([]),
    notebookCreate: vi.fn().mockResolvedValue({ id: '1', name: 'Test', noteCount: 0 }),
    notebookDelete: vi.fn().mockResolvedValue(undefined),
    noteList: vi.fn().mockResolvedValue([]),
    noteCreate: vi.fn().mockResolvedValue({ id: '1', title: 'Test', content: '', tags: [], pinned: false }),
    noteUpdate: vi.fn().mockResolvedValue(undefined),
    noteDelete: vi.fn().mockResolvedValue(undefined),
    noteAllTags: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({ apiModel: 'gpt-4', obsidianVault: '' }),
    obsidianSync: vi.fn().mockResolvedValue(undefined),
    sourceGet: vi.fn().mockResolvedValue([]),
    sourceImportPDF: vi.fn().mockResolvedValue({ canceled: true }),
    sourceImportURL: vi.fn().mockResolvedValue(undefined),
    sourceImportText: vi.fn().mockResolvedValue(undefined),
    sourceDelete: vi.fn().mockResolvedValue(undefined),
    aiChat: vi.fn().mockResolvedValue('Test response'),
    saveConversation: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
})
