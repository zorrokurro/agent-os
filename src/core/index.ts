/**
 * Core SDK
 *
 * Public API for the AgentOS core module.
 * This module has ZERO dependencies on React, Electron, or any UI framework.
 *
 * Import structure:
 *   import { IPCClient, ElectronTransport } from '@/core'
 *   import { Logger, createLogger } from '@/core'
 *   import { AppError, IPCError } from '@/core'
 *   import { EventBus, createEvent } from '@/core'
 */

// ─── IPC ─────────────────────────────────────────────────────────────────────
export {
  IPCClient,
  IPC_CHANNELS,
  IPC_EVENTS,
  type IPCInvokeOptions,
  type IPCStreamOptions,
  type IPCStreamHandle,
  type IPCContract,
  type IPCEventContract,
  type IPCRequest,
  type IPCResponse,
  type IPCEventData,
  type IPCChannelKey,
  type IPCEventChannelKey,
  type IPCChannel,
  type IPCEvent,
  type IPCTransport,
  ElectronTransport,
  MockTransport,
} from './ipc'

// ─── Errors ──────────────────────────────────────────────────────────────────
export {
  AppError,
  IPCError,
  ValidationError,
  type ErrorCode,
  type AppErrorContext,
  type IPCErrorCode,
  type IPCErrorContext,
  type FieldError,
} from './errors'

// ─── Logger ──────────────────────────────────────────────────────────────────
export {
  Logger,
  createLogger,
  getGlobalLogger,
  setGlobalLogger,
  ConsoleTransport,
  type LoggerOptions,
  type LoggerTransport,
  type LogLevel,
  type LogEntry,
  type PerfTimer,
} from './logger'

// ─── Metrics ─────────────────────────────────────────────────────────────────
export {
  Metrics,
  Counter,
  Histogram,
  Gauge,
  Timer,
  getGlobalMetrics,
  setGlobalMetrics,
  type MetricSnapshot,
} from './logger/Metrics'

// ─── Events ──────────────────────────────────────────────────────────────────
export {
  EventBus,
  getGlobalEventBus,
  setGlobalEventBus,
  createEvent,
  type IEventBus,
  type BaseEvent,
  type EventHandler,
  type Subscription,
  type AgentOSEvent,
  type AgentOSEventType,
  type EventData,
} from './events'

// ─── Workflow Runtime ─────────────────────────────────────────────────────────
export {
  // Runtime & Engine
  WorkflowRuntime,
  WorkflowEngine,

  // Task Graph
  TaskGraph,

  // Executors
  SequentialExecutor,
  ParallelExecutor,
  TaskHandlerRegistry,

  // Context
  WorkflowContext,

  // Command Bus
  CommandBus,
  createCommand,

  // State Machine
  WORKFLOW_TRANSITIONS,
  TASK_TRANSITIONS,
  isValidTransition,
  isValidTaskTransition,
  isTerminalState,
  isTerminalTaskState,
  isActiveState,

  // Helpers
  createTaskInstance,
  createSequentialWorkflow,
  createParallelWorkflow,
  generateExecutionId,
  createWorkflowEvent,

  // Types
  type WorkflowRuntimeOptions,
  type WorkflowRuntimeStats,
  type WorkflowEngineOptions,
  type WorkflowDefinition,
  type WorkflowConfig,
  type WorkflowExecution,
  type WorkflowState,
  type WorkflowResult,
  type TaskResult,
  type TaskDefinition,
  type TaskType,
  type TaskConfig,
  type TaskInstance,
  type TaskExecutor,
  type TaskHandler,
  type WorkflowContextData,
  type WorkflowContextOptions,
  type Command,
  type CommandHandler,
  type CommandResult,
  type WorkflowEvent,
  type WorkflowEventType,
} from './workflow'

// ─── Plugin System ───────────────────────────────────────────────────────────
export {
  // Manager
  PluginManager,

  // Registry
  PluginRegistry,
  CapabilityRegistry,

  // Context
  createPluginContext,

  // Manifest
  validateManifest,

  // Lifecycle
  PLUGIN_TRANSITIONS,
  isValidPluginTransition,
  isTerminalPluginState,
  isPluginActive,

  // Capabilities
  createCommandCapability,
  createTaskCapability,
  createWorkflowCapability,
  createEventCapability,
  createServiceCapability,

  // Sources
  FilesystemPluginSource,
  BuiltinPluginSource,
  RemotePluginSource,

  // Types
  type PluginManagerOptions,
  type PluginManagerStats,
  type PluginHealthResult,
  type PluginEntry,
  type Plugin,
  type PluginFactory,
  type PluginHealth,
  type PluginHealthStatus,
  type PluginContext,
  type PluginContextOptions,
  type PluginManifest,
  type PluginState,
  type CapabilityType,
  type PermissionType,
  type AnyCapability,
  type PluginSource,
  type CapabilitySummary,
  type PluginServiceAPI,
} from './plugins'

// ─── Knowledge Runtime ───────────────────────────────────────────────────────
export {
  // Engines
  MemoryEngine,
  RetrievalEngine,
  KnowledgeGraph,

  // Providers
  MockEmbeddingProvider,
  InMemoryEmbeddingProvider,
  InMemoryStore,
  InMemorySearchProvider,

  // Types
  type MemoryEngineOptions,
  type RememberOptions,
  type RecallOptions,
  type MemoryEngineStats,
  type RetrievalOptions,
  type RetrievalContext,
  type MemoryType,
  type MemoryEntry,
  type MemoryMetadata,
  type MemoryQuery,
  type MemorySearchResult,
  type KnowledgeEntity,
  type KnowledgeRelation,
  type EmbeddingResult,
  type EmbeddingProvider,
  type EmbeddingProviderOptions,
  type MemoryStore,
  type SearchProvider,
  type SearchOptions,
  type SearchStats,
} from './knowledge'

// ─── Agent Runtime ───────────────────────────────────────────────────────────
export {
  // Runtime
  AgentRuntime,

  // Registry
  AgentRegistry,

  // Executor
  AgentExecutor,
  createMockExecutor,

  // Sessions
  SessionManager,

  // Scheduler
  AgentScheduler,

  // Types
  type AgentType,
  type AgentDefinition,
  type AgentCapability,
  type AgentConfigSchema,
  type AgentConfigProperty,
  type AgentState,
  type AgentInstance,
  type AgentSession,
  type AgentMessage,
  type AgentMessageRole,
  type AgentToolCall,
  type AgentToolResult,
  type AgentExecution,
  type AgentTokenUsage,
  type AgentQuery,
  type AgentExecutionContext,
  type AgentExecutionResult,
  type AgentExecutorHandler,
  type TaskPriority,
  type TaskStatus,
  type ScheduledTask,
  type AgentSchedulerOptions,
  type RuntimeState,
  type AgentRuntimeOptions,
} from './agents'

// ─── AgentOS Runtime ─────────────────────────────────────────────────────────
export {
  AgentOSRuntime,
  type AgentOSState,
  type RuntimeHealth,
  type AgentOSOptions,
} from './runtime'
