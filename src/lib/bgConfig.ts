import type { Config } from '@imgly/background-removal'

/** Quantized model: ~2× smaller download + faster inference, quality still strong */
export const MODEL: NonNullable<Config['model']> = 'isnet_quint8'

export function supportsWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export function createBgConfig(onProgress?: Config['progress']): Config {
  const gpu = supportsWebGpu()
  return {
    model: MODEL,
    device: gpu ? 'gpu' : 'cpu',
    // Worker only used with WebGPU in onnxruntime path — keeps UI responsive
    proxyToWorker: gpu,
    output: {
      format: 'image/png',
      quality: 0.9,
    },
    progress: onProgress,
  }
}
