import { useState, useEffect, useCallback } from 'react'
import type { McpServerConfig, McpToolInfo, McpServerStatus } from '../types/electron'

type Tab = 'servers' | 'tools'

export default function McpPage() {
  const [tab, setTab] = useState<Tab>('servers')
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [statuses, setStatuses] = useState<McpServerStatus[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [testTool, setTestTool] = useState<McpToolInfo | null>(null)
  const [testArgs, setTestArgs] = useState('{}')
  const [testResult, setTestResult] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, t, st] = await Promise.all([
        window.electronAPI.mcpListServers(),
        window.electronAPI.mcpListTools(),
        window.electronAPI.mcpServerStatus(),
      ])
      setServers(s)
      setTools(t)
      setStatuses(st)
    } catch (e) {
      console.error('[MCP] refresh error:', e)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleAdd = async () => {
    if (!newName || !newCommand) return
    setLoading(true)
    try {
      const config: McpServerConfig = {
        id: `mcp-${Date.now()}`,
        name: newName,
        transport: 'stdio',
        command: newCommand,
        args: newArgs ? newArgs.split(/\s+/).filter(Boolean) : [],
        enabled: true,
      }
      await window.electronAPI.mcpAddServer(config)
      setNewName('')
      setNewCommand('')
      setNewArgs('')
      setShowAdd(false)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await window.electronAPI.mcpToggleServer(id, enabled)
    await refresh()
  }

  const handleRemove = async (id: string) => {
    await window.electronAPI.mcpRemoveServer(id)
    await refresh()
  }

  const handleTestTool = async () => {
    if (!testTool) return
    setTestResult('執行中...')
    try {
      const args = JSON.parse(testArgs)
      const res = await window.electronAPI.mcpCallTool(testTool.serverId, testTool.name, args)
      if (res.success) {
        setTestResult(typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, 2))
      } else {
        setTestResult(`錯誤：${res.error}`)
      }
    } catch (e) {
      setTestResult(`JSON 解析錯誤：${String(e)}`)
    }
  }

  const getStatus = (serverId: string) => statuses.find(s => s.id === serverId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#d0bcff', margin: 0 }}>
          MCP Manager
        </h1>
        <p style={{ fontSize: '14px', color: '#958ea0', margin: '4px 0 0 0' }}>
          管理 Model Context Protocol 伺服器連線與工具
        </p>
      </div>

      {/* Tab 切換 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['servers', 'tools'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: tab === t ? 'rgba(208, 188, 255, 0.2)' : 'transparent',
            color: tab === t ? '#d0bcff' : '#958ea0',
            fontWeight: tab === t ? 600 : 400, fontSize: '14px',
          }}>
            {t === 'servers' ? '伺服器' : '工具'}
          </button>
        ))}
      </div>

      {/* Servers Tab */}
      {tab === 'servers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#cbc3d7', fontSize: '14px' }}>已連線 {servers.length} 個伺服器</span>
            <button onClick={() => setShowAdd(!showAdd)} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 600,
            }}>
              {showAdd ? '取消' : '+ 新增伺服器'}
            </button>
          </div>

          {showAdd && (
            <div style={{
              background: 'rgba(18, 33, 49, 0.7)', padding: '16px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="伺服器名稱" style={inputStyle} />
                <input value={newCommand} onChange={e => setNewCommand(e.target.value)}
                  placeholder="執行命令（如 npx）" style={inputStyle} />
                <input value={newArgs} onChange={e => setNewArgs(e.target.value)}
                  placeholder="參數（空格分隔，如 -y @modelcontextprotocol/server-filesystem）" style={inputStyle} />
                <button onClick={handleAdd} disabled={loading || !newName || !newCommand} style={{
                  ...btnStyle, opacity: loading || !newName || !newCommand ? 0.5 : 1,
                }}>
                  {loading ? '連線中...' : '連線'}
                </button>
              </div>
            </div>
          )}

          {servers.length === 0 && !showAdd && (
            <div style={{ color: '#958ea0', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              尚未設定任何 MCP 伺服器
            </div>
          )}

          {servers.map(s => {
            const st = getStatus(s.id)
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(18, 33, 49, 0.7)', padding: '14px 16px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#d0bcff', fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                  <div style={{ color: '#958ea0', fontSize: '12px', marginTop: '2px' }}>
                    {s.command} {(s.args || []).join(' ')}
                  </div>
                  {st && (
                    <div style={{ fontSize: '12px', marginTop: '4px', color: st.connected ? '#4ade80' : '#f87171' }}>
                      {st.connected ? `已連線 · ${st.toolCount} 個工具` : `未連線${st.error ? ` · ${st.error}` : ''}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                    <input type="checkbox" checked={s.enabled}
                      onChange={e => handleToggle(s.id, e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: '11px', cursor: 'pointer',
                      background: s.enabled ? '#6366f1' : '#4a5568',
                      transition: 'background 0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', left: s.enabled ? '20px' : '2px', top: '2px',
                        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s',
                      }} />
                    </span>
                  </label>
                  <button onClick={() => handleRemove(s.id)} style={{
                    padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: 'rgba(248, 113, 113, 0.2)', color: '#f87171', fontSize: '12px',
                  }}>刪除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div>
          <div style={{ color: '#cbc3d7', fontSize: '14px', marginBottom: '12px' }}>
            共 {tools.length} 個可用工具
          </div>

          {tools.length === 0 && (
            <div style={{ color: '#958ea0', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              尚無可用工具，請先連線 MCP 伺服器
            </div>
          )}

          {tools.map(t => (
            <div key={`${t.serverId}:${t.name}`} style={{
              background: 'rgba(18, 33, 49, 0.7)', padding: '14px 16px', borderRadius: '8px',
              border: testTool?.name === t.name && testTool?.serverId === t.serverId
                ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
              marginBottom: '8px', cursor: 'pointer',
            }} onClick={() => { setTestTool(t); setTestResult('') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#d0bcff', fontWeight: 600, fontSize: '14px' }}>{t.name}</span>
                  <span style={{ color: '#958ea0', fontSize: '12px', marginLeft: '8px' }}>{t.serverId}</span>
                </div>
                <span style={{ color: '#958ea0', fontSize: '12px' }}>▸</span>
              </div>
              {t.description && (
                <div style={{ color: '#cbc3d7', fontSize: '13px', marginTop: '4px' }}>{t.description}</div>
              )}
            </div>
          ))}

          {/* Tool 測試面板 */}
          {testTool && (
            <div style={{
              background: 'rgba(18, 33, 49, 0.9)', padding: '16px', borderRadius: '8px',
              border: '1px solid #6366f1', marginTop: '16px',
            }}>
              <div style={{ color: '#d0bcff', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                測試：{testTool.name}
              </div>
              <textarea value={testArgs} onChange={e => setTestArgs(e.target.value)}
                placeholder='JSON 參數，如 {"query": "hello"}'
                style={{ ...inputStyle, minHeight: '80px', fontFamily: 'monospace', resize: 'vertical' }} />
              <button onClick={handleTestTool} style={{ ...btnStyle, marginTop: '8px' }}>執行</button>
              {testResult && (
                <pre style={{
                  marginTop: '10px', padding: '12px', borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)', color: '#cbc3d7', fontSize: '13px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflow: 'auto',
                }}>{testResult}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)', color: '#cbc3d7', fontSize: '14px', outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
  background: '#6366f1', color: '#fff', fontSize: '14px', fontWeight: 600,
}
