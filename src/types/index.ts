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

export interface InstallProgress {
  step: string
  percent: number
  message: string
}

export interface MemoryStats {
  totalFiles: number
  totalSize: number
  lastUpdated: string
}

export interface ProgressData {
  step: string
  percent: number
  message: string
}

// Agent Catalog Registry
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
