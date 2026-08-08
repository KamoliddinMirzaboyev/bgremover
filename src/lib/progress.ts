import type { ProcessProgress } from '../types'
import { progressLabel } from './canvas'

/** Fixed stage bands — library phases never reset the bar */
const BANDS = {
  prep: [0, 6],
  fetch: [6, 48],
  compute: [48, 90],
  refine: [90, 98],
  done: [100, 100],
} as const

export type ProgressStage = keyof typeof BANDS

export function yieldToMain(): Promise<void> {
  const sch = (
    globalThis as unknown as {
      scheduler?: { yield?: () => Promise<void> }
    }
  ).scheduler
  if (sch?.yield) return sch.yield()
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * Monotonic progress + rAF throttle.
 * peak only rises → bar never jumps backwards.
 */
export class ProgressController {
  private peak = 0
  private label = 'Tayyorlanmoqda...'
  private key = 'start'
  private raf = 0
  private pending: ProcessProgress | null = null
  private live = true
  private nudgeTimer = 0
  private stageHigh = 6
  private readonly emit: (p: ProcessProgress) => void
  private readonly isActive: () => boolean

  constructor(emit: (p: ProcessProgress) => void, isActive: () => boolean) {
    this.emit = emit
    this.isActive = isActive
  }

  setStage(stage: ProgressStage, fraction: number, label?: string) {
    if (!this.live || !this.isActive()) return
    const [lo, hi] = BANDS[stage]
    this.stageHigh = hi
    const f = Math.min(1, Math.max(0, fraction))
    const raw = lo + (hi - lo) * f
    const percent = Math.min(100, Math.max(this.peak, Math.round(raw)))
    this.peak = percent
    if (label) this.label = label
    this.key = stage
    this.queue()
  }

  fromLibrary(key: string, current: number, total: number) {
    if (!this.live || !this.isActive()) return
    const k = key.toLowerCase()
    const frac = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0
    const label = progressLabel(key)

    if (
      k.includes('fetch') ||
      k.includes('download') ||
      k.includes('wasm') ||
      k.includes('onnx') ||
      k.includes('model')
    ) {
      this.setStage('fetch', frac, label)
      return
    }
    if (
      k.includes('compute') ||
      k.includes('inference') ||
      k.includes('decode') ||
      k.includes('mask') ||
      k.includes('encode') ||
      k.includes('session') ||
      k.includes('init')
    ) {
      this.setStage('compute', frac, label)
      return
    }
    this.setStage('compute', Math.min(0.95, frac), label)
  }

  /** Slow crawl while a stage has no callbacks (inference can be silent for seconds) */
  startNudge(stage: ProgressStage, label: string) {
    this.stopNudge()
    if (!this.live) return
    const [, hi] = BANDS[stage]
    this.stageHigh = hi
    this.label = label
    this.key = stage
    this.setStage(stage, 0, label)

    this.nudgeTimer = window.setInterval(() => {
      if (!this.live || !this.isActive()) {
        this.stopNudge()
        return
      }
      // Never reach hi — leave room for real completion
      const cap = this.stageHigh - 1
      if (this.peak >= cap) return
      const room = cap - this.peak
      const step = room > 10 ? 1 : room > 4 ? 0.5 : 0.25
      this.peak = Math.min(cap, this.peak + step)
      this.queue()
    }, 250)
  }

  stopNudge() {
    if (this.nudgeTimer) {
      clearInterval(this.nudgeTimer)
      this.nudgeTimer = 0
    }
  }

  finish() {
    this.stopNudge()
    this.peak = 100
    this.label = 'Tayyor!'
    this.key = 'done'
    this.flushNow()
  }

  dispose() {
    this.live = false
    this.stopNudge()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.pending = null
  }

  private snapshot(): ProcessProgress {
    return {
      key: this.key,
      current: this.peak,
      total: 100,
      percent: Math.min(100, Math.round(this.peak)),
      label: this.label,
    }
  }

  private queue() {
    this.pending = this.snapshot()
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      if (!this.pending || !this.live || !this.isActive()) return
      this.emit(this.pending)
      this.pending = null
    })
  }

  private flushNow() {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
    if (!this.live || !this.isActive()) return
    this.emit(this.snapshot())
    this.pending = null
  }
}
