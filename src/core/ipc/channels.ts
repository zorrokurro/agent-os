/**
 * IPC Channel Constants
 *
 * Single source of truth for all IPC channel names.
 * Both frontend and backend import from here.
 *
 * Convention: "domain:action" for namespaced channels,
 *             "action" for legacy un-namespaced channels.
 */

export const IPC_CHANNELS = {
  // ─── Hardware ──────────────────────────────────────────────────────────────
  GET_HARDWARE_INFO: 'get-hardware-info',

  // ─── Providers ─────────────────────────────────────────────────────────────
  GET_PROVIDERS: 'get-providers',
  GET_PROVIDER_MODELS: 'get-provider-models',
  GET_DEFAULT_MODEL: 'get-default-model',

  // ─── Council ───────────────────────────────────────────────────────────────
  COUNCIL_GET_COUNCILLOR_RESPONSES: 'council-get-councillor-responses',
  COUNCIL_GET_PEER_RANKINGS: 'council-get-peer-rankings',
  COUNCIL_GET_CHAIRMAN_SYNTHESIS: 'council-get-chairman-synthesis',

  // ─── OpenRouter ────────────────────────────────────────────────────────────
  OPENROUTER_CHAT: 'openrouter-chat',

  // ─── Hermes ────────────────────────────────────────────────────────────────
  TEST_HERMES_CONNECTION: 'test-hermes-connection',

  // ─── Ollama ────────────────────────────────────────────────────────────────
  CHECK_OLLAMA: 'check-ollama',
  INSTALL_OLLAMA: 'install-ollama',
  PULL_MODEL: 'pull-model',
  LIST_MODELS: 'list-models',
  GET_MODEL_CONFIG: 'get-model-config',
  SET_MODEL_CONFIG: 'set-model-config',
  CHAT: 'chat',
  CHAT_STREAM: 'chat-stream',
  AI_CHAT: 'ai-chat',
  LIST_API_MODELS: 'list-api-models',

  // ─── Agent Management ──────────────────────────────────────────────────────
  GET_AGENTS: 'get-agents',
  START_AGENT: 'start-agent',
  STOP_AGENT: 'stop-agent',
  GET_AGENT_STATUS: 'get-agent-status',
  IMPORT_AGENT_FROM_GITHUB: 'import-agent-from-github',
  INSTALL_AGENT: 'install-agent',
  UPGRADE_AGENT: 'upgrade-agent',
  GET_FAVORITES: 'get-favorites',
  TOGGLE_FAVORITE: 'toggle-favorite',
  IS_FAVORITE: 'is-favorite',
  HEALTH_CHECK_AGENT: 'health-check-agent',
  GET_AGENT_LOGS: 'get-agent-logs',
  GET_AGENT_DOCS: 'get-agent-docs',

  // ─── Installation ──────────────────────────────────────────────────────────
  RUN_INSTALLATION: 'run-installation',

  // ─── Settings ──────────────────────────────────────────────────────────────
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  GET_FULL_SETTINGS: 'get-full-settings',
  SET_FULL_SETTINGS: 'set-full-settings',

  // ─── Memory ────────────────────────────────────────────────────────────────
  GET_MEMORY_ITEMS: 'get-memory-items',
  GET_MEMORY_ITEM_CONTENT: 'get-memory-item-content',
  SAVE_MEMORY_ITEM: 'save-memory-item',
  SAVE_CONVERSATION: 'save-conversation',

  // ─── Research ──────────────────────────────────────────────────────────────
  RUN_RESEARCH: 'run-research',

  // ─── Auto Update ───────────────────────────────────────────────────────────
  CHECK_FOR_UPDATES: 'check-for-updates',
  DOWNLOAD_UPDATE: 'download-update',
  QUIT_AND_INSTALL: 'quit-and-install',

  // ─── Agent Catalog ─────────────────────────────────────────────────────────
  GET_AGENT_CATALOG: 'get-agent-catalog',

  // ─── UMP Discovery ─────────────────────────────────────────────────────────
  UMP_DISCOVER_SCAN: 'ump-discover-scan',
  UMP_DISCOVER_UNREGISTERED: 'ump-discover-unregistered',
  UMP_DISCOVER_WITH_MEMORY: 'ump-discover-with-memory',
  UMP_DISCOVER_REGISTER_ALL: 'ump-discover-register-all',
  UMP_DISCOVER_CONSOLIDATE: 'ump-discover-consolidate',

  // ─── UMP Bridge ────────────────────────────────────────────────────────────
  UMP_BRIDGE_CONNECT: 'ump-bridge-connect',
  UMP_BRIDGE_IMPORT: 'ump-bridge-import',
  UMP_BRIDGE_EXPORT: 'ump-bridge-export',
  UMP_BRIDGE_SYNC: 'ump-bridge-sync',
  UMP_BRIDGE_STATUS: 'ump-bridge-status',

  // ─── UMP Hub ───────────────────────────────────────────────────────────────
  UMP_HUB_SEARCH: 'ump-hub-search',
  UMP_HUB_STATS: 'ump-hub-stats',
  UMP_HUB_ALL: 'ump-hub-all',

  // ─── UMP Exchange ──────────────────────────────────────────────────────────
  UMP_EXCHANGE_REGISTER: 'ump-exchange-register',
  UMP_EXCHANGE_STATS: 'ump-exchange-stats',
  UMP_ADD_MEMORY: 'ump-add-memory',

  // ─── UMP Conversations ─────────────────────────────────────────────────────
  UMP_CONVERSATIONS: 'ump-conversations',
  UMP_SESSION_MESSAGES: 'ump-session-messages',
  UMP_SESSION_STATS: 'ump-session-stats',

  // ─── Task Queue ────────────────────────────────────────────────────────────
  UMP_CREATE_TASK: 'ump:create-task',
  UMP_GET_TASKS: 'ump:get-tasks',
  UMP_UPDATE_TASK: 'ump:update-task',
  UMP_GET_PENDING_TASKS: 'ump:get-pending-tasks',

  // ─── System Detection ──────────────────────────────────────────────────────
  SYSTEM_DETECT_ALL: 'system-detect-all',
  SYSTEM_DETECT_DIRECTORIES: 'system-detect-directories',
  SYSTEM_ADD_TO_LIBRARY: 'system-add-to-library',

  // ─── Notebook ──────────────────────────────────────────────────────────────
  NOTEBOOK_LIST: 'notebook:list',
  NOTEBOOK_GET: 'notebook:get',
  NOTEBOOK_CREATE: 'notebook:create',
  NOTEBOOK_UPDATE: 'notebook:update',
  NOTEBOOK_DELETE: 'notebook:delete',

  // ─── Note ──────────────────────────────────────────────────────────────────
  NOTE_LIST: 'note:list',
  NOTE_GET: 'note:get',
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_SEARCH: 'note:search',
  NOTE_ALL_TAGS: 'note:all-tags',
  NOTE_BY_TAG: 'note:by-tag',

  // ─── Sources ───────────────────────────────────────────────────────────────
  SOURCE_IMPORT_PDF: 'source:import-pdf',
  SOURCE_IMPORT_URL: 'source:import-url',
  SOURCE_IMPORT_TEXT: 'source:import-text',
  SOURCE_GET: 'source:get',
  SOURCE_DELETE: 'source:delete',

  // ─── Orchestrator ──────────────────────────────────────────────────────────
  ORCHESTRATOR_EXECUTE: 'orchestrator:execute',

  // ─── GitHub Installer ──────────────────────────────────────────────────────
  GITHUB_ANALYZE: 'github:analyze',
  GITHUB_INSTALL: 'github:install',

  // ─── Discord ───────────────────────────────────────────────────────────────
  DISCORD_START: 'discord:start',
  DISCORD_STOP: 'discord:stop',
  DISCORD_SEND: 'discord:send',
  DISCORD_TEST: 'discord:test',
  DISCORD_STATUS: 'discord:status',

  // ─── Obsidian Sync ─────────────────────────────────────────────────────────
  OBSIDIAN_EXPORT: 'obsidian:export',
  OBSIDIAN_IMPORT: 'obsidian:import',
  OBSIDIAN_SYNC: 'obsidian:sync',
  OBSIDIAN_TEST: 'obsidian:test',
  OBSIDIAN_WATCH: 'obsidian:watch',
  OBSIDIAN_WATCH_STOP: 'obsidian:watch-stop',

  // ─── MCP ───────────────────────────────────────────────────────────────────
  MCP_LIST_SERVERS: 'mcp:list-servers',
  MCP_ADD_SERVER: 'mcp:add-server',
  MCP_REMOVE_SERVER: 'mcp:remove-server',
  MCP_TOGGLE_SERVER: 'mcp:toggle-server',
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',
  MCP_SERVER_STATUS: 'mcp:server-status',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ─── Event Channels (main → renderer) ────────────────────────────────────────

export const IPC_EVENTS = {
  INSTALL_PROGRESS: 'install-progress',
  CHAT_TOKEN: 'chat-token',
  CHAT_DONE: 'chat-done',
  CHAT_ERROR: 'chat-error',
  HEALTH_CHECK_RESULT: 'health-check-result',
  THEME_CHANGED: 'theme-changed',
  UPDATE_STATUS: 'update-status',
  ORCHESTRATOR_PROGRESS: 'orchestrator:progress',
  ORCHESTRATOR_TASK_START: 'orchestrator:task-start',
  ORCHESTRATOR_TASK_COMPLETE: 'orchestrator:task-complete',
  ORCHESTRATOR_TASK_FAIL: 'orchestrator:task-fail',
  ORCHESTRATOR_RESULT: 'orchestrator:result',
  GITHUB_INSTALL_LOG: 'github:install-log',
} as const

export type IPCEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS]
