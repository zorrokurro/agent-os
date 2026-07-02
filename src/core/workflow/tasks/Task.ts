/**
 * Task Definition
 *
 * A Task is the smallest unit of work in a workflow.
 * Tasks are connected via dependencies forming a DAG.
 *
 * Task Types:
 *   - agent: Run an AI agent (LLM call)
 *   - code: Run code (e.g., tool call)
 *   - condition: Branch based on a condition
 *   - parallel: Fan-out to multiple tasks
 *   - join: Wait for all parallel tasks
 *   - custom: User-defined task type
 */

import type { TaskState } from '../models/WorkflowState'

// ─── Task Definition ─────────────────────────────────────────────────────────

export type TaskType = 'agent' | 'code' | 'condition' | 'parallel' | 'join' | 'custom'

export interface TaskDefinition {
  /** Unique task ID within the workflow */
  id: string
  /** Display name */
  name: string
  /** Task type */
  type: TaskType
  /** Task IDs this task depends on (DAG edges) */
  dependencies: string[]
  /** Task configuration (type-specific) */
  config: TaskConfig
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number
  /** Maximum retry attempts */
  maxRetries?: number
  /** Whether this task is optional (won't fail workflow if skipped) */
  optional?: boolean
}

// ─── Task Configs ────────────────────────────────────────────────────────────

export interface AgentTaskConfig {
  type: 'agent'
  /** Agent to use */
  agentId: string
  /** Prompt template (supports {{variable}} interpolation) */
  prompt: string
  /** System prompt override */
  systemPrompt?: string
  /** Max tokens for the response */
  maxTokens?: number
  /** Temperature override */
  temperature?: number
}

export interface CodeTaskConfig {
  type: 'code'
  /** Code to execute */
  code: string
  /** Language */
  language?: 'typescript' | 'javascript' | 'python'
  /** Working directory */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
}

export interface ConditionTaskConfig {
  type: 'condition'
  /** Expression to evaluate (returns boolean) */
  expression: string
  /** Task ID to execute if true */
  ifTrue: string
  /** Task ID to execute if false */
  ifFalse: string
}

export interface ParallelTaskConfig {
  type: 'parallel'
  /** Task IDs to run in parallel */
  tasks: string[]
}

export interface JoinTaskConfig {
  type: 'join'
  /** Number of tasks to wait for (0 = all) */
  waitCount?: number
}

export interface CustomTaskConfig {
  type: 'custom'
  /** Custom task handler name */
  handler: string
  /** Arbitrary config */
  params: Record<string, unknown>
}

export type TaskConfig =
  | AgentTaskConfig
  | CodeTaskConfig
  | ConditionTaskConfig
  | ParallelTaskConfig
  | JoinTaskConfig
  | CustomTaskConfig

// ─── Task Instance (Runtime) ─────────────────────────────────────────────────

export interface TaskInstance {
  /** Task definition */
  definition: TaskDefinition
  /** Current state */
  state: TaskState
  /** Number of retry attempts */
  retries: number
  /** Start time (ms since epoch) */
  startedAt?: number
  /** End time (ms since epoch) */
  completedAt?: number
  /** Error message if failed */
  error?: string
  /** Task output */
  output?: unknown
  /** Dependencies satisfied */
  dependenciesMet: boolean
}

/**
 * Create a new TaskInstance from a TaskDefinition.
 */
export function createTaskInstance(def: TaskDefinition): TaskInstance {
  return {
    definition: def,
    state: 'pending',
    retries: 0,
    dependenciesMet: def.dependencies.length === 0,
  }
}
