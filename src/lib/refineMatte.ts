/**
 * Cutout post-process focused on quality:
 * - HARD (QR/logo): binary mask, nearest upscale, dust kill, no soft haze
 * - SOFT (photo): smart edge + despill
 */

import { yieldToMain } from './progress'
import { smartSoftEdge } from './smartEdge'

export type EdgeMode = 'hard' | 'soft'

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

/**
 * Detect logo/QR vs photo.
 * Uses alpha histogram + RGB color count (graphics = few flat colors).
 */
function detectEdgeMode(rgba: Uint8ClampedArray, n: number): EdgeMode {
  const step = Math.max(1, Math.floor(n / 6000))
  let mid = 0
  let kept = 0
  let solid = 0
  const colorBuckets = new Set<number>()

  for (let i = 0; i < n; i += step) {
    const p = i * 4
    const a = rgba[p + 3]
    if (a > 18) {
      kept++
      if (a > 20 && a < 230) mid++
      if (a >= 230) solid++
      // quantize RGB for palette size
      const r = rgba[p] >> 4
      const g = rgba[p + 1] >> 4
      const b = rgba[p + 2] >> 4
      colorBuckets.add((r << 8) | (g << 4) | b)
    }
  }

  if (kept === 0) return 'soft'

  const midRatio = mid / kept
  const solidRatio = solid / kept
  const palette = colorBuckets.size

  // Graphics: mostly solid alpha + small palette (QR, logo, icons)
  if (palette <= 48 && solidRatio > 0.55 && midRatio < 0.35) return 'hard'
  if (midRatio < 0.12) return 'hard'
  if (palette <= 24 && midRatio < 0.4) return 'hard'

  // Large mid-alpha band → photo hair/soft
  if (midRatio > 0.18) return 'soft'

  // Default: if mostly opaque subject with little haze → hard
  return solidRatio > 0.7 ? 'hard' : 'soft'
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

function min4(src: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const i = y * w + x
  let m = src[i]
  if (x > 0) m = Math.min(m, src[i - 1])
  if (x < w - 1) m = Math.min(m, src[i + 1])
  if (y > 0) m = Math.min(m, src[i - w])
  if (y < h - 1) m = Math.min(m, src[i + w])
  return m
}

function max4(src: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const i = y * w + x
  let m = src[i]
  if (x > 0) m = Math.max(m, src[i - 1])
  if (x < w - 1) m = Math.max(m, src[i + 1])
  if (y > 0) m = Math.max(m, src[i - w])
  if (y < h - 1) m = Math.max(m, src[i + w])
  return m
}

/** Aggressive hard matte for QR/logos — kills white fringe haze */
async function refineAlphaHard(
  src: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<Uint8ClampedArray> {
  const n = w * h
  const bin = new Uint8ClampedArray(n)

  // High threshold: semi-transparent haze (typical AI fringe) → background
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = src[i * 4 + 3]
        // Also reject bright near-white fringe with low alpha
        const r = src[i * 4]
        const g = src[i * 4 + 1]
        const b = src[i * 4 + 2]
        const lum = (r + g + b) / 3
        // Haze: pale + not fully opaque
        const isHaze = a < 200 && lum > 200 && a > 0
        if (isHaze || a < 140) {
          bin[i] = 0
        } else {
          bin[i] = 255
        }
      }
    }
  })

  // Open: remove 1px dust (erode → dilate)
  const eroded = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        eroded[y * w + x] = min4(bin, w, h, x, y)
      }
    }
  })
  const opened = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        opened[y * w + x] = max4(eroded, w, h, x, y)
      }
    }
  })

  // Close: fill pinholes inside modules (dilate → erode)
  const dilated = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        dilated[y * w + x] = max4(opened, w, h, x, y)
      }
    }
  })
  let closed = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        closed[y * w + x] = min4(dilated, w, h, x, y)
      }
    }
  })

  // Outer choke (1px) — removes remaining halo ring without eating blocks too hard
  const choked = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        choked[y * w + x] = min4(closed, w, h, x, y)
      }
    }
  })

  return choked
}

