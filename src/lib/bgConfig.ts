import type { Config } from '@imgly/background-removal'
import { QUALITY_PRESETS, type QualityMode } from '../types'
import { resolvePublicPath } from './modelPath'

export function supportsWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export function createBgConfig(
  quality: QualityMode = 'fast',
  onProgress?: Config['progress'],
): Config {
  // Only use WebGPU + worker when we have a real Window+Document.
  // Worker contexts can polyfill `window` without `document` and crash polyfills.
  const inBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined'
  const gpu = inBrowser && supportsWebGpu()
  const preset = QUALITY_PRESETS[quality]

  // Resolve publicPath only on main thread (string is then passed into the lib)
  let publicPath: string | undefined
  try {
    publicPath = resolvePublicPath()
  } catch {
    publicPath = undefined
  }

  return {
    model: preset.model,
    device: gpu ? 'gpu' : 'cpu',
    // Keep inference on main thread if worker path is flaky; GPU still used when available
    proxyToWorker: false,
    publicPath,
    output: {
      format: 'image/png',
      quality: quality === 'quality' ? 1 : 0.92,
    },
    progress: onProgress,
  }
}
