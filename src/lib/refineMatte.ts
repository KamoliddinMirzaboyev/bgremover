/**
 * High-quality cutout post-process:
 * - Fill interior holes (soccer ball panels, logo gaps AI wrongly punched)
 * - Kill only pale fringe haze (not dark subject interiors)
 * - Hard: binary + nearest upscale; Soft: smart edge + despill
 * - No default feather blur (UI defaults to 0)
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

  // Logos / icons / QR: limited palette or mostly solid alpha
  if (palette <= 64 && solidRatio > 0.45) return 'hard'
  if (midRatio < 0.16) return 'hard'
  if (palette <= 32) return 'hard'
  if (midRatio > 0.22) return 'soft'
  return solidRatio > 0.62 ? 'hard' : 'soft'
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

/**
 * Fill transparent holes that do NOT touch the image border.
 * Fixes soccer-ball panels / logo interiors AI wrongly punched out.
 */
function fillInteriorHoles(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray {
  const n = w * h
  // 1 = true background (connected to border through transparent pixels)
  const exterior = new Uint8Array(n)
  const qx = new Int32Array(n)
  const qy = new Int32Array(n)
  let head = 0
  let tail = 0

  const push = (x: number, y: number) => {
    const i = y * w + x
    if (exterior[i]) return
    if (alpha[i] > 0) return
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
    // Transparent but not exterior → hole inside subject
    if (out[i] === 0 && !exterior[i]) {
      out[i] = 255
    }
  }
  return out
}

/**
 * Recover dark subject pixels AI marked as bg (black ball panels).
 * If low alpha but majority of neighbors are solid subject → keep as subject.
 */
function recoverDarkInteriors(
  alpha: Uint8ClampedArray,
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (out[i] >= 200) continue
      const p = i * 4
      const a = rgba[p + 3]
      // only consider pixels AI was unsure about or punched
      if (a > 220) continue

      let solidN = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue
          const j = (y + dy) * w + (x + dx)
          if (out[j] >= 200) solidN++
        }
      }
      // Surrounded by subject → restore
      if (solidN >= 12) {
        out[i] = 255
      }
    }
  }
  return out
}

/** Hard matte: clean graphics without eating dark interiors or creating holes */
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

        // Pale fringe only (white/gray smudge) — not dark logo parts
        const paleHaze = a > 0 && a < 210 && lum > 210 && r > 190 && g > 190 && b > 190

        if (paleHaze) {
          bin[i] = 0
        } else if (a >= 100) {
          bin[i] = 255
        } else if (a >= 40) {
          // mid: keep if not pale (could be colored glow edge)
          bin[i] = lum < 200 ? 255 : 0
        } else {
          bin[i] = 0
        }
      }
    }
  })

  // Recover dark interiors (ball panels)
  let alpha = recoverDarkInteriors(bin, src, w, h)
  await yieldToMain()

  // Fill enclosed holes
  alpha = fillInteriorHoles(alpha, w, h)
  await yieldToMain()

  // Morphological CLOSE only (dilate→erode) — joins gaps, does NOT punch holes
  // (open/erode-first was destroying ball panels and thin logo strokes)
  const dilated = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        dilated[y * w + x] = max4(alpha, w, h, x, y)
      }
    }
  })
  const closed = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        closed[y * w + x] = min4(dilated, w, h, x, y)
      }
    }
  })

  // Second close pass for larger gaps
  const dil2 = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        dil2[y * w + x] = max4(closed, w, h, x, y)
      }
    }
  })
  let result = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        result[y * w + x] = min4(dil2, w, h, x, y)
      }
    }
  })

  const filled2 = fillInteriorHoles(result, w, h)
  await yieldToMain()

  // Light outer clean: only remove isolated 1px exterior dust (not full open)
  const cleaned = new Uint8ClampedArray(n)
  await mapRows(h, 64, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (filled2[i] === 0) {
          cleaned[i] = 0
          continue
        }
        // Drop lone speckles: solid pixel with almost no solid neighbors
        let nSolid = 0
        if (x > 0 && filled2[i - 1]) nSolid++
        if (x < w - 1 && filled2[i + 1]) nSolid++
        if (y > 0 && filled2[i - w]) nSolid++
        if (y < h - 1 && filled2[i + w]) nSolid++
        cleaned[i] = nSolid === 0 ? 0 : 255
      }
    }
  })

  return cleaned
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
        const r = src[p]
        const g = src[p + 1]
        const b = src[p + 2]
        const lum = (r + g + b) / 3
        // kill pale fringe only
        if (a < 200 && lum > 215 && a > 0) {
          a0[i] = 0
          continue
        }
        const s = smoothstep(0.05, 0.88, a / 255)
        const v = Math.round(s * 255)
        a0[i] = v < 6 ? 0 : v > 252 ? 255 : v
      }
    }
  })

  // Hole fill on near-binary version, then restore soft edges
  const bin = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) bin[i] = a0[i] >= 90 ? 255 : 0
  const recovered = recoverDarkInteriors(bin, src, w, h)
  const filled = fillInteriorHoles(recovered, w, h)

  // Where we filled a hole, force solid; elsewhere keep soft alpha
  for (let i = 0; i < n; i++) {
    if (filled[i] === 255 && a0[i] < 90) {
      a0[i] = 255
    }
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
  // Fill holes again after scale
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
  for (let i = 0; i < out.length; i++) {
    out[i] = bigData[i * 4]
  }
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
