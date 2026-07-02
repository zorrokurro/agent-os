# ADR-0009: AgentOS Runtime Facade

**Status:** Accepted  
**Date:** 2026-07-02  
**Deciders:** AgentOS Core Team

## Context

The AgentOS platform has four independent runtimes: Agent Runtime, Workflow Runtime, Plugin System, and Knowledge Engine. Users need a single entry point to initialize and manage all runtimes, rather than importing and wiring each one manually.

## Decision

We adopt an **AgentOS Runtime Facade** that:

1. **Single Entry Point**: `AgentOSRuntime` class manages all runtimes
2. **Lifecycle Management**: Start/stop all runtimes in correct order
3. **Health Aggregation**: Single `health()` call returns status of all runtimes
4. **Selective Enable**: Each runtime can be enabled/disabled via options
5. **Access Methods**: `getAgentRuntime()`, `getWorkflowRuntime()`, etc.

### Architecture

```
AgentOSRuntime (facade)
├── AgentRuntime      — Agent execution
├── WorkflowRuntime   — DAG workflows
├── PluginManager     — Plugin system
└── MemoryEngine      — Knowledge storage
```

### Key Design Decisions

1. **Initialization Order**: Agents → Workflow → Plugins → Knowledge
2. **Shutdown Order**: Reverse of initialization (Knowledge → Plugins → Agents)
3. **Selective Enable**: Each runtime has an `enable*` option (default: true)
4. **Context Injection**: Logger and EventBus shared across all runtimes
5. **Health Check**: Aggregates health from all enabled runtimes

### Dependency Direction

```
AgentOSRuntime → AgentRuntime, WorkflowRuntime, PluginManager, MemoryEngine
```

## Consequences

### Positive
- Single entry point simplifies initialization
- Health aggregation for monitoring
- Selective enable for testing and development
- Clean shutdown order prevents resource leaks

### Negative
- Facade adds another abstraction layer
- All runtimes must be compatible with shared Logger/EventBus

### Risks
- Low: Facade is thin, logic remains in individual runtimes

## Alternatives Considered

### 1. Manual Initialization
Users import and wire each runtime manually. Rejected: error-prone, hard to maintain consistent initialization order.

### 2. Dependency Injection Container
Use a DI container (InversifyJS, tsyringe). Rejected: over-engineered for current needs, adds runtime dependency.

### 3. Static Singleton
Global singleton with static methods. Rejected: hard to test, prevents multiple instances.

## References

- `src/core/runtime/` — Implementation
- `src/core/runtime/__tests__/AgentOSRuntime.test.ts` — Tests (11 tests)
