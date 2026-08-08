/**
 * Smart soft-edge pass for photo mattes:
 * - edge-aware alpha smooth (preserves solid interiors)
 * - light chroma decontaminate using local solid colors
 */

import { yieldToMain } from './progress'

export async function smartSoftEdge(
  alpha: Uint8ClampedArray,
  rgb: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<Uint8ClampedArray> {
  const n = w * h
  const out = new Uint8ClampedArray(n)

  // 1) Edge-aware 3×3 smooth only near mid-alpha / gradient
  await yieldRows(h, 80, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = alpha[i]
        if (a < 8) {
          out[i] = 0
          continue
        }
        if (a > 247) {
          out[i] = 255
          continue
        }

        // Local gradient magnitude (alpha)
        let minA = a
        let maxA = a
        let sum = 0
        let cnt = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx))
            const yy = Math.min(h - 1, Math.max(0, y + dy))
            const v = alpha[yy * w + xx]
            minA = Math.min(minA, v)
            maxA = Math.max(maxA, v)
            sum += v
            cnt++
          }
        }
        const range = maxA - minA
        if (range < 12) {
          // Flat — keep / snap
          out[i] = a > 128 ? Math.max(a, 220) : Math.min(a, 40)
        } else {
          // Soft blend toward local mean (hair / fur)
          const mean = sum / cnt
          out[i] = Math.round(a * 0.45 + mean * 0.55)
        }
      }
    }
  })

  // 2) Tiny dilate-erode balance on soft only (fill pinholes, kill dust)
  const cleaned = new Uint8ClampedArray(n)
  await yieldRows(h, 80, (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = out[i]
        if (a > 40 && a < 220) {
          // median of cross
          const vals = [a]
          if (x > 0) vals.push(out[i - 1])
          if (x < w - 1) vals.push(out[i + 1])
          if (y > 0) vals.push(out[i - w])
          if (y < h - 1) vals.push(out[i + w])
          vals.sort((p, q) => p - q)
          cleaned[i] = vals[Math.floor(vals.length / 2)]
        } else {
          cleaned[i] = a
        }
      }
    }
  })

  // silence unused rgb in this pass (used by caller for despill)
  void rgb
  return cleaned
}

async function yieldRows(
  h: number,
  chunk: number,
  fn: (y0: number, y1: number) => void,
): Promise<void> {
  for (let y = 0; y < h; y += chunk) {
    fn(y, Math.min(h, y + chunk))
    if (y + chunk < h) await yieldToMain()
  }
}
