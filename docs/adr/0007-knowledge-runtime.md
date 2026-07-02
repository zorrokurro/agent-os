# ADR 0007: Knowledge Runtime

## Status

Accepted

## Context

AgentOS needs a way to store, index, retrieve, and manage knowledge. This goes beyond simple memory — it includes semantic search, knowledge graphs, embeddings, and persistence. The system must be provider-agnostic to support different storage backends and embedding models.

## Decision

Implement a Knowledge Runtime with:

### Memory Types
- **Semantic** — facts and knowledge about the world
- **Episodic** — past experiences and events
- **Procedural** — how-to knowledge and workflows
- **Working** — short-term context for current task
- **Conversation** — chat history and dialogue
- **Knowledge** — structured domain knowledge
- **Graph** — relational knowledge between entities

### Provider Pattern
- **EmbeddingProvider** — OpenAI, Ollama, Voyage, BGE, Jina
- **MemoryStore** — SQLite, DuckDB, Postgres, Vector DB
- **SearchProvider** — SQLite FTS, LanceDB, Qdrant, Milvus

### Event-Driven Integration
- Knowledge Runtime subscribes to events (workflow:completed, task:completed, etc.)
- Agents retrieve knowledge via Command Bus, not direct imports
- No circular dependencies between Workflow and Knowledge

### Architecture
```
Knowledge Runtime
├── MemoryEngine        (orchestrates all memory operations)
├── MemoryStore         (persistence layer)
├── MemoryIndex         (indexing and search)
├── EmbeddingProvider   (vector embeddings)
├── RetrievalEngine     (context-aware retrieval)
├── SearchEngine        (semantic + keyword search)
└── KnowledgeGraph      (entity relationships)
```

## Consequences

### Positive
- Agent memory is decoupled from agent execution
- Provider pattern allows swapping storage backends
- Event-driven integration prevents tight coupling
- Multiple memory types support different use cases
- Knowledge Graph enables relational reasoning

### Negative
- Embedding generation adds latency
- Provider abstraction adds complexity
- Vector search requires additional infrastructure

## Alternatives Considered

1. **Simple key-value store** — rejected: no semantic search capability
2. **Direct database access** — rejected: tight coupling to specific DB
3. **External memory service** — considered but adds network latency and complexity

## Why "Knowledge Runtime" Instead of "Memory Engine"

"Memory" implies simple storage. "Knowledge Runtime" implies:
- Active processing (indexing, embedding, retrieval)
- Multiple knowledge types (not just key-value)
- Integration with agent workflows
- Provider-based architecture

## Related

- `src/core/knowledge/MemoryEngine.ts`
- `src/core/knowledge/MemoryStore.ts`
- `src/core/knowledge/EmbeddingProvider.ts`
- `src/core/knowledge/RetrievalEngine.ts`
