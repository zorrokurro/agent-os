# ADR 0006: Plugin System

## Status

Accepted

## Context

AgentOS needs a way to extend functionality without modifying Core. The platform must support third-party plugins with proper isolation, versioning, and capability management.

## Decision

Implement a Plugin System with:

- **Plugin Context** — plugins never import Core directly; they receive a context object
- **Capabilities** — plugins provide capabilities (command, task, workflow, event, service)
- **Lifecycle states** — installed → loaded → activated → deactivated → unloaded
- **API Version compatibility** — major version must match between platform and plugin
- **Dependency checking** — plugins can declare dependencies on other plugins
- **Multiple sources** — Builtin, Filesystem, Remote (future marketplace)
- **Namespacing** — commands and workflows are namespaced by plugin ID

## Consequences

### Positive
- Third-party plugins can extend AgentOS without forking
- Capability-based design allows fine-grained extension points
- API version checking prevents breaking changes
- Plugin isolation prevents one plugin from breaking another
- Marketplace-ready architecture

### Negative
- Context object adds a layer of indirection
- Namespacing adds complexity to command/workflow lookup
- Capability discovery is coarse-grained (registers all declared capabilities)

## Alternatives Considered

1. **Direct import** — rejected: tight coupling, no isolation
2. **Microkernel architecture** — considered but too complex for v1
3. **Hook-based system** — considered but less structured than capabilities

## Related

- `src/core/plugins/PluginManager.ts`
- `src/core/plugins/PluginContext.ts`
- `src/core/plugins/PluginManifest.ts`
- `src/core/plugins/capabilities/Capability.ts`
