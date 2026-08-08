/**
 * Cutout post-process:
 * 1) Refine AI alpha at inference resolution
 * 2) Upscale mask + apply onto full-res original RGB (sharp export)
 */

import { yieldToMain } from './progress'

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bmp = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')
    ctx.drawImage(bmp, 0, 0)
    return ctx.getImageData(0, 0, bmp.width, bmp.height)
  } finally {
    bmp.close()
  }
}

function imageDataToPngBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas qo‘llab-quvvatlanmaydi'))
  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Matte saqlanmadi'))),
      'image/png',
    )
  })
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function detectEdgeMode(data: Uint8ClampedArray, n: number): 'hard' | 'soft' {
  const step = Math.max(1, Math.floor(n / 4000))
  let mid = 0
  let kept = 0
  for (let i = 0; i < n; i += step) {
    const a = data[i * 4 + 3]
    if (a > 20 && a < 235) mid++
    if (a > 20) kept++
  }
  if (kept === 0) return 'soft'
  return mid / kept < 0.14 ? 'hard' : 'soft'
}

async function mapRows(
  h: number,
  chunk: number,
  fn: (y0: number, y1: number) => void,
): Promise<void> {
  for (let y = 0; y < h; y += chunk) {
    fn(y, Math.min(h, y + chunk))
    if (y + chunk < h) await yieldToMain()
  }
}

async function refineAlphaFast(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  mode: 'hard' | 'soft',
): Promise<Uint8ClampedArray> {
  const n = w * h
  const a0 = new Uint8ClampedArray(n)

  if (mode === 'hard') {
    await mapRows(h, 64, (y0, y1) => {
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          const s = smoothstep(0.28, 0.72, src[i * 4 + 3] / 255)
          a0[i] = s >= 0.5 ? 255 : 0
        }
      }
    })

    const out = new Uint8ClampedArray(n)
    await mapRows(h, 64, (y0, y1) => {
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          let m = a0[i]
          if (m === 0) {
            out[i] = 0
            continue
          }
          if (x > 0 && a0[i - 1] < m) m = a0[i - 1]
          if (x < w - 1 && a0[i + 1] < m) m = a0[i + 1]
          if (y > 0 && a0[i - w] < m) m = a0[i - w]
          if (y < h - 1 && a0[i + w] < m) m = a0[i + w]
          out[i] = m
        }
      }
    })
    return out
  }

  await mapRows(h, 96, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const s = smoothstep(0.08, 0.9, src[i * 4 + 3] / 255)
        const v = Math.round(s * 255)
        a0[i] = v < 12 ? 0 : v > 248 ? 255 : v
      }
    }
  })
  return a0
}

