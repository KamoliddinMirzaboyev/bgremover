/**
 * Professional cutout post-process:
 * 1) Clean AI alpha (noise, holes, halo)
 * 2) Re-apply mask onto ORIGINAL RGB (no washed fringe colors)
 * 3) Adaptive hard edges for graphics (QR/logo) vs soft for photos
 */

function loadBlobToImageData(blob: Blob): Promise<{
  imageData: ImageData
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas qo‘llab-quvvatlanmaydi'))
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ imageData, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Rasm o‘qilmadi'))
    }
    img.src = url
  })
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

function detectEdgeMode(alpha: Uint8ClampedArray): 'hard' | 'soft' {
  let mid = 0
  let kept = 0
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]
    if (a > 20 && a < 235) mid++
    if (a > 20) kept++
  }
  if (kept === 0) return 'soft'
  return mid / kept < 0.14 ? 'hard' : 'soft'
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

function median3x3(src: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  const vals: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    const yy = Math.min(h - 1, Math.max(0, y + dy))
    for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx))
      vals.push(src[yy * w + xx])
    }
  }
  vals.sort((a, b) => a - b)
  return vals[4]
}

function refineAlpha(
  srcAlpha: Uint8ClampedArray,
  w: number,
  h: number,
  mode: 'hard' | 'soft',
): Uint8ClampedArray {
  const n = w * h

  // Speckle filter
  const med = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      med[y * w + x] = median3x3(srcAlpha, w, h, x, y)
    }
  }

  // Open: remove thin false-positive strands
  const eroded = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      eroded[y * w + x] = min4(med, w, h, x, y)
    }
  }
  const opened = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      opened[y * w + x] = max4(eroded, w, h, x, y)
    }
  }

  // Close: fill pinholes inside subject
  const dilated = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dilated[y * w + x] = max4(opened, w, h, x, y)
    }
  }
  const closed = new Uint8ClampedArray(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      closed[y * w + x] = min4(dilated, w, h, x, y)
    }
  }

  // Contrast stretch
  const low = mode === 'hard' ? 0.32 : 0.1
  const high = mode === 'hard' ? 0.68 : 0.9
  let refined = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const s = smoothstep(low, high, closed[i] / 255)
    const pushed = mode === 'hard' ? smoothstep(0.2, 0.8, s) : s
    refined[i] = Math.round(pushed * 255)
  }

  // Outer halo choke (1px for graphics, skip for soft hair)
  if (mode === 'hard') {
    const choked = new Uint8ClampedArray(n)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        choked[y * w + x] = min4(refined, w, h, x, y)
      }
    }
    refined = choked
    // Binary crisp edges for logos / QR
    for (let i = 0; i < n; i++) {
      refined[i] = refined[i] >= 140 ? 255 : 0
    }
  }

  return refined
}

/**
 * @param cutoutBlob - PNG from removeBackground (alpha + possibly fringed RGB)
 * @param originalBlob - original user image (preferred RGB source)
 */
export async function refineCutout(cutoutBlob: Blob, originalBlob?: Blob): Promise<Blob> {
  const cutout = await loadBlobToImageData(cutoutBlob)
  const { width: w, height: h } = cutout
  const cut = cutout.imageData.data
  const n = w * h

  const srcAlpha = new Uint8ClampedArray(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    srcAlpha[i] = cut[p + 3]
  }

  const mode = detectEdgeMode(srcAlpha)
  const alpha = refineAlpha(srcAlpha, w, h, mode)

  // Prefer original RGB — eliminates baked-in white/gray fringe from the model
  let rgb = cut
  if (originalBlob) {
    try {
      const orig = await loadBlobToImageData(originalBlob)
      if (orig.width === w && orig.height === h) {
        rgb = orig.imageData.data
      } else {
        // Model may rescale — sample original scaled to cutout size
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const cx = c.getContext('2d', { willReadFrequently: true })
        if (cx) {
          const tmp = document.createElement('canvas')
          tmp.width = orig.width
          tmp.height = orig.height
          const tx = tmp.getContext('2d')
          if (tx) {
            tx.putImageData(orig.imageData, 0, 0)
            cx.drawImage(tmp, 0, 0, w, h)
            rgb = cx.getImageData(0, 0, w, h).data
          }
        }
      }
    } catch {
      /* keep cutout RGB */
    }
  }

  const out = new ImageData(w, h)
  const d = out.data

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = alpha[i]
    if (a < 3) {
      d[p] = 0
      d[p + 1] = 0
      d[p + 2] = 0
      d[p + 3] = 0
      continue
    }

    // Straight (unassociated) alpha from original pixels
    d[p] = rgb[p]
    d[p + 1] = rgb[p + 1]
    d[p + 2] = rgb[p + 2]
    d[p + 3] = a
  }

  // Soft mode: light edge decontamination using local opaque average
  if (mode === 'soft') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = alpha[i]
        if (a === 0 || a === 255) continue
        const p = i * 4
        // Pull semi-transparent edge slightly toward nearby solid original color
        let r = 0
        let g = 0
        let b = 0
        let c = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            const j = yy * w + xx
            if (alpha[j] < 250) continue
            const q = j * 4
            r += rgb[q]
            g += rgb[q + 1]
            b += rgb[q + 2]
            c++
          }
        }
        if (c === 0) continue
        const t = (1 - a / 255) * 0.65
        d[p] = Math.round(d[p] * (1 - t) + (r / c) * t)
        d[p + 1] = Math.round(d[p + 1] * (1 - t) + (g / c) * t)
        d[p + 2] = Math.round(d[p + 2] * (1 - t) + (b / c) * t)
      }
    }
  }

  return imageDataToPngBlob(out)
}
