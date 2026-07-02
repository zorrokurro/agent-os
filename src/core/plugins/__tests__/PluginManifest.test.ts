import { describe, it, expect } from 'vitest'
import {
  validateManifest,
  type PluginManifest,
} from '../PluginManifest'

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    apiVersion: '1.0',
    entry: './dist/index.js',
    capabilities: ['command'],
    permissions: [],
    dependencies: [],
    ...overrides,
  }
}

describe('validateManifest', () => {
  it('should validate a valid manifest', () => {
    const result = validateManifest(makeManifest())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('should require id', () => {
    const result = validateManifest(makeManifest({ id: undefined as unknown as string }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('id'))
  })

  it('should require name', () => {
    const result = validateManifest(makeManifest({ name: undefined as unknown as string }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('name'))
  })

  it('should require version', () => {
    const result = validateManifest(makeManifest({ version: undefined as unknown as string }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('version'))
  })

  it('should require apiVersion', () => {
    const result = validateManifest(makeManifest({ apiVersion: undefined as unknown as string }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('apiVersion'))
  })

  it('should require entry', () => {
    const result = validateManifest(makeManifest({ entry: undefined as unknown as string }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('entry'))
  })

  it('should require capabilities', () => {
    const result = validateManifest(makeManifest({ capabilities: undefined as unknown as [] }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('capabilities'))
  })

  it('should reject invalid ID format', () => {
    const result = validateManifest(makeManifest({ id: 'Invalid_ID!' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('ID'))
  })

  it('should accept valid ID formats', () => {
    expect(validateManifest(makeManifest({ id: 'my-plugin' })).valid).toBe(true)
    expect(validateManifest(makeManifest({ id: 'plugin123' })).valid).toBe(true)
    expect(validateManifest(makeManifest({ id: 'a' })).valid).toBe(true)
  })

  it('should warn about missing description', () => {
    const result = validateManifest(makeManifest({ description: undefined }))
    expect(result.warnings).toContainEqual(expect.stringContaining('description'))
  })

  it('should warn about missing author', () => {
    const result = validateManifest(makeManifest({ author: undefined }))
    expect(result.warnings).toContainEqual(expect.stringContaining('author'))
  })

  it('should warn about empty capabilities', () => {
    const result = validateManifest(makeManifest({ capabilities: [] }))
    expect(result.warnings).toContainEqual(expect.stringContaining('capabilities'))
  })

  it('should reject unknown capabilities', () => {
    const result = validateManifest(makeManifest({
      capabilities: ['command', 'unknown' as unknown as 'command'],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('Unknown capability'))
  })

  it('should reject unknown permissions', () => {
    const result = validateManifest(makeManifest({
      permissions: ['filesystem', 'unknown' as unknown as 'filesystem'],
    }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(expect.stringContaining('Unknown permission'))
  })
})
