import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'

export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  error?: string
}

interface ConnectionEntry {
  config: McpServerConfig
  client: Client
  transport: StdioClientTransport
  tools: McpToolInfo[]
}

export class McpClientManager {
  private connections = new Map<string, ConnectionEntry>()

  async connectServer(config: McpServerConfig): Promise<void> {
    if (this.connections.has(config.id)) {
      await this.disconnectServer(config.id)
    }

    if (config.transport !== 'stdio' || !config.command) {
      throw new Error(`Unsupported transport: ${config.transport}`)
    }

    const params: StdioServerParameters = {
      command: config.command,
      args: config.args,
      env: config.env,
      stderr: 'pipe',
    }

    const transport = new StdioClientTransport(params)
    const client = new Client(
      { name: 'agentos-mcp-client', version: '0.1.1' },
      { capabilities: {} }
    )

    await client.connect(transport)

    const toolsResult = await client.listTools()
    const tools: McpToolInfo[] = (toolsResult.tools ?? []).map(t => ({
      serverId: config.id,
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
    }))

    this.connections.set(config.id, {
      config,
      client,
      transport,
      tools,
    })
  }

  async disconnectServer(serverId: string): Promise<void> {
    const entry = this.connections.get(serverId)
    if (!entry) return

    try {
      await entry.transport.close()
    } catch { /* ignore close errors */ }

    this.connections.delete(serverId)
  }

  async listTools(serverId: string): Promise<McpToolInfo[]> {
    const entry = this.connections.get(serverId)
    if (!entry) throw new Error(`Server ${serverId} not connected`)
    return entry.tools
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const entry = this.connections.get(serverId)
    if (!entry) throw new Error(`Server ${serverId} not connected`)

    const result = await entry.client.callTool({ name: toolName, arguments: args })

    const content = result.content as Array<{ type: string; text?: string }>
    if (Array.isArray(content)) {
      const textParts = content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
      if (textParts.length === 1) return textParts[0]
      if (textParts.length > 0) return textParts.join('\n')
    }

    return result
  }

  async listAllTools(): Promise<McpToolInfo[]> {
    const all: McpToolInfo[] = []
    for (const entry of this.connections.values()) {
      all.push(...entry.tools)
    }
    return all
  }

  getStatus(): McpServerStatus[] {
    const statuses: McpServerStatus[] = []
    for (const [id, entry] of this.connections) {
      statuses.push({
        id,
        name: entry.config.name,
        connected: true,
        toolCount: entry.tools.length,
      })
    }
    return statuses
  }

  isServerConnected(serverId: string): boolean {
    return this.connections.has(serverId)
  }

  async shutdown(): Promise<void> {
    const ids = [...this.connections.keys()]
    for (const id of ids) {
      await this.disconnectServer(id)
    }
  }
}
