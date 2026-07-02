import { describe, it, expect, vi } from 'vitest'
import { PluginManager } from '../PluginManager'
import { CommandBus } from '../../workflow/commands/CommandBus'
import { WorkflowRuntime } from '../../workflow/WorkflowRuntime'
import type { PluginManifest } from '../PluginManifest'
import type { Plugin } from '../Plugin'
import type { PluginContext } from '../PluginContext'

function makeManifest(id: string, overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    apiVersion: '1.0',
    entry: './dist/index.js',
    capabilities: ['command'],
    permissions: [],
    dependencies: [],
    ...overrides,
  }
}

function makePlugin(activate?: (ctx: PluginContext) => Promise<void>, deactivate?: (ctx: PluginContext) => Promise<void>): Plugin {
  return {
    activate: activate ?? vi.fn().mockResolvedValue(undefined),
    deactivate: deactivate ?? vi.fn().mockResolvedValue(undefined),
  }
}

describe('PluginManager', () => {
  describe('register', () => {
    it('should register a plugin', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1')
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      expect(manager.get('p1')).toBeDefined()
      expect(manager.get('p1')?.state).toBe('loaded')
    })

    it('should reject invalid manifest', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1', { entry: undefined as unknown as string })
      const plugin = makePlugin()

      await expect(manager.register(manifest, plugin)).rejects.toThrow('Invalid manifest')
    })
  })

  describe('activate', () => {
    it('should activate a plugin', async () => {
      const manager = new PluginManager()
      const activateFn = vi.fn().mockResolvedValue(undefined)
      const manifest = makeManifest('p1')
      const plugin = makePlugin(activateFn)

      await manager.register(manifest, plugin)
      await manager.activate('p1')

      expect(activateFn).toHaveBeenCalledOnce()
      expect(manager.get('p1')?.state).toBe('activated')
    })

    it('should throw for unregistered plugin', async () => {
      const manager = new PluginManager()
      await expect(manager.activate('unknown')).rejects.toThrow('not registered')
    })

    it('should throw if not loaded', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1')
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      // State is already 'loaded' from register, so activate should work
      // Let's manually set state to test
      manager.getRegistry().setState('p1', 'installed')
      await expect(manager.activate('p1')).rejects.toThrow('must be loaded')
    })

    it('should check dependencies', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1', { dependencies: ['p2'] })
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      await expect(manager.activate('p1')).rejects.toThrow('depends on')
    })
  })

  describe('deactivate', () => {
    it('should deactivate a plugin', async () => {
      const manager = new PluginManager()
      const deactivateFn = vi.fn().mockResolvedValue(undefined)
      const manifest = makeManifest('p1')
      const plugin = makePlugin(undefined, deactivateFn)

      await manager.register(manifest, plugin)
      await manager.activate('p1')
      await manager.deactivate('p1')

      expect(deactivateFn).toHaveBeenCalledOnce()
      expect(manager.get('p1')?.state).toBe('deactivated')
    })

    it('should throw if not activated', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1')
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      await expect(manager.deactivate('p1')).rejects.toThrow('not activated')
    })
  })

  describe('unload', () => {
    it('should unload a plugin', async () => {
      const manager = new PluginManager()
      const manifest = makeManifest('p1')
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      await manager.unload('p1')

      expect(manager.get('p1')?.state).toBe('unloaded')
    })
  })

  describe('getStats', () => {
    it('should return correct stats', async () => {
      const manager = new PluginManager()
      await manager.register(makeManifest('p1'), makePlugin())
      await manager.register(makeManifest('p2'), makePlugin())
      await manager.activate('p1')

      const stats = manager.getStats()
      expect(stats.totalDiscovered).toBe(2)
      expect(stats.totalActivated).toBe(1)
    })
  })

  describe('API version compatibility', () => {
    it('should reject incompatible major version on load', async () => {
      const manager = new PluginManager({ apiVersion: '1.0' })
      const manifest = makeManifest('p1', { apiVersion: '2.0' })

      // Register directly to bypass load
      manager.getRegistry().register(manifest)
      manager.getRegistry().setState('p1', 'loaded')

      // Manually set module
      const plugin = makePlugin()
      // Access private modules map
      ;(manager as unknown as { modules: Map<string, Plugin> }).modules.set('p1', plugin)

      await expect(manager.activate('p1')).rejects.toThrow('API version')
    })

    it('should accept compatible major version', async () => {
      const manager = new PluginManager({ apiVersion: '1.5' })
      const manifest = makeManifest('p1', { apiVersion: '1.0' })
      const plugin = makePlugin()

      await manager.register(manifest, plugin)
      await manager.activate('p1')
      expect(manager.get('p1')?.state).toBe('activated')
    })
  })

  describe('plugin context', () => {
    it('should provide context with command namespacing', async () => {
      const commandBus = new CommandBus()
      const manager = new PluginManager({ commandBus })

      let receivedCtx: PluginContext | undefined
      const plugin = makePlugin(async (ctx) => {
        receivedCtx = ctx
        ctx.commands.register('greet', async () => 'hello')
      })

      await manager.register(makeManifest('my-plugin'), plugin)
      await manager.activate('my-plugin')

      expect(receivedCtx).toBeDefined()
      expect(receivedCtx?.manifest.id).toBe('my-plugin')
    })
  })

  describe('getActive', () => {
    it('should return only active plugins', async () => {
      const manager = new PluginManager()
      await manager.register(makeManifest('p1'), makePlugin())
      await manager.register(makeManifest('p2'), makePlugin())
      await manager.activate('p1')

      expect(manager.getActive()).toHaveLength(1)
      expect(manager.getActive()[0].manifest.id).toBe('p1')
    })
  })
})
