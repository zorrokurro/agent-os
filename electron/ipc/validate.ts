/**
 * ipc/validate.ts — Lightweight IPC input validation helpers for Zod 4.
 *
 * Usage in handlers:
 *   import { validate, schemas } from './ipc/validate'
 *
 *   ipcMain.handle('start-agent', async (_, id) => {
 *     const validId = validate(schemas.agentId, id)
 *     return agentMgr.startAgent(validId)
 *   })
 */

import { z } from 'zod'

// ─── Common primitives ───────────────────────────────────────────────────────

export const safeId = z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format')
export const safeString = z.string().min(1).max(2000)
export const safeUrl = z.string().url().max(2048)
export const safePort = z.number().int().nonnegative().max(65535)

export const chatMessage = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100_000),
})
export const chatMessages = z.array(chatMessage).max(200)

// ─── Agent schemas ──────────────────────────────────────────────────────────

export const agentId = safeId

export const installOptions = z.object({
  agents: z.array(safeId).min(1).max(20),
  runMode: z.enum(['local', 'api', 'both']),
  modelPreference: z.enum(['speed', 'memory', 'auto']),
  providerId: z.string().max(100),
  modelId: z.string().max(200),
  apiKey: z.string().max(500),
  autoStart: z.boolean(),
  selectedGpuIndex: z.number().int(),
})

// ─── Chat / AI schemas ──────────────────────────────────────────────────────

export const chatInput = z.object({
  model: z.string().min(1).max(200),
  messages: chatMessages,
})

export const aiChatInput = z.object({
  model: z.string().min(1).max(200),
  messages: chatMessages,
  baseUrl: z.string().url().max(2048).optional(),
})

export const openrouterChatInput = z.object({
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
  messages: chatMessages,
})

// ─── Settings schemas ────────────────────────────────────────────────────────

export const settingsUpdate = z.record(z.string(), z.unknown())

export const fullSettings = z.object({
  ollamaUrl: z.string().url().max(2048).optional(),
  apiProvider: z.string().max(100).optional(),
  apiKey: z.string().max(500).optional(),
  apiModel: z.string().max(200).optional(),
})

// ─── File / Memory schemas ──────────────────────────────────────────────────

export const filePath = z.string().min(1).max(1000)
export const memoryContent = z.string().max(1_000_000)

// ─── Notebook / Note schemas ─────────────────────────────────────────────────

export const notebookName = z.string().min(1).max(200)
export const notebookDesc = z.string().max(2000)
export const notebookIcon = z.string().max(10)
export const notebookColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
export const noteTitle = z.string().min(1).max(500)
export const noteContent = z.string().max(500_000)
export const noteTags = z.array(z.string().max(50)).max(20)

// ─── MCP schemas ─────────────────────────────────────────────────────────────

export const mcpServerConfig = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  transport: z.enum(['stdio', 'sse']),
  command: z.string().max(500).optional(),
  args: z.array(z.string().max(200)).max(20).optional(),
  env: z.record(z.string(), z.string().max(1000)).optional(),
  url: z.string().url().max(2048).optional(),
  enabled: z.boolean(),
})

export const mcpToolCall = z.object({
  serverId: z.string().max(100),
  toolName: z.string().max(200),
  args: z.record(z.string(), z.unknown()),
})

// ─── UMP schemas ─────────────────────────────────────────────────────────────

export const umpTask = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(10_000),
  target: z.string().max(100),
  source: z.string().max(100).optional(),
})

export const umpMemory = z.object({
  content: z.string().min(1).max(100_000),
  memoryType: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  group_id: z.string().max(100).optional(),
})

// ─── Discord schemas ─────────────────────────────────────────────────────────

export const discordMessage = z.string().min(1).max(2000)

// ─── GitHub schemas ──────────────────────────────────────────────────────────

export const githubUrl = z
  .string()
  .url()
  .max(2048)
  .refine((url) => url.includes('github.com'), 'Must be a GitHub URL')

// ─── Council schemas ─────────────────────────────────────────────────────────

export const councilInput = z.object({
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
  question: z.string().min(1).max(10_000),
  mode: z.enum(['general', 'review', 'design', 'plan', 'research']),
})

// ─── Validation helper ───────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyZodSchema = z.ZodType<any, any, any>

/**
 * Validate input against a Zod schema. Returns parsed value or throws.
 */
export function validate(schema: AnyZodSchema, input: unknown): any {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i: any) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Validation failed: ${issues}`)
  }
  return result.data
}

/**
 * Safe validate — returns [data, null] on success, [null, error] on failure.
 */
export function safeValidate(schema: AnyZodSchema, input: unknown): [any, null] | [null, Error] {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i: any) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return [null, new Error(`Validation failed: ${issues}`)]
  }
  return [result.data, null]
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Namespace export for convenience ────────────────────────────────────────

export const schemas = {
  safeId,
  safeString,
  safeUrl,
  safePort,
  chatMessage,
  chatMessages,
  agentId,
  installOptions,
  chatInput,
  aiChatInput,
  openrouterChatInput,
  settingsUpdate,
  fullSettings,
  filePath,
  memoryContent,
  notebookName,
  notebookDesc,
  notebookIcon,
  notebookColor,
  noteTitle,
  noteContent,
  noteTags,
  mcpServerConfig,
  mcpToolCall,
  umpTask,
  umpMemory,
  discordMessage,
  githubUrl,
  councilInput,
}
