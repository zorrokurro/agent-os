# ADR-0008: Agent Runtime Architecture

**Status:** Accepted  
**Date:** 2026-07-02  
**Deciders:** AgentOS Core Team

## Context

The AgentOS platform needs a runtime for executing AI agents. The runtime must support multiple agent types (LLM, tool, MCP, remote, local, human, composite), manage sessions and conversation history, and provide priority-based scheduling. The runtime must integrate cleanly with existing Core SDK modules (EventBus, Plugin System, Workflow Runtime) without creating circular dependencies.

## Decision

We adopt an **Agent Runtime** with four independent components, each with a single responsibility:

### Architecture

```
AgentRuntime (facade)
├── AgentRegistry      — Tracks agent definitions and state
├── SessionManager     — Manages conversations and history
├── AgentExecutor      — Executes agent tasks (pluggable handlers)
└── AgentScheduler     — Priority queue with concurrency control
```

### Key Design Decisions

1. **Registry over singleton**: Agent definitions are stored in a queryable registry, not scattered across modules.

2. **Session Manager with TTL**: Sessions are first-class with automatic expiry, supporting multi-turn conversations.

3. **Pluggable Executor with Dependency Injection**: The scheduler accepts an `executeFn` rather than importing `AgentExecutor` directly. This avoids circular dependencies and allows testing in isolation.

4. **Priority Scheduler**: Tasks are queued with priority (urgent/high/normal/low) and executed respecting concurrency limits.

5. **Agent Types**: Seven types cover all use cases:
   - `llm` — LLM-based (Claude, GPT, etc.)
   - `tool` — Tool-calling agents
   - `mcp` — MCP protocol agents
   - `local` — Local execution
   - `remote` — Remote API agents
   - `human` — Human-in-the-loop
   - `composite` — Multi-agent compositions

6. **State Machine**: Agents have states (idle, busy, paused, error, offline) tracked by the registry.

7. **Event Integration**: Runtime emits lifecycle events via EventBus when available.

### Dependency Direction

```
AgentRuntime → AgentRegistry, SessionManager, AgentExecutor, AgentScheduler
AgentScheduler → (executeFn injected, no direct dependency on AgentExecutor)
AgentExecutor → Logger, EventBus (optional)
SessionManager → (standalone)
AgentRegistry → (standalone)
```

## Consequences

### Positive
- Clean separation of concerns: registry, sessions, execution, scheduling are independent
- Pluggable executor allows different agent types without modifying core
- Priority scheduling enables urgent tasks
- Session TTL prevents memory leaks
- 53 tests cover all components

### Negative
- Scheduler requires executeFn injection (not self-contained)
- Agent definitions are static (no hot-reload without re-registration)

### Risks
- Low: Components are simple, well-tested, and independent

## Alternatives Considered

### 1. Monolithic Agent Class
Single class handling everything. Rejected: too complex, hard to test.

### 2. Actor Model
Each agent as an actor with message passing. Rejected: over-engineered for current needs.

### 3. Direct Executor Import
Scheduler imports AgentExecutor directly. Rejected: circular dependency risk, hard to test.

## References

- `src/core/agents/` — Implementation
- `src/core/agents/__tests__/AgentRuntime.test.ts` — Tests (53 tests)
