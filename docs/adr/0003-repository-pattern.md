# ADR-0003: Repository Pattern

## Status

Accepted

## Context

The original service layer directly accessed `window.electronAPI`, making it impossible to:
- Test without Electron
- Swap data sources (REST API, SQLite, Cloud)
- Maintain clear separation of concerns

## Decision

Introduce a Repository layer between hooks and IPC:
```
Hook → Repository → IPCClient → Transport
```

Repository responsibilities:
- IPC calls
- DTO ↔ Domain mapping (if needed)
- Error wrapping

## Alternatives Considered

1. **Keep services calling IPC directly**
   - Pros: Simpler, less code
   - Cons: Tight coupling, untestable, no abstraction

2. **Use ORM pattern (e.g., Prisma-style)**
   - Pros: Declarative data access
   - Cons: Overkill for IPC, adds dependency

3. **Use Hexagonal Architecture (Ports & Adapters)**
   - Pros: Maximum flexibility
   - Cons: More boilerplate, may be over-engineered at this stage

## Consequences

### Positive
- Hooks never touch IPC directly
- Repositories are testable with MockTransport
- Future: REST API, SQLite, Cloud can implement same Repository interface
- Clear dependency direction: UI → Domain → Infrastructure

### Negative
- Extra layer of abstraction
- Must maintain Repository for each feature
- Service layer still exists for backward compatibility (being phased out)

## Migration Path

For each feature:
1. Create Repository with IPCClient
2. Update Service to use Repository
3. Update Hook to use Repository directly
4. Remove Service (when all callers migrated)

## Validation

- NotebookRepository: 16 tests pass ✅
- LibraryRepository: Streaming + Events work ✅
- ControlsTab: No more direct `window.electronAPI` calls ✅
