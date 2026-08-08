/**
 * Flat-background cutout (product shots, QR, logos).
 * - Corner sample → flood from borders
 * - Grow into similar shades (green ground / soft shadows of same hue)
 * - Edge despill (remove bg tint on subject fringe)
 */

import { yieldToMain } from './progress'

export interface SolidBgResult {
  blob: Blob
  confidence: number
  bg: { r: number; g: number; b: number }
}

function clamp(n: number, lo = 0, hi = 255): number {
  return n < lo ? lo : n > hi ? hi : n
}

/** RGB distance */
function rgbDist(r: number, g: number, b: number, br: number, bg: number, bb: number): number {
  const dr = r - br
  const dg = g - bg
  const db = b - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Distance that is looser on luminance for colored backgrounds
 * (mint green ground often slightly darker than wall but same hue).
 */
function bgMatchScore(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
): number {
  const rgb = rgbDist(r, g, b, br, bg, bb)
  // Chrominance-ish: how much hue differs ignoring pure brightness
  const lr = r - (r + g + b) / 3
  const lg = g - (r + g + b) / 3
  const lb = b - (r + g + b) / 3
  const lbr = br - (br + bg + bb) / 3
  const lbg = bg - (br + bg + bb) / 3
  const lbb = bb - (br + bg + bb) / 3
  const chroma = Math.sqrt(
    (lr - lbr) * (lr - lbr) + (lg - lbg) * (lg - lbg) + (lb - lbb) * (lb - lbb),
  )
  const lumDiff = Math.abs((r + g + b) / 3 - (br + bg + bb) / 3)
  // Allow more lum difference; penalize chroma difference harder
  return chroma * 1.65 + lumDiff * 0.45 + rgb * 0.25
}

async function loadImageData(source: Blob, w: number, h: number): Promise<ImageData> {
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
): { r: number; g: number; b: number; varSum: number } {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const vals: number[] = []
  for (let y = Math.max(0, cy - half); y <= Math.min(h - 1, cy + half); y++) {
    for (let x = Math.max(0, cx - half); x <= Math.min(w - 1, cx + half); x++) {
      const p = (y * w + x) * 4
      r += data[p]
      g += data[p + 1]
      b += data[p + 2]
      vals.push(data[p], data[p + 1], data[p + 2])
      n++
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0, varSum: 999 }
  const mr = r / n
  const mg = g / n
  const mb = b / n
  let v = 0
  for (let i = 0; i < n; i++) {
    const p = i * 3
    v +=
      (vals[p] - mr) ** 2 + (vals[p + 1] - mg) ** 2 + (vals[p + 2] - mb) ** 2
  }
  return { r: mr, g: mg, b: mb, varSum: v / n }
}

/** Classic green-screen style despill generalized to any bg hue */
function despillToward(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
  strength: number,
): [number, number, number] {
  // Push pixel away from background color
  const k = strength
  return [
    clamp(r + (r - br) * k),
    clamp(g + (g - bg) * k),
    clamp(b + (b - bb) * k),
  ]
}

export async function trySolidBackgroundCutout(
  source: Blob,
  w: number,
  h: number,
): Promise<SolidBgResult | null> {
  const image = await loadImageData(source, w, h)
  const data = image.data
  await yieldToMain()

  const half = Math.max(2, Math.round(Math.min(w, h) * 0.025))
  const samples = [
    samplePatch(data, w, h, half, half, half),
    samplePatch(data, w, h, w - 1 - half, half, half),
    samplePatch(data, w, h, half, h - 1 - half, half),
    samplePatch(data, w, h, w - 1 - half, h - 1 - half, half),
    samplePatch(data, w, h, Math.floor(w / 2), half, half),
    samplePatch(data, w, h, Math.floor(w / 2), h - 1 - half, half),
    samplePatch(data, w, h, half, Math.floor(h / 2), half),
    samplePatch(data, w, h, w - 1 - half, Math.floor(h / 2), half),
  ]

  let br = 0
  let bgc = 0
  let bb = 0
  for (const s of samples) {
    br += s.r
    bgc += s.g
    bb += s.b
  }
  br /= samples.length
  bgc /= samples.length
  bb /= samples.length

  let maxCornerDist = 0
  let avgLocalVar = 0
  for (const s of samples) {
    maxCornerDist = Math.max(maxCornerDist, rgbDist(s.r, s.g, s.b, br, bgc, bb))
    avgLocalVar += s.varSum
  }
  avgLocalVar /= samples.length

  // Allow slightly more variance (studio soft gradients still ok)
  if (maxCornerDist > 36 || avgLocalVar > 260) {
    return null
  }

  // Looser than before — eat soft green grounds / vignettes of same family
  const T = Math.min(72, Math.max(28, 24 + maxCornerDist * 1.4 + Math.sqrt(avgLocalVar) * 0.5))
  const Tgrow = T * 1.85
  const Tedge = T * 2.15

  const n = w * h
  const exterior = new Uint8Array(n)
  const qx = new Int32Array(n)
  const qy = new Int32Array(n)
  let head = 0
  let tail = 0

  const scoreAt = (i: number) => {
    const p = i * 4
    return bgMatchScore(data[p], data[p + 1], data[p + 2], br, bgc, bb)
  }

  const push = (x: number, y: number, thr: number) => {
    const i = y * w + x
    if (exterior[i]) return
    if (scoreAt(i) > thr) return
    exterior[i] = 1
    qx[tail] = x
    qy[tail] = y
    tail++
  }

  // Seed from full border
  for (let x = 0; x < w; x++) {
    push(x, 0, T)
    push(x, h - 1, T)
  }
  for (let y = 0; y < h; y++) {
    push(0, y, T)
    push(w - 1, y, T)
  }

  while (head < tail) {
    const x = qx[head]
    const y = qy[head]
    head++
    if (x > 0) push(x - 1, y, T)
    if (x < w - 1) push(x + 1, y, T)
    if (y > 0) push(x, y - 1, T)
    if (y < h - 1) push(x, y + 1, T)
  }

  await yieldToMain()

  // Grow exterior into bg-similar shades (mint ground island, soft shadows)
  for (let iter = 0; iter < 48; iter++) {
    let changed = 0
    const next = new Uint8Array(exterior)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (next[i]) continue
        if (scoreAt(i) > Tgrow) continue
        if (
          exterior[i - 1] ||
          exterior[i + 1] ||
          exterior[i - w] ||
          exterior[i + w] ||
          exterior[i - w - 1] ||
          exterior[i - w + 1] ||
          exterior[i + w - 1] ||
          exterior[i + w + 1]
        ) {
          next[i] = 1
          changed++
        }
      }
    }
    exterior.set(next)
    if (changed === 0) break
    if (iter % 8 === 7) await yieldToMain()
  }

  let bgCount = 0
  for (let i = 0; i < n; i++) if (exterior[i]) bgCount++
  const bgRatio = bgCount / n
  if (bgRatio < 0.06 || bgRatio > 0.94) return null

  const out = new ImageData(w, h)
  const d = out.data

  // Build alpha + RGB with soft edge + despill
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const p = i * 4
      let r = data[p]
      let g = data[p + 1]
      let b = data[p + 2]
      const sc = scoreAt(i)

      if (exterior[i]) {
        if (sc <= T * 0.7) {
          d[p] = 0
          d[p + 1] = 0
          d[p + 2] = 0
          d[p + 3] = 0
        } else {
          // fringe anti-alias
          const t = (sc - T * 0.7) / (Tedge - T * 0.7 + 0.001)
          const a = Math.round(clamp(t, 0, 1) * 255)
          const [dr, dg, db] = despillToward(r, g, b, br, bgc, bb, 0.55)
          d[p] = dr
          d[p + 1] = dg
          d[p + 2] = db
          d[p + 3] = a
        }
      } else {
        // Subject — despill if near bg / exterior
        let nearExt = false
        if (x > 0 && exterior[i - 1]) nearExt = true
        if (x < w - 1 && exterior[i + 1]) nearExt = true
        if (y > 0 && exterior[i - w]) nearExt = true
        if (y < h - 1 && exterior[i + w]) nearExt = true

        if (nearExt || sc < Tedge) {
          const strength = nearExt ? 0.4 : 0.22
          ;[r, g, b] = despillToward(r, g, b, br, bgc, bb, strength)
          // If still very close to bg color, fade alpha (leftover ground under products)
          if (sc < Tgrow * 0.92 && nearExt) {
            const fade = clamp((sc - T * 0.5) / (Tgrow - T * 0.5 + 0.001), 0, 1)
            d[p] = r
            d[p + 1] = g
            d[p + 2] = b
            d[p + 3] = Math.round(fade * 255)
            continue
          }
        }

        // Extra: pure bg-colored blobs that somehow remained subject
        // (enclosed? rare) — if almost exact bg and not high-contrast detail
        if (sc < T * 0.85) {
          // Only kill if mostly surrounded by exterior or bg-like
          let extN = 0
          let bgN = 0
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx
              const yy = y + dy
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
              const j = yy * w + xx
              if (exterior[j]) extN++
              else if (scoreAt(j) < Tgrow) bgN++
            }
          }
          if (extN + bgN >= 18) {
            d[p] = 0
            d[p + 1] = 0
            d[p + 2] = 0
            d[p + 3] = 0
            continue
          }
        }

        d[p] = r
        d[p + 1] = g
        d[p + 2] = b
        d[p + 3] = 255
      }
    }
  }

  await yieldToMain()

  // Final cleanup: 1px exterior choke of very low-alpha noise
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4
      const a = d[p + 3]
      if (a > 0 && a < 40) {
        d[p] = 0
        d[p + 1] = 0
        d[p + 2] = 0
        d[p + 3] = 0
      }
    }
  }

  const uniformity = 1 - Math.min(1, maxCornerDist / 36)
  const ratioScore = 1 - Math.abs(bgRatio - 0.4)
  const confidence =
    0.5 * uniformity +
    0.3 * (1 - Math.min(1, avgLocalVar / 260)) +
    0.2 * Math.max(0, ratioScore)

  if (confidence < 0.4) return null

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
    c.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('PNG yozilmadi'))), 'image/png')
  })

  return {
    blob,
    confidence,
    bg: { r: Math.round(br), g: Math.round(bgc), b: Math.round(bb) },
  }
}
