# Core SDK

## Overview

`src/core/` is the foundation of AgentOS. It provides IPC, Logging, and Error handling with zero dependencies on React, Electron, or any UI framework.

## Dependency Rule

**Core must NEVER import from:**
- `react`, `react-dom`
- `electron`, `ipcRenderer`, `ipcMain`
- `window`, `document`, `DOM`
- Any file outside `src/core/`

**Everything outside Core imports FROM Core, never the reverse.**

```
UI Feature
    │
    ▼
  Core SDK
    │
    ▼
Infrastructure (Electron, SQLite, MCP, Ollama, FS)
```

## Directory Structure

```
src/core/
├── index.ts              # Public API - re-exports everything
├── ipc/
│   ├── channels.ts       # IPC channel constants
│   ├── contracts.ts      # Type-safe request/response contracts
│   ├── IPCClient.ts      # Main IPC client (invoke, on, stream)
│   └── transports/
│       ├── types.ts      # IPCTransport interface
│       ├── ElectronTransport.ts  # Electron implementation
│       └── MockTransport.ts      # Testing mock
├── errors/
│   ├── AppError.ts       # Base error class
│   ├── IPCError.ts       # IPC-specific errors
│   └── ValidationError.ts
└── logger/
    ├── Logger.ts         # Structured logger with Correlation ID
    └── transports/
        ├── types.ts      # LoggerTransport interface
        └── ConsoleTransport.ts
```

## Moving to packages/core

Core is designed to be extracted into a standalone package. When creating a monorepo:

1. Move `src/core/` to `packages/core/`
2. Move `ElectronTransport.ts` to `packages/electron/` (it's the only file that touches `window`)
3. All other Core files remain framework-agnostic

## Rules

1. **No side effects** - Core files must not execute code on import
2. **No singletons at module level** - Use dependency injection or factory functions
3. **All errors extend AppError** - Consistent error hierarchy
4. **All transports are interfaces** - implementations are pluggable
5. **TypeScript strict mode** - No `any`, no implicit `undefined`