async function refineAlphaSoft(
  src: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<Uint8ClampedArray> {
  const n = w * h
  const a0 = new Uint8ClampedArray(n)
  await mapRows(h, 96, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const s = smoothstep(0.06, 0.9, src[i * 4 + 3] / 255)
        const v = Math.round(s * 255)
        a0[i] = v < 8 ? 0 : v > 250 ? 255 : v
      }
    }
  })
  return a0
}

/** Nearest-neighbor upscale for hard masks (no soft blur!) */
async function upscaleAlphaNearest(
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
  // CRITICAL: no smoothing for QR/logo
  bctx.imageSmoothingEnabled = false
  bctx.drawImage(small, 0, 0, dw, dh)
  await yieldToMain()

  const bigData = bctx.getImageData(0, 0, dw, dh).data
  const out = new Uint8ClampedArray(dw * dh)
  for (let i = 0; i < out.length; i++) {
    // Re-binary after scale
    out[i] = bigData[i * 4] >= 128 ? 255 : 0
  }
  return out
}

/** Smooth upscale for photo mattes */
async function upscaleAlphaSmooth(
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
  exportSource?: Blob
  exportWidth?: number
  exportHeight?: number
}

export interface RefineResult {
  blob: Blob
  edgeMode: EdgeMode
}

/**
 * Refine AI cutout. Returns edgeMode so UI can default feather=0 for graphics.
 */
export async function refineCutout(
  cutoutBlob: Blob,
  options: RefineOptions = {},
): Promise<RefineResult> {
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

  let alpha =
    mode === 'hard'
      ? await refineAlphaHard(cut, sw, sh)
      : await refineAlphaSoft(cut, sw, sh)
  await yieldToMain()

  if (mode === 'soft') {
    let rgbInf: Uint8ClampedArray = cut
    if (options.exportSource) {
      try {
        rgbInf = await loadRgb(options.exportSource, sw, sh)
      } catch {
        rgbInf = cut
      }
    }
    alpha = await smartSoftEdge(alpha, rgbInf, sw, sh)
    await yieldToMain()
  }

  let kept = 0
  for (let i = 0; i < n; i++) {
    if (alpha[i] > 8) kept++
  }
  if (kept < n * 0.0005) {
    throw new Error(
      'Subyekt aniqlanmadi. Aniqroq fonli rasm yoki boshqa rasm sinab ko‘ring.',
    )
  }

  const dw = options.exportWidth && options.exportWidth > 0 ? options.exportWidth : sw
  const dh = options.exportHeight && options.exportHeight > 0 ? options.exportHeight : sh
  const needsUpscale = Boolean(options.exportSource) && (dw !== sw || dh !== sh)

  if (needsUpscale) {
    alpha =
      mode === 'hard'
        ? await upscaleAlphaNearest(alpha, sw, sh, dw, dh)
        : await upscaleAlphaSmooth(alpha, sw, sh, dw, dh)
    await yieldToMain()
  } else if (mode === 'hard') {
    // Ensure binary even without upscale
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = alpha[i] >= 128 ? 255 : 0
    }
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
          // Always original RGB (no AI fringe colors)
          d[p] = rgb[p]
          d[p + 1] = rgb[p + 1]
          d[p + 2] = rgb[p + 2]
          d[p + 3] = mode === 'hard' ? 255 : a
        }
      }
    }
  })

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
          const t = (1 - a / 255) * 0.7
          d[p] = Math.round(d[p] * (1 - t) + (r / c) * t)
          d[p + 1] = Math.round(d[p + 1] * (1 - t) + (g / c) * t)
          d[p + 2] = Math.round(d[p + 2] * (1 - t) + (b / c) * t)
        }
      }
    })
  }

  await yieldToMain()
  return { blob: await imageDataToPngBlob(out), edgeMode: mode }
}
