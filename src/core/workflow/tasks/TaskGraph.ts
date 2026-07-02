/**
 * Task Graph (DAG)
 *
 * Directed Acyclic Graph for workflow tasks.
 * Manages:
 *   - Dependency resolution
 *   - Topological ordering
 *   - Parallel group detection
 *   - Cycle detection
 *
 * Example:
 *          A
 *        /   \
 *       B     C
 *        \   /
 *          D
 *
 *   graph.addNode(A)
 *   graph.addNode(B, [A])
 *   graph.addNode(C, [A])
 *   graph.addNode(D, [B, C])
 *
 *   graph.getExecutionOrder()  // [[A], [B, C], [D]]
 */

import type { TaskDefinition, TaskInstance } from './Task'
import { createTaskInstance } from './Task'

export class TaskGraph {
  private nodes = new Map<string, TaskInstance>()
  private adjacency = new Map<string, Set<string>>() // node → dependents
  private reverseAdj = new Map<string, Set<string>>() // node → dependencies

  /**
   * Add a task to the graph.
   */
  addNode(definition: TaskDefinition): void {
    if (this.nodes.has(definition.id)) {
      throw new Error(`Task "${definition.id}" already exists in graph`)
    }

    const instance = createTaskInstance(definition)
    this.nodes.set(definition.id, instance)
    this.adjacency.set(definition.id, new Set())
    this.reverseAdj.set(definition.id, new Set(definition.dependencies))

    // Build forward edges
    for (const depId of definition.dependencies) {
      if (!this.adjacency.has(depId)) {
        this.adjacency.set(depId, new Set())
      }
      this.adjacency.get(depId)!.add(definition.id)
    }
  }

  /**
   * Add multiple tasks at once.
   */
  addNodes(definitions: TaskDefinition[]): void {
    for (const def of definitions) {
      this.addNode(def)
    }
  }

  /**
   * Get a task instance by ID.
   */
  getNode(id: string): TaskInstance | undefined {
    return this.nodes.get(id)
  }

  /**
   * Get all task instances.
   */
  getAllNodes(): TaskInstance[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get direct dependents of a task (tasks that depend on it).
   */
  getDependents(taskId: string): string[] {
    return Array.from(this.adjacency.get(taskId) ?? [])
  }

  /**
   * Get direct dependencies of a task.
   */
  getDependencies(taskId: string): string[] {
    return Array.from(this.reverseAdj.get(taskId) ?? [])
  }

  /**
   * Get all transitive dependents (descendants).
   */
  getDescendants(taskId: string): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const queue = [taskId]

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const dep of this.adjacency.get(current) ?? []) {
        if (!visited.has(dep)) {
          visited.add(dep)
          result.push(dep)
          queue.push(dep)
        }
      }
    }

    return result
  }

  /**
   * Get all transitive dependencies (ancestors).
   */
  getAncestors(taskId: string): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const queue = [taskId]

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const dep of this.reverseAdj.get(current) ?? []) {
        if (!visited.has(dep)) {
          visited.add(dep)
          result.push(dep)
          queue.push(dep)
        }
      }
    }

    return result
  }

  /**
   * Detect cycles in the graph using DFS.
   */
  hasCycle(): boolean {
    const WHITE = 0 // unvisited
    const GRAY = 1  // in progress
    const BLACK = 2 // done

    const color = new Map<string, number>()
    for (const id of this.nodes.keys()) {
      color.set(id, WHITE)
    }

    const dfs = (node: string): boolean => {
      color.set(node, GRAY)

      for (const dep of this.adjacency.get(node) ?? []) {
        if (color.get(dep) === GRAY) return true // back edge = cycle
        if (color.get(dep) === WHITE && dfs(dep)) return true
      }

      color.set(node, BLACK)
      return false
    }

    for (const [id, c] of color) {
      if (c === WHITE && dfs(id)) return true
    }

    return false
  }

  /**
   * Get topological execution order.
   * Returns groups of tasks that can run in parallel.
   *
   * Example: [[A], [B, C], [D]]
   */
  getExecutionOrder(): string[][] {
    if (this.hasCycle()) {
      throw new Error('Cannot compute execution order: graph contains a cycle')
    }

    // inDegree[node] = number of dependencies (must complete before this node)
    const inDegree = new Map<string, number>()
    for (const [id] of this.nodes) {
      inDegree.set(id, this.reverseAdj.get(id)?.size ?? 0)
    }

    const result: string[][] = []
    let frontier: string[] = []

    // Find all nodes with no dependencies
    for (const [id, degree] of inDegree) {
      if (degree === 0) frontier.push(id)
    }

    while (frontier.length > 0) {
      result.push([...frontier])

      const nextFrontier: string[] = []
      for (const node of frontier) {
        for (const dependent of this.adjacency.get(node) ?? []) {
          const newDegree = (inDegree.get(dependent) ?? 1) - 1
          inDegree.set(dependent, newDegree)
          if (newDegree === 0) nextFrontier.push(dependent)
        }
      }
      frontier = nextFrontier
    }

    return result
  }

  /**
   * Get root tasks (no dependencies).
   */
  getRoots(): string[] {
    const roots: string[] = []
    for (const [id, deps] of this.reverseAdj) {
      if (deps.size === 0) roots.push(id)
    }
    return roots
  }

  /**
   * Get leaf tasks (no dependents).
   */
  getLeaves(): string[] {
    const leaves: string[] = []
    for (const [id, deps] of this.adjacency) {
      if (deps.size === 0) leaves.push(id)
    }
    return leaves
  }

  /**
   * Get the size of the graph.
   */
  get size(): number {
    return this.nodes.size
  }

  /**
   * Check if a task exists.
   */
  has(id: string): boolean {
    return this.nodes.has(id)
  }

  /**
   * Remove a task and all its edges.
   */
  removeNode(id: string): void {
    this.nodes.delete(id)

    // Remove from adjacency
    this.adjacency.delete(id)

    // Remove from reverse adjacency
    this.reverseAdj.delete(id)

    // Remove edges pointing to this node
    for (const [, deps] of this.reverseAdj) {
      deps.delete(id)
    }
    for (const [, dependents] of this.adjacency) {
      dependents.delete(id)
    }
  }
}