/** Smooth upscale of single-channel alpha via canvas */
async function upscaleAlpha(
  alpha: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Promise<Uint8ClampedArray> {
  if (sw === dw && sh === dh) return alpha

  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d')
  if (!sctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')

  const img = sctx.createImageData(sw, sh)
  const d = img.data
  for (let i = 0; i < alpha.length; i++) {
    const p = i * 4
    const a = alpha[i]
    d[p] = a
    d[p + 1] = a
    d[p + 2] = a
    d[p + 3] = 255
  }
  sctx.putImageData(img, 0, 0)
  await yieldToMain()

  const big = document.createElement('canvas')
  big.width = dw
  big.height = dh
  const bctx = big.getContext('2d', { willReadFrequently: true })
  if (!bctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, dw, dh)
  await yieldToMain()

  const bigData = bctx.getImageData(0, 0, dw, dh).data
  const out = new Uint8ClampedArray(dw * dh)
  for (let i = 0; i < out.length; i++) {
    out[i] = bigData[i * 4]
  }
  return out
}

async function loadRgb(
  source: Blob,
  w: number,
  h: number,
): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(source)
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d', { willReadFrequently: true })
    if (!cx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')
    cx.imageSmoothingEnabled = true
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(bmp, 0, 0, w, h)
    return cx.getImageData(0, 0, w, h).data
  } finally {
    bmp.close()
  }
}

export interface RefineOptions {
  /** Full-resolution source (original file) for sharp RGB */
  exportSource?: Blob
  exportWidth?: number
  exportHeight?: number
}

/**
 * @param cutoutBlob - PNG from removeBackground (inference size)
 * @param options - full-res composite targets
 */
export async function refineCutout(
  cutoutBlob: Blob,
  options: RefineOptions = {},
): Promise<Blob> {
  const cutout = await blobToImageData(cutoutBlob)
  await yieldToMain()

  const sw = cutout.width
  const sh = cutout.height
  const cut = cutout.data
  const n = sw * sh

  let opaque = 0
  for (let p = 3; p < cut.length; p += 4) {
    if (cut[p] > 16) opaque++
  }
  if (opaque < n * 0.001) {
    throw new Error(
      'Subyekt aniqlanmadi. Aniqroq fonli rasm yoki boshqa rasm sinab ko‘ring.',
    )
  }

  const mode = detectEdgeMode(cut, n)
  await yieldToMain()

  let alpha = await refineAlphaFast(cut, sw, sh, mode)
  await yieldToMain()

  let kept = 0
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 8) kept++
  }
  if (kept < n * 0.0005) {
    throw new Error(
      'Subyekt aniqlanmadi. Aniqroq fonli rasm yoki boshqa rasm sinab ko‘ring.',
    )
  }

  // Target export resolution (full-res composite)
  const dw = options.exportWidth && options.exportWidth > 0 ? options.exportWidth : sw
  const dh = options.exportHeight && options.exportHeight > 0 ? options.exportHeight : sh
  const needsUpscale = Boolean(options.exportSource) && (dw !== sw || dh !== sh)

  if (needsUpscale) {
    alpha = await upscaleAlpha(alpha, sw, sh, dw, dh)
    await yieldToMain()
  }

  let rgb: Uint8ClampedArray
  if (options.exportSource) {
    rgb = await loadRgb(options.exportSource, dw, dh)
  } else {
    rgb = cut
  }
  await yieldToMain()

  const out = new ImageData(dw, dh)
  const d = out.data

  await mapRows(dh, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < dw; x++) {
        const i = y * dw + x
        const p = i * 4
        const a = alpha[i]
        if (a < 3) {
          d[p] = 0
          d[p + 1] = 0
          d[p + 2] = 0
          d[p + 3] = 0
        } else {
          d[p] = rgb[p]
          d[p + 1] = rgb[p + 1]
          d[p + 2] = rgb[p + 2]
          d[p + 3] = a
        }
      }
    }
  })

  // Soft edge despill at export res (only mid-alpha)
  if (mode === 'soft') {
    await mapRows(dh, 40, (y0, y1) => {
      const yStart = Math.max(1, y0)
      const yEnd = Math.min(dh - 1, y1)
      for (let y = yStart; y < yEnd; y++) {
        for (let x = 1; x < dw - 1; x++) {
          const i = y * dw + x
          const a = alpha[i]
          if (a === 0 || a > 240) continue
          const p = i * 4
          let r = 0
          let g = 0
          let b = 0
          let c = 0
          const tryN = (j: number) => {
            if (alpha[j] < 250) return
            const q = j * 4
            r += rgb[q]
            g += rgb[q + 1]
            b += rgb[q + 2]
            c++
          }
          tryN(i - 1)
          tryN(i + 1)
          tryN(i - dw)
          tryN(i + dw)
          if (c === 0) continue
          const t = (1 - a / 255) * 0.65
          d[p] = Math.round(d[p] * (1 - t) + (r / c) * t)
          d[p + 1] = Math.round(d[p + 1] * (1 - t) + (g / c) * t)
          d[p + 2] = Math.round(d[p + 2] * (1 - t) + (b / c) * t)
        }
      }
    })
  }

  await yieldToMain()
  return imageDataToPngBlob(out)
}
