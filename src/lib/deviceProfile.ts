/**
 * Device-aware scaling for inference size.
 * Weak phones → smaller AI input; desktop+GPU → can go larger.
 */

export interface DeviceProfile {
  /** Multiplier applied to maxInferenceEdge (0.55–1.15) */
  inferenceScale: number
  /** Multiplier for export cap */
  exportScale: number
  hasWebGpu: boolean
  isLowEnd: boolean
  label: string
}

export function getDeviceProfile(): DeviceProfile {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const mem =
    nav && 'deviceMemory' in nav
      ? Number((nav as Navigator & { deviceMemory?: number }).deviceMemory)
      : undefined
  const cores = nav?.hardwareConcurrency ?? 4
  const hasWebGpu = Boolean(nav && 'gpu' in nav)
  const saveData =
    nav && 'connection' in nav
      ? Boolean(
          (nav as Navigator & { connection?: { saveData?: boolean } }).connection
            ?.saveData,
        )
      : false

  let inferenceScale = 1
  let exportScale = 1
  let isLowEnd = false

  if (saveData) {
    inferenceScale *= 0.7
    exportScale *= 0.85
    isLowEnd = true
  }
  if (mem !== undefined) {
    if (mem <= 1) {
      inferenceScale *= 0.6
      exportScale *= 0.7
      isLowEnd = true
    } else if (mem <= 2) {
      inferenceScale *= 0.75
      exportScale *= 0.85
      isLowEnd = true
    } else if (mem <= 4) {
      inferenceScale *= 0.9
    } else if (mem >= 8 && hasWebGpu) {
      inferenceScale *= 1.12
    }
  }
  if (cores <= 2) {
    inferenceScale *= 0.7
    isLowEnd = true
  } else if (cores <= 4 && !hasWebGpu) {
    inferenceScale *= 0.85
  }

  // Mobile UA heuristic
  const ua = nav?.userAgent ?? ''
  if (/Android|iPhone|iPad|Mobile/i.test(ua) && !hasWebGpu) {
    inferenceScale *= 0.88
  }

  inferenceScale = clamp(inferenceScale, 0.55, 1.15)
  exportScale = clamp(exportScale, 0.65, 1)

  let label = 'desktop'
  if (isLowEnd) label = 'low-end'
  else if (hasWebGpu) label = 'gpu'
  else if (/Mobile/i.test(ua)) label = 'mobile'

  return { inferenceScale, exportScale, hasWebGpu, isLowEnd, label }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Apply device scale to a base edge length */
export function scaleEdge(base: number, scale: number, min = 640, max = 4096): number {
  return Math.round(Math.min(max, Math.max(min, base * scale)))
}
