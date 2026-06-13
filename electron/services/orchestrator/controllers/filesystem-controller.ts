import { Task } from '../task-analyzer'

export interface AgentController {
  execute(task: Task, context?: string): Promise<string>
}

export class FilesystemController implements AgentController {
  async execute(task: Task, context?: string): Promise<string> {
    console.log(`[Filesystem] 執行任務：${task.description}`)
    if (context) console.log(`[Filesystem] 收到上下文：${context.substring(0, 100)}...`)

    // 模擬執行時間
    await new Promise(resolve => setTimeout(resolve, 500))

    return `[Filesystem 完成] 任務「${task.description}」已執行完成。` +
      `已完成相關檔案操作。` +
      (context ? `\n基於前一個任務的結果進行檔案處理。` : '')
  }
}
