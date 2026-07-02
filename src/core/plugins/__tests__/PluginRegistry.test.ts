import { describe, it, expect } from 'vitest'
import { PluginRegistry } from '../PluginRegistry'
import type { PluginManifest } from '../PluginManifest'
import type { AnyCapability } from '../capabilities/Capability'

function makeManifest(id: string): PluginManifest {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    apiVersion: '1.0',
    entry: './dist/index.js',
    capabilities: ['command'],
    permissions: [],
    dependencies: [],
  }
}

describe('PluginRegistry', () => {
  describe('register', () => {
    it('should register a plugin', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      expect(registry.size).toBe(1)
      expect(registry.has('p1')).toBe(true)
    })

    it('should throw on duplicate', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      expect(() => registry.register(makeManifest('p1'))).toThrow('already registered')
    })

    it('should set initial state to installed', () => {
      const registry = new PluginRegistry()
      const entry = registry.register(makeManifest('p1'))
      expect(entry.state).toBe('installed')
    })
  })

  describe('unregister', () => {
    it('should unregister a plugin', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      expect(registry.unregister('p1')).toBe(true)
      expect(registry.has('p1')).toBe(false)
    })

    it('should return false for unknown plugin', () => {
      const registry = new PluginRegistry()
      expect(registry.unregister('unknown')).toBe(false)
    })
  })

  describe('setState', () => {
    it('should update state', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      registry.setState('p1', 'loaded')
      expect(registry.get('p1')?.state).toBe('loaded')
    })

    it('should throw for unknown plugin', () => {
      const registry = new PluginRegistry()
      expect(() => registry.setState('unknown', 'loaded')).toThrow('not found')
    })

    it('should record timestamps', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      registry.setState('p1', 'loaded')
      expect(registry.get('p1')?.loadedAt).toBeTypeOf('number')

      registry.setState('p1', 'activated')
      expect(registry.get('p1')?.activatedAt).toBeTypeOf('number')
    })
  })

  describe('getActive', () => {
    it('should return only activated plugins', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      registry.register(makeManifest('p2'))
      registry.setState('p1', 'activated')
      registry.setState('p2', 'loaded')

      expect(registry.getActive()).toHaveLength(1)
      expect(registry.getActive()[0].manifest.id).toBe('p1')
    })
  })

  describe('addCapabilities', () => {
    it('should add capabilities', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      registry.addCapabilities('p1', [{
        pluginId: 'p1',
        type: 'command',
        name: 'Test',
        commandType: 'test',
      }])

      expect(registry.get('p1')?.capabilities).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('should clear all plugins', () => {
      const registry = new PluginRegistry()
      registry.register(makeManifest('p1'))
      registry.register(makeManifest('p2'))
      registry.clear()
      expect(registry.size).toBe(0)
    })
  })
})
