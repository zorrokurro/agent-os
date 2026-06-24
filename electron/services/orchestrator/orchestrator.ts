import { EventEmitter } from 'events'
import { TaskAnalyzer, Task, TaskGraph, AgentType } from './task-analyzer'
import { AgentController } from './controllers/opencode-controller'
import { OpenCodeController } from './controllers/opencode-controller'
import { HermesController } from './controllers/hermes-controller'
import { FilesystemController } from './controllers/filesystem-controller'
import { McpController } from '../mcp/mcp-controller'
import type { McpClientManager } from '../mcp/client'

export interface OrchestratorEvent {
  type: 'task-start' | 'task-complete' | 'task-fail' | 'progress' | 'result'
  taskId?: string
  message: string
  result?: string
}

export class Orchestrator extends EventEmitter {
  private analyzer: TaskAnalyzer
  private controllers: Map<AgentType, AgentController>
  private currentGraph: TaskGraph | null = null
  private isRunning = false

  constructor(mcpManager?: McpClientManager) {
    super()
    this.analyzer = new TaskAnalyzer()
    this.controllers = new Map()
    this.controllers.set('opencode', new OpenCodeController())
    this.controllers.set('hermes', new HermesController())
    this.controllers.set('filesystem', new FilesystemController())
    if (mcpManager) {
      this.controllers.set('mcp', new McpController(mcpManager))
    }
  }

  async execute(prompt: string): Promise<string> {
    if (this.isRunning) {
      throw new Error('Orchestrator 已在執行中')
    }

    console.log(`[Orchestrator] execute: "${prompt}"`)
    this.isRunning = true
    this.emit('progress', { message: '分析任務...' })

    try {
      // 1. 分析任務
      const analysis = this.analyzer.analyze(prompt)
      this.currentGraph = analysis.graph

      console.log(`[Orchestrator] Tasks:`, analysis.graph.tasks.map(t => `${t.id} -> ${t.assignedAgent}: ${t.description}`))

      this.emit('progress', {
        message: `任務分析完成：\n${analysis.reasoning}`,
      })

      // 2. 執行任務
      const results = await this.executeGraph(this.currentGraph)

      // 3. 彙整結果
      const finalResult = this.combineResults(results, this.currentGraph!)

      this.emit('result', { message: '任務完成', result: finalResult })

      return finalResult
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.emit('progress', { message: `執行錯誤：${errorMsg}` })
      throw error
    } finally {
      this.isRunning = false
      this.currentGraph = null
      // Shut down all controllers to kill background processes
      for (const [, controller] of this.controllers) {
        if ('shutdown' in controller) {
          await (controller as any).shutdown()
        }
      }
    }
  }

  private async executeGraph(graph: TaskGraph): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    const completed = new Set<string>()
    const failed = new Set<string>()

    while (completed.size < graph.tasks.length) {
      // 找出可以執行的任務（依賴已完成）
      const readyTasks = graph.tasks.filter(task => {
        if (completed.has(task.id) || failed.has(task.id)) return false
        return task.dependencies.every(dep => completed.has(dep))
      })

      if (readyTasks.length === 0) {
        // 檢查是否有失敗的任務導致無法繼續
        const pendingTasks = graph.tasks.filter(
          t => !completed.has(t.id) && !failed.has(t.id)
        )
        if (pendingTasks.length > 0) {
          throw new Error(`任務執行被阻塞：${pendingTasks.map(t => t.id).join(', ')}`)
        }
        break
      }

      // 並行執行可以並行的任務
      const promises = readyTasks.map(async task => {
        try {
          console.log(`[Orchestrator] Running task ${task.id}: ${task.assignedAgent} - ${task.description}`)
          task.status = 'running'
          this.emit('task-start', {
            taskId: task.id,
            message: `開始執行：${task.description}`,
          })

          // 取得前一個任務的結果作為上下文
          const context = task.dependencies
            .map(dep => results.get(dep))
            .filter(Boolean)
            .join('\n')

          // 執行任務
          const controller = this.controllers.get(task.assignedAgent)
          if (!controller) {
            throw new Error(`找不到 ${task.assignedAgent} 的控制器`)
          }

          const result = await controller.execute(task, context)

          task.status = 'done'
          task.result = result
          results.set(task.id, result)
          completed.add(task.id)

          console.log(`[Orchestrator] Task ${task.id} done: ${result.substring(0, 100)}...`)
          this.emit('task-complete', {
            taskId: task.id,
            message: `完成：${task.description}`,
            result,
          })
        } catch (error) {
          task.status = 'failed'
          task.error = error instanceof Error ? error.message : String(error)
          failed.add(task.id)

          console.log(`[Orchestrator] Task ${task.id} failed: ${task.error}`)
          this.emit('task-fail', {
            taskId: task.id,
            message: `失敗：${task.description} - ${task.error}`,
          })
        }
      })

      await Promise.all(promises)
    }

    return results
  }

  private combineResults(results: Map<string, string>, graph: TaskGraph): string {
    const allResults = Array.from(results.values())
    const failedTasks = graph.tasks.filter(t => t.status === 'failed')

    if (allResults.length === 0 && failedTasks.length === 0) {
      return '沒有產生任何結果。'
    }

    let output = ''

    if (allResults.length > 0) {
      output += `## 任務執行結果\n\n` +
        allResults.map((r, i) => `### 步驟 ${i + 1}\n${r}`).join('\n\n')
    }

    if (failedTasks.length > 0) {
      output += (output ? '\n\n' : '') +
        `## 失敗的任務\n\n` +
        failedTasks.map(t => `- **${t.description}** (${t.assignedAgent}): ${t.error}`).join('\n')
    }

    return output || '沒有產生任何結果。'
  }

  getControllers(): Map<AgentType, AgentController> {
    return this.controllers
  }

  getCurrentGraph(): TaskGraph | null {
    return this.currentGraph
  }

  isActive(): boolean {
    return this.isRunning
  }
}
