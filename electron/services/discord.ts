import { Client, GatewayIntentBits, Message, TextChannel, Events } from 'discord.js'
import type { MemoryHub, Task } from './ump/hub'

export interface DiscordConfig {
  token: string
  channelId: string
  enabled: boolean
}

export interface DiscordServiceResult {
  success: boolean
  message: string
}

let client: Client | null = null
let hubRef: MemoryHub | null = null
let configRef: DiscordConfig = { token: '', channelId: '', enabled: false }

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getChannel(): TextChannel | null {
  if (!client || !configRef.channelId) return null
  try {
    const ch = client.channels.cache.get(configRef.channelId)
    if (ch && ch instanceof TextChannel) return ch
    return null
  } catch {
    return null
  }
}

export async function startBot(config: DiscordConfig, hub: MemoryHub): Promise<DiscordServiceResult> {
  try {
    if (client) {
      await stopBot()
    }

    if (!config.token || !config.channelId) {
      return { success: false, message: '缺少 Token 或頻道 ID' }
    }

    hubRef = hub
    configRef = config

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    })

    client.once(Events.ClientReady, (readyClient) => {
      console.log(`[Discord] Bot 已上線: ${readyClient.user.tag}, guilds=${readyClient.guilds.cache.size}`)
      console.log(`[Discord] 監聽頻道: ${configRef.channelId}`)
    })

    client.on(Events.MessageCreate, async (message: Message) => {
      console.log(`[Discord] 收到訊息 — author=${message.author.tag} bot=${message.author.bot} channel=${message.channel.id} content="${message.content}"`)
      if (message.author.bot) {
        console.log('[Discord] 忽略: bot 訊息')
        return
      }
      if (message.channel.id !== configRef.channelId) {
        console.log(`[Discord] 忽略: 頻道不符 (message=${message.channel.id}, config=${configRef.channelId})`)
        return
      }
      console.log(`[Discord] 指令匹配，呼叫 handleMessage`)
      await handleMessage(message)
    })

    client.on(Events.Error, (err) => {
      console.error('[Discord] 錯誤:', err.message)
    })

    await client.login(config.token)
    return { success: true, message: 'Bot 已啟動' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Discord] 啟動失敗:', msg)
    client = null
    return { success: false, message: `啟動失敗：${msg}` }
  }
}

export async function stopBot(): Promise<DiscordServiceResult> {
  try {
    if (client) {
      client.removeAllListeners()
      client.destroy()
      client = null
    }
    return { success: true, message: 'Bot 已停止' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: `停止失敗：${msg}` }
  }
}

export async function sendMessage(text: string): Promise<DiscordServiceResult> {
  const channel = getChannel()
  if (!channel) {
    return { success: false, message: '找不到目標頻道' }
  }
  try {
    await channel.send(text)
    return { success: true, message: '訊息已發送' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: `發送失敗：${msg}` }
  }
}

export async function testConnection(): Promise<DiscordServiceResult> {
  console.log('[Discord] testConnection called')

  if (!configRef.token || !configRef.channelId) {
    const detail = `token=${configRef.token ? '***' : 'EMPTY'}, channelId=${configRef.channelId || 'EMPTY'}`
    console.error(`[Discord] testConnection: 缺少設定 — ${detail}`)
    return { success: false, message: `❌ 缺少設定 — ${detail}` }
  }

  // Bot 未啟動或未就緒，先嘗試連線
  if (!client || !client.isReady()) {
    console.log('[Discord] testConnection: bot 未就緒，嘗試連線...')
    const startResult = await startBot(configRef, hubRef!)
    if (!startResult.success) {
      console.error(`[Discord] testConnection: startBot 失敗 — ${startResult.message}`)
      return { success: false, message: `❌ 連線失敗：${startResult.message}` }
    }
    // 等待 guilds 載入
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log(`[Discord] testConnection: bot 已上線，guilds=${client!.guilds.cache.size}`)
  }

  // 嘗試 fetch channel
  let channel: TextChannel | null = null
  try {
    const fetched = await client!.channels.fetch(configRef.channelId)
    if (fetched && fetched instanceof TextChannel) {
      channel = fetched
    } else {
      const type = fetched ? `type=${fetched.type}` : 'null'
      console.error(`[Discord] testConnection: 頻道不是 TextChannel — ${type}`)
      return { success: false, message: `❌ 頻道 ID ${configRef.channelId} 不是文字頻道（${type}）` }
    }
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error(`[Discord] testConnection: fetch channel 失敗 — ${msg}`)
    return { success: false, message: `❌ 取得頻道失敗：${msg}` }
  }

  // 嘗試發送測試訊息
  try {
    await channel.send('✅ Discord 連線正常')
    console.log('[Discord] testConnection: 測試訊息發送成功')
    return { success: true, message: '✅ Discord 連線正常' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = (e as any)?.code || 'UNKNOWN'
    console.error(`[Discord] testConnection: send 失敗 — code=${code}, msg=${msg}`)
    return { success: false, message: `❌ 發送失敗（code: ${code}）：${msg}` }
  }
}

export function isRunning(): boolean {
  return client !== null && client.isReady()
}

async function handleMessage(message: Message): Promise<void> {
  const content = message.content.trim()
  console.log(`[Discord] handleMessage: content="${content}" hubRef=${!!hubRef}`)

  const channel = getChannel()
  if (!channel) {
    console.error('[Discord] handleMessage: getChannel() 返回 null，無法回覆')
    return
  }
  if (!hubRef) {
    console.error('[Discord] handleMessage: hubRef 為 null')
    return
  }

  if (content === '!status') {
    const pendingTasks = hubRef.getTasks(undefined, 'pending')
    const processingTasks = hubRef.getTasks(undefined, 'processing')
    await channel.send(
      `📊 **任務狀態**\n` +
      `Pending: ${pendingTasks.length}\n` +
      `Processing: ${processingTasks.length}`
    )
    return
  }

  if (content.startsWith('!task ')) {
    const taskContent = content.slice(6).trim()
    if (!taskContent) {
      await channel.send('❌ 請提供任務內容，格式：`!task 任務內容`')
      return
    }
    const task: Task = hubRef.createTask(taskContent, taskContent, 'Hermes', 'Discord')
    await channel.send(`✅ 任務已建立，ID: ${task.id}`)
    return
  }

  if (content.startsWith('!research ')) {
    const query = content.slice(10).trim()
    if (!query) {
      await channel.send('❌ 請提供查詢內容，格式：`!research 查詢內容`')
      return
    }
    const task: Task = hubRef.createTask(`研究：${query}`, query, 'ResearchAgent', 'Discord')
    await channel.send(`✅ 研究任務已建立，ID: ${task.id}`)
    return
  }

  console.log(`[Discord] handleMessage: 未匹配任何指令 — "${content}"`)
}

export function notifyTaskComplete(task: Task): void {
  const channel = getChannel()
  if (!channel) return

  const resultPreview = task.result
    ? task.result.slice(0, 500)
    : '(無結果)'

  channel.send(
    `✅ **任務完成：${task.title}**\n結果：${resultPreview}`
  ).catch(err => {
    console.error('[Discord] 任務完成通知發送失敗:', err.message)
  })
}
