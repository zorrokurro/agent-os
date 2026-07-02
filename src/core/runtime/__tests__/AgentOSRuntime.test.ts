import { describe, it, expect, beforeEach } from 'vitest'
import { AgentOSRuntime } from '../AgentOSRuntime'
import type { AgentInstance } from '../../agents/AgentTypes'

function createTestAgentDef(): Omit<AgentInstance, 'createdAt' | 'state' | 'activeSessions' | 'totalExecutions' | 'errorCount'> {
  return {
    definition: {
      id: `agent-${Math.random().toString(16).slice(2, 8)}`,
      name: 'Test Agent',
      type: 'llm',
      capabilities: ['chat'],
    },
  }
}

describe('AgentOSRuntime', () => {
  it('should start and stop with all runtimes', async () => {
    const os = new AgentOSRuntime()
    expect(os.getState()).toBe('stopped')

    await os.start()
    expect(os.getState()).toBe('running')

    await os.stop()
    expect(os.getState()).toBe('stopped')
  })

  it('should start with only agents enabled', async () => {
    const os = new AgentOSRuntime({
      enableWorkflow: false,
      enablePlugins: false,
      enableKnowledge: false,
      enableAgents: true,
    })

    await os.start()
    expect(os.getState()).toBe('running')
    expect(os.getAgentRuntime()).toBeDefined()
    expect(os.getWorkflowRuntime()).toBeUndefined()
    expect(os.getPluginManager()).toBeUndefined()
    expect(os.getKnowledgeEngine()).toBeUndefined()

    await os.stop()
  })

  it('should start with only workflow enabled', async () => {
    const os = new AgentOSRuntime({
      enableWorkflow: true,
      enablePlugins: false,
      enableKnowledge: false,
      enableAgents: false,
    })

    await os.start()
    expect(os.getWorkflowRuntime()).toBeDefined()
    expect(os.getAgentRuntime()).toBeUndefined()

    await os.stop()
  })

  it('should throw on double start', async () => {
    const os = new AgentOSRuntime()
    await os.start()

    await expect(os.start()).rejects.toThrow('Cannot start')
    await os.stop()
  })

  it('should throw on stop when not running', async () => {
    const os = new AgentOSRuntime()
    await expect(os.stop()).rejects.toThrow('Cannot stop')
  })

  it('should report health', async () => {
    const os = new AgentOSRuntime()
    await os.start()

    const health = await os.health()
    expect(health.length).toBeGreaterThan(0)
    expect(health.some((h) => h.name === 'AgentRuntime')).toBe(true)

    await os.stop()
  })

  it('should report stats', async () => {
    const os = new AgentOSRuntime()
    await os.start()

    const stats = await os.getStats()
    expect(stats.state).toBe('running')
    expect(stats.runtimes.agents).toBeDefined()

    await os.stop()
  })

  it('should register and execute agents through runtime', async () => {
    const os = new AgentOSRuntime({ enableWorkflow: false, enablePlugins: false, enableKnowledge: false })
    await os.start()

    const agentRuntime = os.getAgentRuntime()!
    const agentDef = createTestAgentDef()
    agentRuntime.registerAgent(agentDef)

    const agent = agentRuntime.getAgent(agentDef.definition.id)
    expect(agent).toBeDefined()
    expect(agent?.definition.name).toBe('Test Agent')

    const result = await agentRuntime.execute(agentDef.definition.id, 'Hello')
    expect(result.execution.output).toBeDefined()

    await os.stop()
  })

  it('should emit started and stopped events', async () => {
    const os = new AgentOSRuntime()
    const events: string[] = []
    os.on('started', () => events.push('started'))
    os.on('stopped', () => events.push('stopped'))

    await os.start()
    await os.stop()

    expect(events).toContain('started')
    expect(events).toContain('stopped')
  })

  it('should emit stateChange events', async () => {
    const os = new AgentOSRuntime()
    const states: string[] = []
    os.on('stateChange', (s) => states.push(s))

    await os.start()
    await os.stop()

    expect(states).toContain('starting')
    expect(states).toContain('running')
    expect(states).toContain('stopping')
    expect(states).toContain('stopped')
  })

  it('should handle disabled runtimes in health check', async () => {
    const os = new AgentOSRuntime({
      enableWorkflow: false,
      enablePlugins: false,
      enableKnowledge: false,
      enableAgents: true,
    })
    await os.start()

    const health = await os.health()
    expect(health).toHaveLength(1)
    expect(health[0].name).toBe('AgentRuntime')

    await os.stop()
  })
})
