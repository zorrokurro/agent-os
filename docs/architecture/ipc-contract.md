# IPC Contract

## Overview

All IPC communication is defined through type-safe contracts in `src/core/ipc/contracts.ts`. This ensures:
- TypeScript infers request/response types
- IDE autocompletion works
- Runtime errors are caught at compile time

## Contract Definition

```typescript
export interface IPCContract {
  'notebook:list': {
    request: void           // No input needed
    response: Notebook[]    // Returns Notebook array
  }
  'notebook:create': {
    request: { name: string; description?: string; icon?: string; color?: string }
    response: Notebook
  }
  'chat-stream': {
    request: { model: string; messages: Array<{ role: string; content: string }> }
    response: { success: boolean; reply?: string; error?: string }
  }
}
```

## Channel Naming

| Pattern | Example | Maps to |
|---------|---------|---------|
| `domain:action` | `notebook:list` | `notebookList()` |
| `domain:action` | `note:all-tags` | `noteAllTags()` |
| `action` | `get-agents` | `getAgents()` |

## Event Contracts

Events use a separate contract for type-safe subscriptions:

```typescript
export interface IPCEventContract {
  'chat-token': string           // Token received
  'chat-done': string           // Stream complete
  'chat-error': string          // Error occurred
  'orchestrator:progress': { message: string; tasks?: Task[] }
}
```

## Usage

### Request/Response
```typescript
const notebooks = await ipc.invoke('notebook:list')
// TypeScript knows: notebooks is Notebook[]
```

### Streaming
```typescript
const handle = ipc.stream('chat-stream', {
  request: { model: 'llama3', messages },
  onToken: (token) => setReply(prev => prev + token),
  onDone: (reply) => saveConversation(reply),
  onError: (err) => setError(err),
})
```

### Event Subscription
```typescript
const unsub = ipc.on('chat-token', (token) => {
  setMessages(prev => prev + token)
})
// Later:
unsub()
```

## Adding New Channels

1. Add channel constant to `channels.ts`
2. Add contract entry to `contracts.ts`
3. Add arg mapping to `ElectronTransport.ts` (if object args)
4. Add preload method to `preload.ts`
5. Add IPC handler to `main.ts`

## Rules

1. **Every channel must have a contract** - No untyped IPC calls
2. **Request types match preload args** - Object or positional
3. **Response types are precise** - No `unknown` or `any`
4. **Event channels are separate** - Use `IPCEventContract`
