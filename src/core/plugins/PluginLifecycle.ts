/**
 * Plugin Lifecycle
 *
 * State machine for plugin lifecycle management.
 *
 * States:
 *   Installed → Loaded → Activated
 *                   ↓         ↓
 *               Deactivated ←─┘
 *                   ↓
 *               Unloaded
 *
 *   Any state → Error
 */

// ─── Plugin States ───────────────────────────────────────────────────────────

export type PluginState =
  | 'installed'   // Plugin manifest discovered, not yet loaded
  | 'loaded'      // Plugin module loaded, not yet activated
  | 'activated'   // Plugin is active and providing capabilities
  | 'deactivated' // Plugin was deactivated (can be re-activated)
  | 'unloaded'    // Plugin module unloaded from memory
  | 'error'       // Plugin encountered an error

// ─── State Transitions ───────────────────────────────────────────────────────

export const PLUGIN_TRANSITIONS: Record<PluginState, PluginState[]> = {
  installed:   ['loaded', 'error'],
  loaded:      ['activated', 'deactivated', 'unloaded', 'error'],
  activated:   ['deactivated', 'unloaded', 'error'],
  deactivated: ['loaded', 'activated', 'unloaded', 'error'],
  unloaded:    [],
  error:       ['installed', 'unloaded'],
}

/**
 * Check if a plugin state transition is valid.
 */
export function isValidPluginTransition(
  current: PluginState,
  next: PluginState,
): boolean {
  return PLUGIN_TRANSITIONS[current]?.includes(next) ?? false
}

/**
 * Check if a state is terminal.
 */
export function isTerminalPluginState(state: PluginState): boolean {
  return state === 'unloaded'
}

/**
 * Check if a state is active (plugin is providing capabilities).
 */
export function isPluginActive(state: PluginState): boolean {
  return state === 'activated'
}
