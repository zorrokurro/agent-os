# ADR-0002: IPC Contract

## Status

Accepted

## Context

The original codebase used `window.electronAPI as any` throughout the service layer, losing all type safety. IDE autocompletion didn't work, and refactoring was risky.

## Decision

Define all IPC channels through a central contract (`contracts.ts`) with:
- Typed request/response for every channel
- Event contracts for streaming/progress
- ElectraTransport maps contract args to preload positional args

## Alternatives Considered

1. **Keep `window.electronAPI` with type declarations**
   - Pros: No runtime change
   - Cons: Types can drift from implementation, no validation

2. **Use tRPC or similar RPC framework**
   - Pros: End-to-end type safety
   - Cons: Adds dependency, may not fit Electron IPC model

3. **Manual type assertions at call sites**
   - Pros: Simple
   - Cons: Error-prone, inconsistent

## Consequences

### Positive
- TypeScript catches IPC mismatches at compile time
- IDE provides autocompletion for all channels
- Contract serves as documentation for the IPC API
- MockTransport enables testing without Electron

### Negative
- Must update contract when adding channels
- ElectronTransport needs arg mapping for object→positional conversion
- Contract must stay in sync with preload.ts

## Mapping Strategy

The `ElectronTransport` includes a `CHANNEL_MAP` that converts object-shaped contract args to positional args expected by the preload. This is a temporary bridge until the preload is updated to accept objects directly.

## Validation

- 100+ channels defined in contract ✅
- All existing tests pass with new IPC layer ✅
- No `as any` in migrated features ✅
