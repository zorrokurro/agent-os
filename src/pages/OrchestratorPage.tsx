import { useState, useEffect, useRef } from 'react'
import type { AgentInfo } from '../types'

interface Task {
  id: string
  description: string
  assignedAgent: string
  dependencies: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
  error?: string
}

interface OrchestratorState {
  isRunning: boolean
  tasks: Task[]
  result: string
  reasoning: string
}

export default function OrchestratorPage() {
  const [prompt, setPrompt] = useState('')
  const [agentMap, setAgentMap] = useState<Record<string, string>>({})
  const [state, setState] = useState<OrchestratorState>({
    isRunning: false,
    tasks: [],
    result: '',
    reasoning: '',
  })
  const [history, setHistory] = useState<Array<{ prompt: string; result: string; timestamp: number }>>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const loadAgents = async () => {
      try {
        if (window.electronAPI.getAgents) {
          const list: AgentInfo[] = await window.electronAPI.getAgents()
          const map: Record<string, string> = {}
          for (const a of list) map[a.id] = a.name
          setAgentMap(map)
        }
      } catch {
        setAgentMap({
          opencode: 'OpenCode（程式碼）',
          hermes: 'Hermes（研究/搜尋）',
          filesystem: '檔案系統',
          ump: 'UMP 記憶層',
          'task-analyzer': '任務分析器',
        })
      }
    }
    loadAgents()
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onOrchestratorProgress((data: { message: string; tasks?: Task[] }) => {
      setState(prev => ({
        ...prev,
        reasoning: data.message,
        tasks: data.tasks || prev.tasks,
      }))
    })

    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onOrchestratorTaskStart((data: { taskId: string; message: string }) => {
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === data.taskId ? { ...t, status: 'running' } : t
        ),
      }))
    })

    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onOrchestratorTaskComplete((data: { taskId: string; message: string; result: string }) => {
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === data.taskId ? { ...t, status: 'done', result: data.result } : t
        ),
      }))
    })

    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onOrchestratorTaskFail((data: { taskId: string; message: string }) => {
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === data.taskId ? { ...t, status: 'failed', error: data.message } : t
        ),
      }))
    })

    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onOrchestratorResult((data: { message: string; result: string }) => {
      setState(prev => ({
        ...prev,
        isRunning: false,
        result: data.result,
      }))
      setHistory(prev => [
        { prompt, result: data.result, timestamp: Date.now() },
        ...prev,
      ].slice(0, 10))
    })

    return unsub
  }, [prompt])

  const handleExecute = async () => {
    if (!prompt.trim() || state.isRunning) return

    setState({
      isRunning: true,
      tasks: [],
      result: '',
      reasoning: '',
    })

    try {
      await window.electronAPI.orchestratorExecute(prompt)
    } catch (error) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        result: `執行錯誤：${error instanceof Error ? error.message : String(error)}`,
      }))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleExecute()
    }
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'running': return '🔄'
      case 'done': return '✅'
      case 'failed': return '❌'
    }
  }

  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'pending': return '等待中...'
      case 'running': return '執行中...'
      case 'done': return '完成'
      case 'failed': return '失敗'
    }
  }

  const getAgentName = (agent: string) => {
    return agentMap[agent] || agent
  }

  return (
    <>
    <style>{`@keyframes orch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
      {/* 標題 */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#d0bcff', margin: 0 }}>
          Agent Orchestrator
        </h1>
        <p style={{ fontSize: '14px', color: '#958ea0', margin: '4px 0 0 0' }}>
          輸入任務，讓 Agent 系統自動分配和執行
        </p>
      </div>

      {/* 輸入區域 */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '20px',
        background: 'rgba(18, 33, 49, 0.7)',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入你的任務...（例如：幫我寫一個計算斐波那契數列的函數）"
          disabled={state.isRunning}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '12px',
            color: '#fff',
            fontSize: '14px',
            resize: 'none',
            minHeight: '60px',
            opacity: state.isRunning ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleExecute}
          disabled={!prompt.trim() || state.isRunning}
          style={{
            padding: '12px 24px',
            background: state.isRunning
              ? 'rgba(100, 100, 100, 0.5)'
              : 'linear-gradient(135deg, #a078ff, #0566d9)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: state.isRunning ? 'not-allowed' : 'pointer',
            opacity: (!prompt.trim() || state.isRunning) ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {state.isRunning ? '執行中...' : '執行'}
        </button>
      </div>

      {/* 狀態列 */}
      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: 600,
        background: state.isRunning
          ? 'rgba(160, 120, 255, 0.15)'
          : state.result
            ? 'rgba(100, 200, 100, 0.15)'
            : 'rgba(100, 100, 100, 0.1)',
        border: `1px solid ${
          state.isRunning
            ? 'rgba(160, 120, 255, 0.3)'
            : state.result
              ? 'rgba(100, 200, 100, 0.3)'
              : 'rgba(100, 100, 100, 0.15)'
        }`,
        color: state.isRunning
          ? '#d0bcff'
          : state.result
            ? '#a0d0a0'
            : '#958ea0',
      }}>
        {state.isRunning ? (
          <>
            <span style={{ fontSize: '18px', display: 'inline-block', animation: 'orch-spin 1s linear infinite' }}>⟳</span>
            <span>正在執行中，請稍候...</span>
            {state.tasks.length > 0 && (
              <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '12px', color: '#958ea0' }}>
                {state.tasks.filter(t => t.status === 'done').length}/{state.tasks.length} 任務完成
              </span>
            )}
          </>
        ) : state.result ? (
          <>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span>執行完成</span>
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '12px', color: '#958ea0' }}>
              {state.tasks.filter(t => t.status === 'done').length} 個任務成功
              {state.tasks.some(t => t.status === 'failed') && (
                <>，{state.tasks.filter(t => t.status === 'failed').length} 個失敗</>
              )}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '18px' }}>💬</span>
            <span>等待輸入任務</span>
          </>
        )}
      </div>

      {/* 主要內容區域 */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* 任務進度 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(18, 33, 49, 0.7)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 600,
            color: '#d0bcff',
          }}>
            任務進度
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {state.reasoning && (
              <div style={{
                marginBottom: '12px',
                padding: '12px',
                background: 'rgba(160, 120, 255, 0.1)',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#cbc3d7',
                whiteSpace: 'pre-wrap',
              }}>
                {state.reasoning}
              </div>
            )}

            {state.tasks.length === 0 && !state.isRunning && (
              <div style={{
                textAlign: 'center',
                color: '#958ea0',
                padding: '40px',
              }}>
                尚無任務
              </div>
            )}

            {state.tasks.map(task => (
              <div
                key={task.id}
                style={{
                  marginBottom: '8px',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span>{getStatusIcon(task.status)}</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>
                    {task.description}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#958ea0', marginLeft: '24px' }}>
                  Agent: {getAgentName(task.assignedAgent)}
                </div>
                <div style={{ fontSize: '12px', color: '#958ea0', marginLeft: '24px' }}>
                  狀態: {getStatusText(task.status)}
                </div>
                {task.result && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(100, 200, 100, 0.1)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#a0d0a0',
                    marginLeft: '24px',
                  }}>
                    {task.result.substring(0, 200)}
                    {task.result.length > 200 && '...'}
                  </div>
                )}
                {task.error && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(200, 100, 100, 0.1)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#d0a0a0',
                    marginLeft: '24px',
                  }}>
                    {task.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 結果區域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(18, 33, 49, 0.7)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 600,
            color: '#d0bcff',
          }}>
            結果
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {state.result ? (
              <div style={{
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                color: '#fff',
                lineHeight: 1.6,
              }}>
                {state.result}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                color: '#958ea0',
                padding: '40px',
              }}>
                執行任務後，結果會顯示在這裡
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 歷史記錄 */}
      {history.length > 0 && (
        <div style={{
          marginTop: '20px',
          background: 'rgba(18, 33, 49, 0.7)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 600,
            color: '#d0bcff',
          }}>
            最近歷史
          </div>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {history.map((item, index) => (
              <div
                key={item.timestamp}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setPrompt(item.prompt)
                  setState(prev => ({ ...prev, result: item.result }))
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                  {item.prompt}
                </div>
                <div style={{ fontSize: '11px', color: '#958ea0' }}>
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
