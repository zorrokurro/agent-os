# Feature Module Pattern

## Overview

Every feature in AgentOS follows the same directory structure. This ensures consistency, testability, and easy onboarding for new developers.

## Directory Structure

```
features/<feature>/
├── index.tsx              # Page component (entry point)
├── types.ts               # Feature-specific types
├── components/            # UI components
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
├── hooks/                 # React hooks (state + side effects)
│   ├── useFeature.ts
│   └── useFeatureStream.ts
├── services/              # Legacy service layer (being phased out)
│   └── feature.service.ts
└── repositories/          # Data access layer (new standard)
    └── FeatureRepository.ts
```

## Dependency Direction

```
Component
    │
    ▼
  Hook
    │
    ▼
Repository
    │
    ▼
IPCClient
    │
    ▼
ElectronTransport
```

**Never reverse this direction.** Repositories never import hooks. Hooks never import components.

## Hook Responsibilities

- Manage React state (`useState`, `useQuery`, `useMutation`)
- Call Repository methods
- Handle loading/error states
- Expose actions to components

**Never:**
- Import `window.electronAPI` directly
- Contain business logic
- Call IPC directly

## Repository Responsibilities

- Call `IPCClient` methods
- Map DTO ↔ Domain types (if needed)
- Wrap errors in domain errors

**Never:**
- Import React hooks
- Contain business logic
- Manage state

## Service Layer (Legacy)

The `services/` layer is being phased out. It exists for backward compatibility during migration.

**Migration path:**
1. Create Repository
2. Update Service to use Repository
3. Update Hook to use Repository directly
4. Remove Service

## Type Conventions

```typescript
// features/<feature>/types.ts
import type { Notebook, Note } from '../../types'

export type FeatureTab = 'all' | 'favorites'
export type { Notebook, Note }  // Re-export shared types
```

## Testing

Each feature should have:
- `__tests__/` directory for unit tests
- Repository tests using `MockTransport`
- Hook tests using `renderWithProviders`
