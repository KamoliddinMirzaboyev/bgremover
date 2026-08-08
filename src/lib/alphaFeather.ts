/**
 * Soft edge controls: separable box-blur on alpha only.
 * amount 0–100 → radius ~0–14 px (scaled by image size).
 */

import { yieldToMain } from './progress'

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bmp = await createImageBitmap(blob)
  try {
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')
    ctx.drawImage(bmp, 0, 0)
    return ctx.getImageData(0, 0, bmp.width, bmp.height)
  } finally {
    bmp.close()
  }
}

function imageDataToPng(imageData: ImageData): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = imageData.width
  c.height = imageData.height
  const ctx = c.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas qo‘llab-quvvatlanmaydi'))
  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG yozilmadi'))), 'image/png')
  })
}

function boxBlur1D(
  src: Float32Array | Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean,
): Float32Array {
  const out = new Float32Array(w * h)
  const r = Math.max(1, Math.min(radius, 24))
  const diam = r * 2 + 1

  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      let sum = 0
      for (let k = -r; k <= r; k++) {
        sum += src[row + clamp(k, 0, w - 1)]
      }
      for (let x = 0; x < w; x++) {
        out[row + x] = sum / diam
        const remove = src[row + clamp(x - r, 0, w - 1)]
        const add = src[row + clamp(x + r + 1, 0, w - 1)]
        sum += add - remove
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) {
        sum += src[clamp(k, 0, h - 1) * w + x]
      }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / diam
        const remove = src[clamp(y - r, 0, h - 1) * w + x]
        const add = src[clamp(y + r + 1, 0, h - 1) * w + x]
        sum += add - remove
      }
    }
  }
  return out
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

function blurAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  const hPass = boxBlur1D(alpha, w, h, radius, true)
  const vPass = boxBlur1D(hPass, w, h, radius, false)
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(vPass[i])
  }
  return out
}

export async function featherCutout(blob: Blob, amount: number): Promise<Blob> {
  const a = Math.max(0, Math.min(100, amount))
  if (a < 1) return blob

  const imageData = await blobToImageData(blob)
  const { width: w, height: h, data } = imageData
  const n = w * h

  const short = Math.min(w, h)
  const maxR = Math.max(1, Math.round(short * 0.012))
  const radius = Math.max(1, Math.round((a / 100) * Math.min(14, maxR + 6)))

  const alpha = new Uint8ClampedArray(n)
  for (let i = 0, p = 3; i < n; i++, p += 4) {
    alpha[i] = data[p]
  }

  let blurred = blurAlpha(alpha, w, h, radius)
  await yieldToMain()
  // Second lighter pass ≈ smoother falloff
  blurred = blurAlpha(blurred, w, h, Math.max(1, Math.floor(radius * 0.6)))
  await yieldToMain()

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const na = blurred[i]
    if (na < 2) {
      data[p] = 0
      data[p + 1] = 0
      data[p + 2] = 0
      data[p + 3] = 0
    } else {
      data[p + 3] = na
    }
  }

  return imageDataToPng(imageData)
}

export function featherLabel(amount: number): string {
  if (amount < 5) return 'O‘tkir'
  if (amount < 35) return 'Yengil'
  if (amount < 65) return 'O‘rtacha'
  return 'Yumshoq'
}
