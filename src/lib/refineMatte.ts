/**
 * Cutout refine — quality-first, conservative for graphics.
 *
 * HARD (QR/logo): keep as much subject as possible; only strip pale fringe;
 *   fill true interior holes; NO island-kill / heavy open that eats modules.
 * SOFT (photo): light contrast + smart edge + despill.
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
      colorBuckets.add((rgba[p] >> 4 << 8) | (rgba[p + 1] >> 4 << 4) | (rgba[p + 2] >> 4))
    }
  }
  if (kept === 0) return 'soft'
  const midRatio = mid / kept
  const solidRatio = solid / kept
  const palette = colorBuckets.size

  if (palette <= 64 && solidRatio > 0.4) return 'hard'
  if (midRatio < 0.16) return 'hard'
  if (palette <= 36) return 'hard'
  if (midRatio > 0.22) return 'soft'
  return solidRatio > 0.6 ? 'hard' : 'soft'
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

/** Transparent regions connected to image border = true background */
function fillInteriorHoles(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray {
  const n = w * h
  const exterior = new Uint8Array(n)
  const qx = new Int32Array(n)
  const qy = new Int32Array(n)
  let head = 0
  let tail = 0

  const push = (x: number, y: number) => {
    const i = y * w + x
    if (exterior[i] || alpha[i] > 0) return
    exterior[i] = 1
    qx[tail] = x
    qy[tail] = y
    tail++
  }

  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }

  while (head < tail) {
    const x = qx[head]
    const y = qy[head]
    head++
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }

  const out = new Uint8ClampedArray(alpha)
  for (let i = 0; i < n; i++) {
    if (out[i] === 0 && !exterior[i]) out[i] = 255
  }
  return out
}

/**
 * Conservative hard matte:
 * - LOW threshold → keep weak AI modules (QR cells)
 * - Strip only near-white semi-transparent fringe
 * - Fill true interior holes
 * - One gentle close (optional tiny gaps)
 * - NEVER remove small islands (those ARE QR modules)
 */
async function refineAlphaHard(
  src: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<Uint8ClampedArray> {
  const n = w * h
  const bin = new Uint8ClampedArray(n)

  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const p = i * 4
        const a = src[p + 3]
        const r = src[p]
        const g = src[p + 1]
        const b = src[p + 2]
        const lum = (r + g + b) / 3

        // Only pure pale fringe (classic AI white smudge)
        const whiteFringe =
          a > 0 && a < 180 && lum >= 225 && Math.min(r, g, b) >= 210

        if (whiteFringe) {
          bin[i] = 0
        } else if (a >= 48) {
          // Keep partial detections — QR cells often land mid-alpha
          bin[i] = 255
        } else {
          bin[i] = 0
        }
      }
    }
  })

  let alpha = fillInteriorHoles(bin, w, h)
  await yieldToMain()

  // One light CLOSE only (join 1px cracks). No open, no choke, no island kill.
  const dil = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        dil[y * w + x] = max4(alpha, w, h, x, y)
      }
    }
  })
  const closed = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        closed[y * w + x] = min4(dil, w, h, x, y)
      }
    }
  })

  alpha = fillInteriorHoles(closed, w, h)
  await yieldToMain()
  return alpha
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
        const p = i * 4
        const a = src[p + 3]
        const lum = (src[p] + src[p + 1] + src[p + 2]) / 3
        if (a > 0 && a < 190 && lum >= 225) {
          a0[i] = 0
          continue
        }
        const s = smoothstep(0.05, 0.88, a / 255)
        const v = Math.round(s * 255)
        a0[i] = v < 6 ? 0 : v > 252 ? 255 : v
      }
    }
  })

  // Hole-fill on binary view, write back solids
  const bin = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) bin[i] = a0[i] >= 80 ? 255 : 0
  const filled = fillInteriorHoles(bin, w, h)
  for (let i = 0; i < n; i++) {
    if (filled[i] === 255 && a0[i] < 80) a0[i] = 255
  }
  return a0
}

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
  bctx.imageSmoothingEnabled = false
  bctx.drawImage(small, 0, 0, dw, dh)
  await yieldToMain()

  const bigData = bctx.getImageData(0, 0, dw, dh).data
  const out = new Uint8ClampedArray(dw * dh)
  for (let i = 0; i < out.length; i++) {
    out[i] = bigData[i * 4] >= 128 ? 255 : 0
  }
  return fillInteriorHoles(out, dw, dh)
}

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
  for (let i = 0; i < out.length; i++) out[i] = bigData[i * 4]
  return out
}

async function loadRgb(source: Blob, w: number, h: number): Promise<Uint8ClampedArray> {
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
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = alpha[i] >= 128 ? 255 : 0
    }
    alpha = fillInteriorHoles(alpha, dw, dh)
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
          const t = (1 - a / 255) * 0.65
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
