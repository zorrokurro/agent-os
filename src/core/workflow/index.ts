/**
 * Workflow Runtime
 *
 * Core module for workflow execution.
 *
 * Architecture:
 *   WorkflowRuntime (top-level orchestrator)
 *     └── WorkflowEngine (execution logic)
 *           ├── TaskGraph (DAG)
 *           ├── TaskExecutor (pluggable execution)
 *           └── WorkflowContext (shared context)
 *
 *   CommandBus (Command → Handler → Event)
 *   WorkflowEvents (EventBus integration)
 *
 * Usage:
 *   import { WorkflowRuntime, createEvent } from '@/core'
 *
 *   const runtime = new WorkflowRuntime({ logger, events })
 *
 *   // Register a task handler
 *   runtime.registerHandler('agent', async (task, ctx) => {
 *     // run agent
 *     return { response: '...' }
 *   })
 *
 *   // Register a workflow
 *   runtime.registerWorkflow({
 *     id: 'my-workflow',
 *     name: 'My Workflow',
 *     version: '1.0.0',
 *     tasks: [
 *       { id: 'step1', name: 'Step 1', type: 'agent', dependencies: [], config: { ... } },
 *       { id: 'step2', name: 'Step 2', type: 'agent', dependencies: ['step1'], config: { ... } },
 *     ],
 *   })
 *
 *   // Execute
 *   const result = await runtime.run('my-workflow', { input: 'data' })
 */

// ─── Models ──────────────────────────────────────────────────────────────────

export type {
  WorkflowDefinition,
  WorkflowConfig,
  WorkflowExecution,
  WorkflowState,
  TaskExecutionState,
  WorkflowResult,
  TaskResult,
} from './models/Workflow'

export {
  createSequentialWorkflow,
  createParallelWorkflow,
  generateExecutionId,
} from './models/Workflow'

export type { WorkflowState as TaskStateType } from './models/WorkflowState'

export {
  WORKFLOW_TRANSITIONS,
  TASK_TRANSITIONS,
  isValidTransition,
  isValidTaskTransition,
  isTerminalState,
  isTerminalTaskState,
  isActiveState,
} from './models/WorkflowState'

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type {
  TaskType,
  TaskDefinition,
  TaskConfig,
  AgentTaskConfig,
  CodeTaskConfig,
  ConditionTaskConfig,
  ParallelTaskConfig,
  JoinTaskConfig,
  CustomTaskConfig,
  TaskInstance,
} from './tasks/Task'

export { createTaskInstance } from './tasks/Task'

export { TaskGraph } from './tasks/TaskGraph'

export type {
  TaskExecutor,
  TaskHandler,
} from './tasks/TaskExecutor'

export {
  SequentialExecutor,
  ParallelExecutor,
  TaskHandlerRegistry,
} from './tasks/TaskExecutor'

// ─── Context ─────────────────────────────────────────────────────────────────

export { WorkflowContext } from './WorkflowContext'

export type {
  WorkflowContextData,
  WorkflowContextOptions,
} from './WorkflowContext'

// ─── Commands ────────────────────────────────────────────────────────────────

export { CommandBus, createCommand } from './commands/CommandBus'

export type {
  Command,
  CommandHandler,
  CommandResult,
  RunWorkflowCommand,
  CancelWorkflowCommand,
  PauseWorkflowCommand,
  ResumeWorkflowCommand,
  ExecuteTaskCommand,
  CreateNotebookCommand,
  DeleteNotebookCommand,
  StartAgentCommand,
  StopAgentCommand,
} from './commands/CommandBus'

// ─── Events ──────────────────────────────────────────────────────────────────

export type {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
  WorkflowCancelledEvent,
  WorkflowPausedEvent,
  WorkflowResumedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskRetryingEvent,
  TaskSkippedEvent,
} from './events/WorkflowEvents'

export { createWorkflowEvent } from './events/WorkflowEvents'

// ─── Engine & Runtime ────────────────────────────────────────────────────────

export { WorkflowEngine } from './WorkflowEngine'

export type { WorkflowEngineOptions } from './WorkflowEngine'

export { WorkflowRuntime } from './WorkflowRuntime'

export type { WorkflowRuntimeOptions, WorkflowRuntimeStats } from './WorkflowRuntime'
