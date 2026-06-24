import si from 'systeminformation'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { GpuInfo, HardwareInfo } from '../../shared/types'

const execAsync = promisify(exec)

export type { GpuInfo, HardwareInfo }

const MODEL_MAP: { minVram: number; model: string; label: string }[] = [
  { minVram: 12, model: 'llama3.1:8b', label: 'Llama 3.1 8B' },
  { minVram: 8, model: 'llama3.1:8b', label: 'Llama 3.1 8B' },
  { minVram: 4, model: 'mistral:7b', label: 'Mistral 7B' },
  { minVram: 2, model: 'qwen2.5:3b', label: 'Qwen 2.5 3B' },
  { minVram: 0, model: 'qwen2.5:1.5b', label: 'Qwen 2.5 1.5B' },
]

function isDedicatedGpu(model: string): boolean {
  return /nvidia|geforce|quadro|rtx|gtx|radeon.*(rx|pro|vega)|amd.*(rx|pro)/i.test(model)
}

function isIntegratedGpu(model: string): boolean {
  return /intel|uhd|iris|arc|radeon.*graphics/i.test(model) && !isDedicatedGpu(model)
}

// WMI 查詢所有 GPU
async function queryWmiGpus(): Promise<{ model: string; vramBytes: number; vendor: string }[]> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, AdapterCompatibility | ConvertTo-Json"`,
      { timeout: 15000 }
    )
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const json = JSON.parse(trimmed)
    const items = Array.isArray(json) ? json : [json]
    return items
      .filter((g: any) => g.Name && g.Name.trim())
      .map((g: any) => ({
        model: (g.Name || '').trim(),
        vramBytes: Number(g.AdapterRAM) || 0,
        vendor: (g.AdapterCompatibility || '').trim(),
      }))
  } catch {
    return []
  }
}

// systeminformation 查詢活躍 GPU
async function querySiGpus(): Promise<{ model: string; vramMB: number }[]> {
  try {
    const graphicsData = await si.graphics()
    return (graphicsData.controllers ?? [])
      .filter(c => c.model && c.model.trim())
      .map(c => ({
        model: c.model.trim(),
        vramMB: c.vram || 0,
      }))
  } catch {
    return []
  }
}

function pickBestGpu(allGpus: GpuInfo[]): GpuInfo | null {
  if (allGpus.length === 0) return null
  return allGpus.reduce<GpuInfo | null>((best, cur) => {
    if (!best) return cur
    if (!best.isDedicated && cur.isDedicated) return cur
    if (isIntegratedGpu(best.model) && !best.isDedicated && cur.vramMB > 0) return cur
    if (cur.vramMB > best.vramMB) return cur
    return best
  }, null)
}

function getRecommendedModel(vramGB: number, ramGB: number, hasDedicated: boolean): string {
  if (hasDedicated && vramGB === 0) {
    return ramGB >= 16 ? 'mistral:7b' : 'qwen2.5:3b'
  }
  return MODEL_MAP.find(m => vramGB >= m.minVram)?.model ?? 'qwen2.5:1.5b'
}

export function computeRecommendedModel(
  allGpus: GpuInfo[],
  ramGB: number,
  selectedIndex: number | null
): { gpu: string; vramGB: number; recommendedModel: string } {
  const effectiveIndex = selectedIndex ?? -1
  const selected = effectiveIndex >= 0 && effectiveIndex < allGpus.length
    ? allGpus[effectiveIndex]
    : pickBestGpu(allGpus)
  const gpu = selected?.model ?? 'Unknown GPU'
  const vramGB = selected ? Math.round(selected.vramMB / 1024) : 0
  const hasDedicated = allGpus.some(g => g.isDedicated)
  const recommendedModel = getRecommendedModel(vramGB, ramGB, hasDedicated)
  return { gpu, vramGB, recommendedModel }
}

export async function detectHardware(): Promise<HardwareInfo> {
  const [cpuData, memData, osData, diskData, siGpus, wmiGpus] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.fsSize(),
    querySiGpus(),
    queryWmiGpus(),
  ])

  const cpu = `${cpuData.manufacturer} ${cpuData.brand}`
  const cpuCores = cpuData.cores
  const ramGB = Math.round(memData.total / (1024 ** 3))
  const windowsVersion = `${osData.distro} ${osData.release}`

  // Disk: 優先找 Windows C: 槽
  const systemDisk = diskData.find(d => d.fs?.includes(':\\') || d.fs?.toLowerCase().startsWith('c:'))
  const diskFreeGB = systemDisk ? Math.round(systemDisk.available / (1024 ** 3)) : 0

  // 合併 GPU 清單（WMI 為主，si 為輔）
  const seen = new Set<string>()
  const merged: GpuInfo[] = []

  // WMI 優先（包含休眠中的 GPU）
  for (const g of wmiGpus) {
    const key = g.model.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      const wmiVramMB = Math.round(g.vramBytes / (1024 * 1024))
      merged.push({
        model: g.model,
        vendor: g.vramBytes > 0 ? g.vendor : '',
        vramMB: wmiVramMB,
        isActive: false,
        isDedicated: isDedicatedGpu(g.model) || isDedicatedGpu(g.vendor),
      })
    }
  }

  // si 補充 VRAM（活跃 GPU 有更準確的 VRAM）
  for (const g of siGpus) {
    const key = g.model.toLowerCase()
    const existing = merged.find(m => m.model.toLowerCase() === key)
    if (existing) {
      if (g.vramMB > 0) {
        existing.vramMB = g.vramMB
        existing.isActive = true
      }
    } else {
      seen.add(key)
      merged.push({
        model: g.model,
        vendor: '',
        vramMB: g.vramMB,
        isActive: true,
        isDedicated: isDedicatedGpu(g.model),
      })
    }
  }

  const best = pickBestGpu(merged)
  const hasDedicated = merged.some(g => g.isDedicated)
  const vramGB = best ? Math.round(best.vramMB / 1024) : 0
  const gpu = best?.model ?? 'Unknown GPU'
  const recommendedModel = getRecommendedModel(vramGB, ramGB, hasDedicated)

  return {
    cpu,
    cpuCores,
    ramGB,
    gpu,
    vramGB,
    diskFreeGB,
    windowsVersion,
    recommendedModel,
    allGpus: merged,
  }
}
