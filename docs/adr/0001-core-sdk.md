# ADR-0001: Core SDK

## Status

Accepted

## Context

AgentOS started as an Electron + React application. As it evolved toward becoming an AI Agent platform, we needed a foundation that could be shared across Desktop, Web, and CLI.

## Decision

Create `src/core/` as a framework-agnostic SDK with:
- IPC abstraction (Transport pattern)
- Structured logging (pluggable transports)
- Error hierarchy (AppError → IPCError, ValidationError)

## Alternatives Considered

1. **Keep using `window.electronAPI` directly**
   - Pros: No refactor needed
   - Cons: Tightly coupled to Electron, no type safety, no testability

2. **Use existing IPC library (e.g., electron-better-ipc)**
   - Pros: Battle-tested
   - Cons: Additional dependency, less control, may not fit our patterns

3. **Build Core SDK from scratch**
   - Pros: Full control, fits our exact needs
   - Cons: More work, must maintain ourselves

## Consequences

### Positive
- Core can be extracted to `packages/core/` for monorepo
- Features are testable without Electron (MockTransport)
- Type-safe IPC eliminates `as any` casts
- Logger provides structured debugging for Agent workflows

### Negative
- Initial refactor effort (completed in Sprint 0)
- Must maintain the SDK ourselves
- ElectronTransport adds a mapping layer between contracts and preload

## Validation

- Notebook: Request/Response works ✅
- Library: Streaming + Events works ✅
- All 27 tests pass ✅
- Core SDK has zero React/Electron dependencies ✅
