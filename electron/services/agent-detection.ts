/**
 * agent-detection.ts — Shared three-layer agent detection utilities.
 *
 * Used by both AgentManager and SystemDetector to avoid duplicating
 * health-check, process-name, port/PID, and config-activity logic.
 */

import { execSync } from 'child_process'
import { statSync } from 'fs'
import os from 'os'
import path from 'path'

// ─── Constants ───────────────────────────────────────────────────────────────

export const AGENT_PROCESS_NAMES: Record<string, string[]> = {
  hermes: ['hermes-agent.exe', 'hermes.exe', 'hermes'],
  openhuman: ['OpenHuman.exe', 'openhuman.exe'],
  opencode: ['OpenCode.exe', 'opencode.exe'],
}

// ─── Layer 1: HTTP health check ─────────────────────────────────────────────

export async function checkHealthEndpoint(
  healthCheck: { type: string; url?: string; timeout?: number }
): Promise<boolean> {
  if (healthCheck.type === 'none' || !healthCheck.url) return false
  if (healthCheck.type === 'http') {
    try {
      const res = await fetch(healthCheck.url, {
        signal: AbortSignal.timeout(healthCheck.timeout ?? 2000)
      })
      return res.ok
    } catch { return false }
  }
  return false
}

// ─── Layer 2A: Process name matching ─────────────────────────────────────────

export function detectByProcessName(agentId: string): boolean {
  const targets = AGENT_PROCESS_NAMES[agentId]
  if (!targets || targets.length === 0) return false

  try {
    const result = execSync(
      'tasklist /FO CSV /NH',
      { encoding: 'utf-8', timeout: 3000, windowsHide: true }
    )
    const running = result.split('\n').map(line =>
      line.split(',')[0].replace(/"/g, '').trim().toLowerCase()
    )
    return targets.some(t => running.includes(t.toLowerCase()))
  } catch {
    return false
  }
}

// ─── Layer 2B: Port + PID check ─────────────────────────────────────────────

export function checkPortAndProcess(
  ports: number[],
  processNames: string[]
): { running: boolean; pid?: number } {
  for (const port of ports) {
    try {
      const result = execSync(
        `netstat -ano | findstr ":${port} "`,
        { encoding: 'utf-8', timeout: 3000, windowsHide: true }
      )
      const lines = result.trim().split('\n').filter(Boolean)
      for (const line of lines) {
        if (!line.includes('LISTENING')) continue
        const parts = line.trim().split(/\s+/)
        const pid = parseInt(parts[parts.length - 1] || '0')
        if (!pid) continue

        try {
          const nameResult = execSync(
            `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
            { encoding: 'utf-8', timeout: 3000, windowsHide: true }
          )
          const procName = nameResult.split(',')[0].replace(/"/g, '').toLowerCase()

          if (processNames.length > 0) {
            if (processNames.some(n => procName.includes(n.toLowerCase()))) {
              return { running: true, pid }
            }
          } else {
            return { running: true, pid }
          }
        } catch { /* tasklist failed, skip */ }
      }
    } catch { /* netstat failed, skip */ }
  }
  return { running: false }
}

// ─── Layer 3: Config directory activity ──────────────────────────────────────

export function checkConfigActivity(
  configPath: string
): 'active' | 'inactive' | 'unknown' {
  try {
    const fullPath = configPath.startsWith('~')
      ? path.join(os.homedir(), configPath.slice(1))
      : configPath
    const stat = statSync(fullPath)
    const minutesAgo = (Date.now() - stat.mtimeMs) / 1000 / 60
    return minutesAgo < 5 ? 'active' : 'inactive'
  } catch {
    return 'unknown'
  }
}

// ─── Composed detection ──────────────────────────────────────────────────────

export async function detectAgentRunning(
  agentId: string,
  healthCheck: { type: string; url?: string; timeout?: number },
  ports: number[],
  processNames: string[],
  configPath?: string
): Promise<boolean> {
  if (await checkHealthEndpoint(healthCheck)) return true
  if (detectByProcessName(agentId)) return true
  if (checkPortAndProcess(ports, processNames).running) return true
  if (configPath && checkConfigActivity(configPath) === 'active') return true
  return false
}
