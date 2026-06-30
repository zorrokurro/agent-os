import type { Notebook, Note, Source } from '../../types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  type?: 'summary' | 'outline' | 'tags' | 'chat'
}

export interface NotebookSettings {
  modelId: string
  obsidianVault: string
}

export const NOTEBOOK_COLORS = ['#a078ff', '#0566d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
export const NOTEBOOK_ICONS = ['📓', '📔', '📕', '📗', '📘', '📙', '🗂️', '💡', '🔬', '🎯', '🚀', '🧠']

export type { Notebook, Note, Source }
