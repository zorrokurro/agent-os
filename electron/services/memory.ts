import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const MEMORY_BASE = join(homedir(), 'AgentOS', 'Memory')

interface MemoryItem {
  path: string
  name: string
  type: 'profile' | 'projects' | 'conversations' | 'outputs'
  content: string
  modified: string
}

interface MemoryStats {
  totalFiles: number
  totalSize: number
  lastUpdated: string
}

const TYPE_MAP: Record<string, MemoryItem['type']> = {
  'user_profile.md': 'profile',
  'brand_voice.md': 'profile',
  'projects': 'projects',
  'conversations': 'conversations',
  'outputs': 'outputs',
}

function ensureMemoryDir(): void {
  const dirs = ['', 'projects', 'conversations', 'outputs']
  for (const dir of dirs) {
    const path = join(MEMORY_BASE, dir)
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true })
    }
  }

  // 建立預設檔案
  const profilePath = join(MEMORY_BASE, 'user_profile.md')
  if (!existsSync(profilePath)) {
    writeFileSync(profilePath, `# 使用者檔案

<!-- 首次安裝後由使用者填寫 -->
- 姓名：
- 職業：
- 偏好語言：繁體中文
- 常用工具：

## 偏好設定
- 回覆風格：直接、不廢話
- 通知方式：Discord
`, 'utf-8')
  }

  const brandPath = join(MEMORY_BASE, 'brand_voice.md')
  if (!existsSync(brandPath)) {
    writeFileSync(brandPath, `# 品牌聲音

<!-- AgentOS 會從對話中自動學習 -->
- 寫作風格：
- 慣用語句：
- 專業領域：
`, 'utf-8')
  }
}

function getType(filePath: string): MemoryItem['type'] {
  const name = filePath.split(/[/\\]/).pop() || ''
  if (TYPE_MAP[name]) return TYPE_MAP[name]
  const dir = filePath.split(/[/\\]/).slice(-2)[0]
  if (TYPE_MAP[dir]) return TYPE_MAP[dir] as MemoryItem['type']
  return 'profile'
}

export function getMemoryItems(): { items: Omit<MemoryItem, 'content'>[]; stats: MemoryStats } {
  ensureMemoryDir()

  const items: Omit<MemoryItem, 'content'>[] = []
  let totalSize = 0
  let lastUpdated = ''

  function scanDir(dir: string) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (entry.endsWith('.md')) {
        const mtime = stat.mtime.toISOString().split('T')[0]

        items.push({
          path: fullPath,
          name: entry.replace('.md', ''),
          type: getType(fullPath),
          modified: mtime,
        })

        totalSize += stat.size
        if (mtime > lastUpdated) lastUpdated = mtime
      }
    }
  }

  scanDir(MEMORY_BASE)

  return {
    items,
    stats: {
      totalFiles: items.length,
      totalSize,
      lastUpdated,
    },
  }
}

export function getMemoryItemContent(filePath: string): { success: boolean; content: string } {
  try {
    if (!existsSync(filePath)) return { success: false, content: '' }
    const content = readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch {
    return { success: false, content: '' }
  }
}

export function saveMemoryItem(path: string, content: string): { success: boolean } {
  try {
    const dir = path.split(/[/\\]/).slice(0, -1).join('/')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(path, content, 'utf-8')
    return { success: true }
  } catch {
    return { success: false }
  }
}
