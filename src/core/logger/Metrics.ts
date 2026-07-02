/**
 * Metrics System
 *
 * Lightweight metrics collection for AgentOS.
 * Provides Counter, Histogram, Gauge, and Timer.
 *
 * Usage:
 *   const metrics = new Metrics()
 *
 *   // Counter
 *   metrics.counter('workflow.completed').inc()
 *   metrics.counter('workflow.completed').inc(5)
 *
 *   // Histogram
 *   metrics.histogram('task.duration').observe(150)
 *
 *   // Gauge
 *   metrics.gauge('plugin.active').set(3)
 *
 *   // Timer
 *   const end = metrics.timer('api.request').start()
 *   // ... do work
 *   end()
 *
 *   // Get all metrics
 *   console.log(metrics.all())
 */

// ─── Counter ─────────────────────────────────────────────────────────────────

export class Counter {
  private value = 0

  constructor(private name: string) {}

  inc(amount = 1): void {
    this.value += amount
  }

  dec(amount = 1): void {
    this.value -= amount
  }

  get(): number {
    return this.value
  }

  reset(): void {
    this.value = 0
  }

  snapshot(): MetricSnapshot {
    return { type: 'counter', name: this.name, value: this.value }
  }
}

// ─── Histogram ───────────────────────────────────────────────────────────────

export class Histogram {
  private values: number[] = []
  private maxLength: number

  constructor(private name: string, maxLength = 1000) {
    this.maxLength = maxLength
  }

  observe(value: number): void {
    this.values.push(value)
    if (this.values.length > this.maxLength) {
      this.values.shift()
    }
  }

  get(): { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number } {
    if (this.values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 }
    }

    const sorted = [...this.values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      sum,
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    }
  }

  reset(): void {
    this.values = []
  }

  snapshot(): MetricSnapshot {
    return { type: 'histogram', name: this.name, value: this.get() }
  }
}

// ─── Gauge ───────────────────────────────────────────────────────────────────

export class Gauge {
  private value = 0

  constructor(private name: string) {}

  set(value: number): void {
    this.value = value
  }

  inc(amount = 1): void {
    this.value += amount
  }

  dec(amount = 1): void {
    this.value -= amount
  }

  get(): number {
    return this.value
  }

  reset(): void {
    this.value = 0
  }

  snapshot(): MetricSnapshot {
    return { type: 'gauge', name: this.name, value: this.value }
  }
}

// ─── Timer ───────────────────────────────────────────────────────────────────

export class Timer {
  private histogram: Histogram

  constructor(name: string) {
    this.histogram = new Histogram(name)
  }

  start(): () => number {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.histogram.observe(duration)
      return duration
    }
  }

  observe(duration: number): void {
    this.histogram.observe(duration)
  }

  get() {
    return this.histogram.get()
  }

  reset(): void {
    this.histogram.reset()
  }

  snapshot(): MetricSnapshot {
    return { type: 'timer', name: this.histogram['name'], value: this.get() }
  }
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export type MetricSnapshot =
  | { type: 'counter'; name: string; value: number }
  | { type: 'histogram'; name: string; value: { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number } }
  | { type: 'gauge'; name: string; value: number }
  | { type: 'timer'; name: string; value: { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number } }

export class Metrics {
  private counters = new Map<string, Counter>()
  private histograms = new Map<string, Histogram>()
  private gauges = new Map<string, Gauge>()
  private timers = new Map<string, Timer>()

  /**
   * Get or create a counter.
   */
  counter(name: string): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter(name))
    }
    return this.counters.get(name)!
  }

  /**
   * Get or create a histogram.
   */
  histogram(name: string): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram(name))
    }
    return this.histograms.get(name)!
  }

  /**
   * Get or create a gauge.
   */
  gauge(name: string): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge(name))
    }
    return this.gauges.get(name)!
  }

  /**
   * Get or create a timer.
   */
  timer(name: string): Timer {
    if (!this.timers.has(name)) {
      this.timers.set(name, new Timer(name))
    }
    return this.timers.get(name)!
  }

  /**
   * Get all metrics as snapshots.
   */
  all(): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = []
    for (const c of this.counters.values()) snapshots.push(c.snapshot())
    for (const h of this.histograms.values()) snapshots.push(h.snapshot())
    for (const g of this.gauges.values()) snapshots.push(g.snapshot())
    for (const t of this.timers.values()) snapshots.push(t.snapshot())
    return snapshots
  }

  /**
   * Get metrics by name pattern.
   */
  getByPattern(pattern: string): MetricSnapshot[] {
    const regex = new RegExp(pattern)
    return this.all().filter((s) => regex.test(s.name))
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    for (const c of this.counters.values()) c.reset()
    for (const h of this.histograms.values()) h.reset()
    for (const g of this.gauges.values()) g.reset()
    for (const t of this.timers.values()) t.reset()
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.counters.clear()
    this.histograms.clear()
    this.gauges.clear()
    this.timers.clear()
  }
}

// ─── Global Metrics ──────────────────────────────────────────────────────────

let globalMetrics: Metrics | undefined

export function getGlobalMetrics(): Metrics {
  if (!globalMetrics) {
    globalMetrics = new Metrics()
  }
  return globalMetrics
}

export function setGlobalMetrics(metrics: Metrics): void {
  globalMetrics = metrics
}
