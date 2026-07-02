# ADR 0004: Event Bus

## Status

Accepted

## Context

AgentOS needs a decoupled communication mechanism between modules. The existing Orchestrator used Node.js EventEmitter, which is framework-specific and lacks type safety.

## Decision

Implement a framework-agnostic EventBus with:

- **publish/subscribe** pattern for event-driven communication
- **Type-safe events** via TypeScript discriminated unions
- **Wildcard subscriptions** via `onAny()` for logging and monitoring
- **Error isolation** — one bad handler cannot break the bus
- **Zero dependencies** — no external libraries required

## Consequences

### Positive
- Modules communicate without importing each other
- Memory, Workflow, Plugin, and Agent can evolve independently
- Easy to add logging, monitoring, and debugging
- Testable with simple mock patterns

### Negative
- Event ordering is not guaranteed across handlers
- Debugging async event chains requires correlation IDs
- Over-use of events can make data flow hard to trace

## Alternatives Considered

1. **Node.js EventEmitter** — rejected: framework-specific, not type-safe
2. **RxJS Observables** — rejected: external dependency, over-engineered for v1
3. **Custom signal/slot** — considered but publish/subscribe is more familiar

## Related

- `src/core/events/EventBus.ts`
- `src/core/events/events.ts` (30+ typed events)
