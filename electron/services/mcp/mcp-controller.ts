import { AgentController } from '../orchestrator/controllers/opencode-controller'
import { Task } from '../orchestrator/task-analyzer'
import { McpClientManager } from './client'

export class McpController implements AgentController {
  constructor(private mcpManager: McpClientManager) {}

  async execute(task: Task, context?: string): Promise<string> {
    const allTools = await this.mcpManager.listAllTools()

    if (allTools.length === 0) {
      return 'MCP 沒有可用的工具。請先在設定中連線 MCP Server。'
    }

    const tool = this.findBestTool(task.description, allTools)
    if (!tool) {
      return `找不到適合的 MCP 工具來處理：${task.description}\n\n可用工具：\n${allTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
    }

    try {
      const args = this.extractArgs(task.description, tool.inputSchema)
      const result = await this.mcpManager.callTool(tool.serverId, tool.name, args)
      return `MCP 工具 ${tool.name} 執行結果：\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return `MCP 工具 ${tool.name} 執行失敗：${msg}`
    }
  }

  private findBestTool(
    description: string,
    tools: Array<{ name: string; description: string; serverId: string; inputSchema: Record<string, unknown> }>
  ) {
    const lower = description.toLowerCase()
    for (const tool of tools) {
      const toolName = tool.name.toLowerCase()
      if (lower.includes(toolName) || lower.includes(toolName.replace(/_/g, ' '))) {
        return tool
      }
    }
    return tools[0]
  }

  private extractArgs(description: string, schema: Record<string, unknown>): Record<string, unknown> {
    const args: Record<string, unknown> = {}
    const props = schema.properties as Record<string, { type?: string }> | undefined
    if (!props) return args

    for (const [key, prop] of Object.entries(props)) {
      if (prop.type === 'string') {
        args[key] = description
      } else if (prop.type === 'number') {
        args[key] = 10
      }
    }

    return args
  }
}
