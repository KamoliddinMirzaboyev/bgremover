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
  const gpu = supportsWebGpu()
  const preset = QUALITY_PRESETS[quality]
  return {
    model: preset.model,
    device: gpu ? 'gpu' : 'cpu',
    proxyToWorker: gpu,
    publicPath: resolvePublicPath(),
    output: {
      format: 'image/png',
      quality: quality === 'quality' ? 1 : 0.92,
    },
    progress: onProgress,
  }
}
