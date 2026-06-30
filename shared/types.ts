/**
 * shared/types.ts — Single source of truth for types shared across
 * frontend (src/) and backend (electron/).
 *
 * Both sides import from here. Local definitions in electron/services/*.ts
 * should be removed after migration.
 */

// ─── Hardware ────────────────────────────────────────────────────────────────

export interface GpuInfo {
  model: string
  vendor: string
  vramMB: number
  isActive: boolean
  isDedicated: boolean
}

export interface HardwareInfo {
  cpu: string
  cpuCores: number
  ramGB: number
  gpu: string
  vramGB: number
  diskFreeGB: number
  windowsVersion: string
  recommendedModel: string
  allGpus: GpuInfo[]
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string
  name: string
  description: string
  icon?: string
  status: 'stopped' | 'running' | 'error' | 'installing'
  installed: boolean
  port?: number
  version?: string
  category?: string
  tags?: string[]
  author?: string
  price?: number | 'free'
  rating?: number
  runtimeType?: 'node' | 'python' | 'binary' | 'docker' | 'external'
}

export type RunMode = 'local' | 'api' | 'both'
export type ModelPreference = 'speed' | 'memory' | 'auto'
export type ProviderId = 'ollama' | 'openrouter' | 'anthropic' | 'openai'

export interface ProviderModel {
  id: string
  name: string
  description: string
  contextLength: number
  strengths: string[]
}

export interface ModelProvider {
  id: string
  name: string
  description: string
  apiBase: string
  apiKeyEnvVar: string
  requiresKey: boolean
  requiresLocal: boolean
  models: ProviderModel[]
  website: string
}

// ─── Installation ────────────────────────────────────────────────────────────

export interface InstallOptions {
  agents: string[]
  runMode: RunMode
  modelPreference: ModelPreference
  providerId: ProviderId
  modelId: string
  apiKey: string
  autoStart: boolean
  selectedGpuIndex: number
}

export type ProgressData = InstallProgress

export interface InstallProgress {
  step: string
  percent: number
  message: string
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export interface MemoryStats {
  totalFiles: number
  totalSize: number
  lastUpdated: string
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export interface CatalogAgent {
  id: string
  name: string
  author: string
  description: string
  repoUrl: string
  category: string
  tags: string[]
  price: number | 'free'
  featured?: boolean
}

export interface MemoryItem {
  path: string
  name: string
  type: 'profile' | 'projects' | 'conversations' | 'outputs'
  content?: string
  modified: string
}

// ─── Source ──────────────────────────────────────────────────────────────────

export interface Source {
  id: string
  title: string
  type: 'pdf' | 'url' | 'text'
  preview: string
  content: string
  tags: string[]
  createdAt: string
  metadata: Record<string, unknown>
}

// ─── Notebook ────────────────────────────────────────────────────────────────

export interface Notebook {
  id: string
  name: string
  description: string
  icon: string
  color: string
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  notebookId: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

// ─── System Detection ────────────────────────────────────────────────────────

export interface SystemAgent {
  id: string
  name: string
  source: 'ollama' | 'pip' | 'npm' | 'path' | 'docker' | 'directory' | 'standalone'
  version: string
  description: string
  installed: boolean
  running: boolean
  details: Record<string, unknown>
}

// ─── Research ────────────────────────────────────────────────────────────────

export type ReferenceType = 'news' | 'paper' | 'web' | 'video' | 'code' | 'discussion'

export interface ResearchReport {
  title: string
  abstract: string
  sections: Array<{
    heading: string
    level: number
    content: string
    sources: string[]
  }>
  references: Array<{
    index: number
    title: string
    url: string
    source: string
    date?: string
    type: ReferenceType
  }>
  metadata: {
    query: string
    generatedAt: string
    totalSources: number
    sourcesBreakdown: Record<string, number>
    reportPath: string
  }
}

// ─── MCP ─────────────────────────────────────────────────────────────────────

export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  error?: string
}
