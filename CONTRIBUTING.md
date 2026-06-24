# Contributing Guide

Thanks for your interest in AgentOS. This document explains how to participate in the project.

## Before You Start

AgentOS is a rapidly evolving personal project. Architecture may change significantly. Consider opening an Issue to discuss direction before large changes, to avoid wasted effort.

## Development Setup

```bash
git clone https://github.com/zorrokurro/agent-os.git
cd agent-os
npm install
npm run dev
```

Requires [Ollama](https://ollama.com) installed and running for local inference features.

## Project Structure

```
electron/           Electron main process
├── main.ts          All IPC handlers
├── preload.ts       Secure bridge for renderer
└── services/        Core services (ollama, aiRouter, ump/, mcp/, etc.)

shared/
└── types.ts         Canonical type definitions (shared by frontend + backend)

src/
├── components/      Page components (LibraryPage, NotebookPage, InstallPage, etc.)
├── components/brain/ Fusion-Loop brain UI
├── pages/           Page components (McpPage, OrchestratorPage)
├── agents/fusion/   Fusion + Self-Refinement Loop core logic
├── hooks/           Shared hooks (useModelConfig, etc.)
└── core/            BrainService and other frontend services
```

## MCP Setup (Model Context Protocol)

AgentOS includes a built-in MCP Client. Here's how to connect an external MCP Server.

### Via the GUI

1. Open AgentOS → click **MCP** in the sidebar
2. Click **+ Add Server**
3. Fill in:
   - **Name**: a display name (e.g. "Filesystem Server")
   - **Command**: the executable (e.g. `npx`)
   - **Arguments**: space-separated args (e.g. `-y @modelcontextprotocol/server-filesystem /path/to/allowed/dir`)
4. Click **Connect** — the server should show as connected with a tool count

### Via config (manual)

Add to AgentOS settings store (`settings.json`):

```json
{
  "mcpServers": [
    {
      "id": "mcp-filesystem",
      "name": "Filesystem Server",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\you\\Documents"],
      "enabled": true
    }
  ]
}
```

### Verified MCP Servers

| Server | Package | Status |
|--------|---------|--------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Tested — all tools working |

Other MCP-compatible servers should work via stdio transport. If you test additional servers, please report results in an Issue.

### Testing MCP Integration

The MCP integration is tested via `electron/services/mcp/client.ts` using `@modelcontextprotocol/sdk`. To verify MCP functionality, start AgentOS (`npm run dev`), navigate to the MCP page, connect a test server (e.g. filesystem), and verify tool discovery and invocation work correctly.

## Before Submitting a PR

```bash
npx tsc --noEmit          # Verify type-check passes
npm run build             # Verify build succeeds
```

## Code Style

- TypeScript — avoid `any` where possible
- New IPC channels must be updated in three places: `electron/main.ts` (handler), `electron/preload.ts` (wrapper), `src/types/electron.d.ts` (types)
- UI colors use CSS variables (`var(--color-background-primary)`, etc.), avoid hardcoding hex unless it's a brand color
- Do not introduce new UI libraries — existing Tabler icons are sufficient

## Most Helpful Contributions

- **Agent manifest examples**: If you package an agent matching `docs/agent-manifest-schema.json` and AgentOS imports it correctly, open a PR to add it as a documented example
- **Cross-platform support**: Currently Windows-only. macOS / Linux compatibility contributions are very welcome
- **Bug reports**: Include your Ollama version, AgentOS version, and reproduction steps
- **Documentation**: README, CONTRIBUTING, code comment fixes are all welcome

## Reporting Bugs

Please include in your Issue:
- AgentOS version (found in Settings page)
- OS version
- Whether using local model or cloud API, and which model
- Reproduction steps
- If possible, console errors from `electron/main.ts`

## Code of Conduct

Keep it respectful. Discuss technical issues on their merits.
