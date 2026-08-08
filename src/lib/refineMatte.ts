/**
 * Fast cutout post-process with main-thread yields (no long freezes).
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

/** Process rows in chunks and yield so UI stays responsive */
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

async function loadRgbMatching(
  originalBlob: Blob,
  w: number,
  h: number,
): Promise<Uint8ClampedArray | null> {
  try {
    const bmp = await createImageBitmap(originalBlob, {
      resizeWidth: w,
      resizeHeight: h,
      resizeQuality: 'high',
    })
    try {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const cx = c.getContext('2d', { willReadFrequently: true })
      if (!cx) return null
      cx.drawImage(bmp, 0, 0, w, h)
      return cx.getImageData(0, 0, w, h).data
    } finally {
      bmp.close()
    }
  } catch {
    return null
  }
}

export async function refineCutout(cutoutBlob: Blob, originalBlob?: Blob): Promise<Blob> {
  const cutout = await blobToImageData(cutoutBlob)
  await yieldToMain()

  const { width: w, height: h, data: cut } = cutout
  const n = w * h

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

  const alpha = await refineAlphaFast(cut, w, h, mode)
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

  let rgb: Uint8ClampedArray = cut
  if (originalBlob) {
    const fromOrig = await loadRgbMatching(originalBlob, w, h)
    if (fromOrig) rgb = fromOrig
  }
  await yieldToMain()

  const out = new ImageData(w, h)
  const d = out.data

  await mapRows(h, 80, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
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

  if (mode === 'soft') {
    await mapRows(h, 48, (y0, y1) => {
      const yStart = Math.max(1, y0)
      const yEnd = Math.min(h - 1, y1)
      for (let y = yStart; y < yEnd; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x
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
          tryN(i - w)
          tryN(i + w)
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
