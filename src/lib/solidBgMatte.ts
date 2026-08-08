/**
 * Perfect cutouts for QR/logos on flat backgrounds.
 * Samples corner colors → flood-fills background from borders by color.
 * Interior whites (finder patterns) stay — only exterior-connected bg is removed.
 */

import { yieldToMain } from './progress'

export interface SolidBgResult {
  blob: Blob
  confidence: number
  bg: { r: number; g: number; b: number }
}

function colorDist(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
): number {
  // Weighted toward green slightly (human-ish), but fine for flat UI colors
  const dr = r - br
  const dg = g - bg
  const db = b - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

async function loadImageData(
  source: Blob,
  w: number,
  h: number,
): Promise<ImageData> {
  const bmp = await createImageBitmap(source)
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')
    ctx.drawImage(bmp, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bmp.close()
  }
}

function samplePatch(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  half: number,
): { r: number; g: number; b: number; varSum: number; n: number } {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let y = Math.max(0, cy - half); y <= Math.min(h - 1, cy + half); y++) {
    for (let x = Math.max(0, cx - half); x <= Math.min(w - 1, cx + half); x++) {
      const p = (y * w + x) * 4
      r += data[p]
      g += data[p + 1]
      b += data[p + 2]
      rs.push(data[p])
      gs.push(data[p + 1])
      bs.push(data[p + 2])
      n++
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0, varSum: 999, n: 0 }
  const mr = r / n
  const mg = g / n
  const mb = b / n
  let v = 0
  for (let i = 0; i < n; i++) {
    v +=
      (rs[i] - mr) * (rs[i] - mr) +
      (gs[i] - mg) * (gs[i] - mg) +
      (bs[i] - mb) * (bs[i] - mb)
  }
  return { r: mr, g: mg, b: mb, varSum: v / n, n }
}

/**
 * Try flat-background cutout. Returns null if background is not uniform enough.
 */
export async function trySolidBackgroundCutout(
  source: Blob,
  w: number,
  h: number,
): Promise<SolidBgResult | null> {
  const image = await loadImageData(source, w, h)
  const data = image.data
  await yieldToMain()

  const half = Math.max(2, Math.round(Math.min(w, h) * 0.02))
  const corners = [
    samplePatch(data, w, h, half, half, half),
    samplePatch(data, w, h, w - 1 - half, half, half),
    samplePatch(data, w, h, half, h - 1 - half, half),
    samplePatch(data, w, h, w - 1 - half, h - 1 - half, half),
  ]

  // Also sample edge midpoints
  const edges = [
    samplePatch(data, w, h, Math.floor(w / 2), half, half),
    samplePatch(data, w, h, Math.floor(w / 2), h - 1 - half, half),
    samplePatch(data, w, h, half, Math.floor(h / 2), half),
    samplePatch(data, w, h, w - 1 - half, Math.floor(h / 2), half),
  ]

  const samples = [...corners, ...edges]

  // Background must be similar across samples
  let br = 0
  let bg = 0
  let bb = 0
  for (const s of samples) {
    br += s.r
    bg += s.g
    bb += s.b
  }
  br /= samples.length
  bg /= samples.length
  bb /= samples.length

  let maxCornerDist = 0
  let avgLocalVar = 0
  for (const s of samples) {
    maxCornerDist = Math.max(maxCornerDist, colorDist(s.r, s.g, s.b, br, bg, bb))
    avgLocalVar += s.varSum
  }
  avgLocalVar /= samples.length

  // Not a flat background
  if (maxCornerDist > 28 || avgLocalVar > 180) {
    return null
  }

  // Adaptive threshold: tighter if corners are very uniform
  const T = Math.min(55, Math.max(22, 18 + maxCornerDist * 1.2 + Math.sqrt(avgLocalVar) * 0.35))
  const Tsoft = T * 1.55

  const n = w * h
  // 1 = exterior background (connected to border + color match)
  const exterior = new Uint8Array(n)
  const qx = new Int32Array(n)
  const qy = new Int32Array(n)
  let head = 0
  let tail = 0

  const matchesBg = (i: number, thr: number) => {
    const p = i * 4
    return colorDist(data[p], data[p + 1], data[p + 2], br, bg, bb) <= thr
  }

  const push = (x: number, y: number) => {
    const i = y * w + x
    if (exterior[i]) return
    if (!matchesBg(i, T)) return
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

  await yieldToMain()

  // Expand soft fringe one more pass: exterior-adjacent + close to bg color
  const exterior2 = new Uint8Array(exterior)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (exterior2[i]) continue
      if (!matchesBg(i, Tsoft)) continue
      const near =
        exterior[i - 1] ||
        exterior[i + 1] ||
        exterior[i - w] ||
        exterior[i + w]
      if (near) exterior2[i] = 1
    }
  }

  let bgCount = 0
  for (let i = 0; i < n; i++) {
    if (exterior2[i]) bgCount++
  }
  const bgRatio = bgCount / n
  // Need meaningful background removed, but not everything
  if (bgRatio < 0.08 || bgRatio > 0.92) {
    return null
  }

  const out = new ImageData(w, h)
  const d = out.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const p = i * 4
      const r = data[p]
      const g = data[p + 1]
      const b = data[p + 2]

      if (exterior2[i]) {
        // Soft alpha at fringe based on color distance
        const dist = colorDist(r, g, b, br, bg, bb)
        if (dist >= Tsoft) {
          // shouldn't happen often
          d[p] = r
          d[p + 1] = g
          d[p + 2] = b
          d[p + 3] = 255
        } else if (dist <= T * 0.55) {
          d[p] = 0
          d[p + 1] = 0
          d[p + 2] = 0
          d[p + 3] = 0
        } else {
          // anti-aliased edge
          const t = (dist - T * 0.55) / (Tsoft - T * 0.55)
          const a = Math.round(Math.min(1, Math.max(0, t)) * 255)
          d[p] = r
          d[p + 1] = g
          d[p + 2] = b
          d[p + 3] = a
        }
      } else {
        d[p] = r
        d[p + 1] = g
        d[p + 2] = b
        d[p + 3] = 255
      }
    }
  }

  // Confidence: uniform corners + sensible bg ratio
  const uniformity = 1 - Math.min(1, maxCornerDist / 30)
  const ratioScore = 1 - Math.abs(bgRatio - 0.45) // prefer some subject
  const confidence = 0.45 * uniformity + 0.35 * (1 - Math.min(1, avgLocalVar / 200)) + 0.2 * Math.max(0, ratioScore)

  if (confidence < 0.42) return null

  await yieldToMain()

  const blob = await new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas qo‘llab-quvvatlanmaydi'))
      return
    }
    ctx.putImageData(out, 0, 0)
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG yozilmadi'))), 'image/png')
  })

  return {
    blob,
    confidence,
    bg: { r: Math.round(br), g: Math.round(bg), b: Math.round(bb) },
  }
}
