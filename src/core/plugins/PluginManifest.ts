/**
 * Plugin Manifest
 *
 * Describes a plugin's identity, capabilities, permissions, and dependencies.
 * The manifest is the plugin's contract with the platform.
 *
 * Example:
 *   {
 *     id: 'council-plugin',
 *     name: 'Council Plugin',
 *     version: '1.0.0',
 *     apiVersion: '1.0',
 *     description: 'Multi-agent council workflow',
 *     author: 'AgentOS',
 *     capabilities: ['workflow', 'task', 'command'],
 *     permissions: ['memory', 'network'],
 *     dependencies: [],
 *     entry: './dist/index.js',
 *   }
 */

// ─── Capability Types ────────────────────────────────────────────────────────

export type CapabilityType =
  | 'command'    // Register commands on the CommandBus
  | 'task'       // Register task handlers for the Workflow Runtime
  | 'workflow'   // Register workflow definitions
  | 'event'      // Subscribe to events on the EventBus
  | 'service'    // Register services available to other plugins

// ─── Permission Types ────────────────────────────────────────────────────────

export type PermissionType =
  | 'filesystem'  // Read/write files
  | 'network'     // Make HTTP requests
  | 'ipc'         // Use IPC channels
  | 'memory'      // Access Memory Engine
  | 'settings'    // Read/modify settings
  | 'workflow'    // Start/stop workflows

// ─── Plugin Manifest ─────────────────────────────────────────────────────────

export interface PluginManifest {
  /** Unique plugin identifier */
  id: string
  /** Display name */
  name: string
  /** Semver version */
  version: string
  /** API version this plugin targets (e.g., '1.0') */
  apiVersion: string
  /** Plugin description */
  description?: string
  /** Plugin author */
  author?: string
  /** Plugin homepage URL */
  homepage?: string
  /** Plugin icon (emoji or URL) */
  icon?: string

  /** Capabilities this plugin provides */
  capabilities: CapabilityType[]
  /** Permissions this plugin requires */
  permissions: PermissionType[]
  /** Plugin IDs this plugin depends on */
  dependencies: string[]

  /** Entry point path (relative to plugin root) */
  entry: string
  /** Minimum AgentOS version required */
  minVersion?: string
  /** Maximum AgentOS version supported */
  maxVersion?: string

  /** Tags for marketplace categorization */
  tags?: string[]
  /** License identifier (e.g., 'MIT') */
  license?: string
}

// ─── Manifest Validation ─────────────────────────────────────────────────────

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate a plugin manifest.
 */
export function validateManifest(manifest: Partial<PluginManifest>): ManifestValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!manifest.id) errors.push('Missing required field: id')
  if (!manifest.name) errors.push('Missing required field: name')
  if (!manifest.version) errors.push('Missing required field: version')
  if (!manifest.apiVersion) errors.push('Missing required field: apiVersion')
  if (!manifest.entry) errors.push('Missing required field: entry')
  if (!manifest.capabilities) errors.push('Missing required field: capabilities')

  // Validate ID format (lowercase, alphanumeric, hyphens)
  if (manifest.id && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(manifest.id)) {
    errors.push('Plugin ID must be lowercase alphanumeric with hyphens')
  }

  // Validate semver
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    warnings.push('Version should follow semver format (e.g., 1.0.0)')
  }

  // Validate capabilities
  const validCapabilities: CapabilityType[] = ['command', 'task', 'workflow', 'event', 'service']
  if (manifest.capabilities) {
    for (const cap of manifest.capabilities) {
      if (!validCapabilities.includes(cap)) {
        errors.push(`Unknown capability: ${cap}`)
      }
    }
  }

  // Validate permissions
  const validPermissions: PermissionType[] = ['filesystem', 'network', 'ipc', 'memory', 'settings', 'workflow']
  if (manifest.permissions) {
    for (const perm of manifest.permissions) {
      if (!validPermissions.includes(perm)) {
        errors.push(`Unknown permission: ${perm}`)
      }
    }
  }

  // Warnings
  if (!manifest.description) warnings.push('No description provided')
  if (!manifest.author) warnings.push('No author provided')
  if (manifest.capabilities?.length === 0) warnings.push('Plugin declares no capabilities')

  return { valid: errors.length === 0, errors, warnings }
}
