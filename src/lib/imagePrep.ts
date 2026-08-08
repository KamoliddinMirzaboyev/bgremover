/**
 * Max long-edge for AI. Pixel count drives inference time.
 * 1280 ≈ 4× fewer pixels than 2560 → much faster, still sharp on screen.
 */
export const MAX_INFERENCE_EDGE = 1280

/**
 * Downscale for the model. Resized inputs become JPEG (faster encode).
 * Small files pass through unchanged.
 */
export async function prepareForInference(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const edge = Math.max(width, height)

    if (edge <= MAX_INFERENCE_EDGE) {
      return file
    }

    const scale = MAX_INFERENCE_EDGE / edge
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    let draw: ImageBitmap = bitmap
    let extra: ImageBitmap | null = null
    try {
      extra = await createImageBitmap(file, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high',
      })
      draw = extra
    } catch {
      /* canvas downscale fallback */
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')

    if (!extra) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
    }
    ctx.drawImage(draw, 0, 0, w, h)
    extra?.close()

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Rasm tayyorlanmadi'))),
        'image/jpeg',
        0.92,
      )
    })
    return blob
  } finally {
    bitmap.close()
  }
}
