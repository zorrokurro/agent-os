# ADR 0005: Workflow Runtime

## Status

Accepted

## Context

AgentOS needs a way to execute multi-step tasks with dependencies, retries, and parallel execution. The existing Orchestrator was tightly coupled to specific task types and lacked a proper execution model.

## Decision

Implement a Workflow Runtime with:

- **DAG-based task graph** — tasks form a directed acyclic graph with dependency resolution
- **Command Bus** — every action goes through Command → Handler → Event
- **Workflow Context** — shared context (logger, events, state, signal) passed to every task
- **State Machine** — explicit states: pending, queued, running, paused, completed, failed, cancelled, retrying
- **Pluggable Executors** — SequentialExecutor, ParallelExecutor, and future DistributedExecutor
- **Event-driven** — workflow/task events emitted via EventBus

## Consequences

### Positive
- Multi-agent workflows can be expressed as DAGs
- Parallel execution enables faster task completion
- Retry logic with exponential backoff is built-in
- Cancellation via AbortController is idiomatic JavaScript
- Plugin System can register workflows without modifying Core

### Negative
- DAG complexity may be overkill for simple linear workflows
- State machine adds conceptual overhead
- Debugging parallel execution requires good logging

## Alternatives Considered

1. **Simple sequential pipeline** — rejected: cannot support parallel agent execution
2. **Celery-style task queue** — rejected: over-engineered for single-process runtime
3. **Temporal-style workflow** — considered but too complex for v1

## Related

- `src/core/workflow/WorkflowRuntime.ts`
- `src/core/workflow/WorkflowEngine.ts`
- `src/core/workflow/tasks/TaskGraph.ts`
- `src/core/workflow/commands/CommandBus.ts`
