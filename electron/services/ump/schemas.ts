export const SCHEMA_VERSION = '0.1.0'

export type MemoryType = 'semantic' | 'episodic' | 'procedural' | 'graph'
export type EpisodeType = 'message' | 'json' | 'text' | 'fact_triple'
export type BlockLabel = 'human' | 'persona' | 'system/' | 'skills/'
export type WarningLevel = 'info' | 'warning' | 'error'

export interface MemoryRelation {
  target_id: string
  relation_type: string
  fact: string
  confidence: number
  valid_at?: string
  expired_at?: string
  invalid_at?: string
  attributes: Record<string, unknown>
}

export interface Provenance {
  source: string
  original_format: string
  source_description: string
  agent_id?: string
  user_id?: string
  conversation_id?: string
  confidence: number
  extracted_at: string
}

export interface TemporalInfo {
  created_at: string
  updated_at?: string
  valid_from?: string
  valid_to?: string
  expires_at?: string
}

export interface UniversalMemory {
  schema_version: string
  id: string
  content: string
  memory_type: MemoryType
  group_id?: string
  episode_type?: EpisodeType
  block_label?: string
  block_limit?: number
  read_only: boolean
  hidden: boolean
  temporal: TemporalInfo
  provenance: Provenance
  tags: string[]
  scope?: string
  importance: number
  relations: MemoryRelation[]
  embedding?: number[]
  metadata: Record<string, unknown>
  conversion_warnings: string[]
}

export interface AdapterCapabilities {
  semantic: boolean
  episodic: boolean
  procedural: boolean
  graph: boolean
  temporal: boolean
}

export function adapterSupports(cap: AdapterCapabilities, memoryType: MemoryType): boolean {
  const map: Record<MemoryType, boolean> = {
    semantic: cap.semantic,
    episodic: cap.episodic,
    procedural: cap.procedural,
    graph: cap.graph,
  }
  return map[memoryType] ?? false
}

export function createMemory(overrides: Partial<UniversalMemory> & { id: string; content: string; memory_type: MemoryType }): UniversalMemory {
  return {
    schema_version: SCHEMA_VERSION,
    read_only: false,
    hidden: false,
    temporal: { created_at: new Date().toISOString() },
    provenance: { source: 'unknown', original_format: '', source_description: '', confidence: 1.0, extracted_at: new Date().toISOString() },
    tags: [],
    importance: 0.5,
    relations: [],
    metadata: {},
    conversion_warnings: [],
    ...overrides,
  }
}

// === Warnings ===

export function createWarning(sourceFormat: string, targetFormat: string, field: string, level: WarningLevel = 'warning'): string {
  return `[${sourceFormat} -> ${targetFormat}] Field '${field}' not fully supported (${level}), preserved in metadata`
}

export function createWarningsBatch(sourceFormat: string, targetFormat: string, unsupportedFields: string[], level: WarningLevel = 'warning'): string[] {
  return unsupportedFields.map(f => createWarning(sourceFormat, targetFormat, f, level))
}

// === Migration ===

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>
const migrations = new Map<string, MigrationFn>()

export function registerMigration(fromVersion: string, toVersion: string): (fn: MigrationFn) => MigrationFn {
  return (fn) => {
    migrations.set(`${fromVersion}->${toVersion}`, fn)
    return fn
  }
}

export function migrateToVersion(data: Record<string, unknown>, targetVersion: string): UniversalMemory {
  const currentVersion = (data.schema_version as string) || '0.0.0'
  if (currentVersion === targetVersion) {
    return data as unknown as UniversalMemory
  }
  const key = `${currentVersion}->${targetVersion}`
  const fn = migrations.get(key)
  if (fn) {
    data = fn(data)
  } else {
    data.schema_version = targetVersion
  }
  return data as unknown as UniversalMemory
}

export function getAvailableMigrations(): string[] {
  return Array.from(migrations.keys())
}
