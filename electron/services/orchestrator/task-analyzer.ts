export type AgentType = 'opencode' | 'hermes' | 'filesystem' | 'ump' | 'mcp'

export interface Task {
  id: string
  description: string
  assignedAgent: AgentType
  dependencies: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  error?: string
}

export interface TaskGraph {
  tasks: Task[]
  roots: string[]
}

export interface AnalysisResult {
  graph: TaskGraph
  reasoning: string
}

// 關鍵詞 → agent 對應表（按優先順序排列，先匹配到的優先）
const KEYWORD_RULES: Array<{ keywords: string[]; agent: AgentType }> = [
  // Filesystem：明確的檔案操作指令
  {
    keywords: ['檔案', '資料夾', '讀取檔案', '寫入檔案', '刪除檔案', '移動檔案', '複製檔案',
      'file', 'directory', 'folder', 'read file', 'write file', 'delete file', 'move file', 'copy file',
      '建立檔案', '建立資料夾', 'rename'],
    agent: 'filesystem',
  },
  // OpenCode：明確的程式碼任務（條件較嚴格）
  {
    keywords: ['寫程式', '寫代碼', '寫code', 'debug', '修復bug', '修復程式',
      '程式碼', '代碼', 'code', 'function', 'bug', 'debug', 'refactor',
      'typescript', 'javascript', 'python', 'compile', 'build', '實作',
      '寫一個函式', '寫一個函數', '寫一個class', '改寫', '重構'],
    agent: 'opencode',
  },
  // Hermes：研究、查詢、一般問題
  {
    keywords: ['研究', '查詢', '搜尋', '分析', '摘要', '翻譯', '比較', '報告',
      '問題', '告訴我', '什麼', '為什麼', '怎麼', '如何', '說明', '解釋',
      'research', 'search', 'query', 'find', 'analyze', 'compare', 'summarize',
      'write', '報告', 'report', '學習', '了解', '認識'],
    agent: 'hermes',
  },
  // MCP：外部工具呼叫
  {
    keywords: ['notion', 'github', 'slack', 'linear', 'jira', 'google calendar',
      '使用工具', '呼叫工具', 'use tool', 'call tool', 'mcp'],
    agent: 'mcp',
  },
]

export class TaskAnalyzer {
  analyze(prompt: string): AnalysisResult {
    const normalizedPrompt = prompt.toLowerCase()
    const detectedAgents = new Set<AgentType>()
    const taskDescriptions: string[] = []

    // 按優先順序匹配關鍵詞
    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (normalizedPrompt.includes(keyword.toLowerCase())) {
          detectedAgents.add(rule.agent)
          break // 這個 agent 已匹配，換下一個 rule
        }
      }
    }

    // 無法判斷時，預設分給 Hermes
    if (detectedAgents.size === 0) {
      detectedAgents.add('hermes')
    }

    // 產生任務
    const tasks: Task[] = []
    let taskId = 1

    // 根據偵測到的 agent 分配任務
    for (const agent of detectedAgents) {
      const task: Task = {
        id: `task-${taskId}`,
        description: this.generateTaskDescription(agent, prompt),
        assignedAgent: agent,
        dependencies: this.determineDependencies(agent, tasks),
        status: 'pending',
      }
      tasks.push(task)
      taskId++
    }

    // 產生推理說明
    const reasoning = this.generateReasoning(detectedAgents, tasks)

    // 找出根任務（沒有依賴的任務）
    const roots = tasks
      .filter(t => t.dependencies.length === 0)
      .map(t => t.id)

    return {
      graph: { tasks, roots },
      reasoning,
    }
  }

  private generateTaskDescription(agent: AgentType, prompt: string): string {
    switch (agent) {
      case 'opencode':
        return `執行與程式碼相關的任務：${prompt}`
      case 'hermes':
        return `執行與研究/搜尋相關的任務：${prompt}`
      case 'filesystem':
        return `執行與檔案系統相關的任務：${prompt}`
      case 'ump':
        return `執行與記憶相關的任務：${prompt}`
      default:
        return `執行任務：${prompt}`
    }
  }

  private determineDependencies(agent: AgentType, existingTasks: Task[]): string[] {
    // 簡單的依賴規則：
    // - 如果有 OpenCode 任務，先執行檔案任務
    // - 如果有 UMP 任務，先執行 OpenCode 任務
    const deps: string[] = []

    if (agent === 'opencode') {
      const fsTask = existingTasks.find(t => t.assignedAgent === 'filesystem')
      if (fsTask) deps.push(fsTask.id)
    }

    if (agent === 'ump') {
      const codeTask = existingTasks.find(t => t.assignedAgent === 'opencode')
      if (codeTask) deps.push(codeTask.id)
    }

    return deps
  }

  private generateReasoning(detectedAgents: Set<AgentType>, tasks: Task[]): string {
    const agentNames = Array.from(detectedAgents).map(a => this.getAgentName(a))
    const taskList = tasks.map(t => `- ${t.description} → ${this.getAgentName(t.assignedAgent)}`).join('\n')

    return `偵測到 ${agentNames.join('、')} 可以處理此任務。\n\n分配的任務：\n${taskList}`
  }

  private getAgentName(agent: AgentType): string {
    const names: Record<AgentType, string> = {
      opencode: 'OpenCode（程式碼）',
      hermes: 'Hermes（研究/搜尋）',
      filesystem: '檔案系統',
      ump: 'UMP 記憶層',
      mcp: 'MCP 外部工具',
    }
    return names[agent] || agent
  }
}
