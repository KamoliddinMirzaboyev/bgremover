import { QUALITY_PRESETS, type QualityMode } from '../types'

export interface PreparedImage {
  /** Downscaled blob for AI inference */
  inference: Blob
  /** Source for full-res composite (original or export-capped) */
  exportSource: Blob
  exportWidth: number
  exportHeight: number
  inferenceWidth: number
  inferenceHeight: number
}

/**
 * Prepare inference-sized + export-sized images.
 * Inference is small/fast; export keeps near-original resolution for sharp PNG.
 */
export async function prepareForInference(
  file: File,
  quality: QualityMode = 'fast',
): Promise<PreparedImage> {
  const preset = QUALITY_PRESETS[quality]
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const edge = Math.max(width, height)

    // Export size (cap huge photos to avoid OOM)
    let exportW = width
    let exportH = height
    let exportSource: Blob = file
    if (edge > preset.maxExportEdge) {
      const scale = preset.maxExportEdge / edge
      exportW = Math.max(1, Math.round(width * scale))
      exportH = Math.max(1, Math.round(height * scale))
      exportSource = await bitmapToJpeg(bitmap, exportW, exportH, 0.95)
    }

    // Inference size
    const infEdge = Math.max(exportW, exportH)
    if (infEdge <= preset.maxInferenceEdge) {
      // Small enough: same blob for both (exportSource may still be original file)
      const inference =
        exportSource === file && edge <= preset.maxInferenceEdge
          ? file
          : await bitmapToJpeg(bitmap, exportW, exportH, 0.92)
      return {
        inference,
        exportSource,
        exportWidth: exportW,
        exportHeight: exportH,
        inferenceWidth: exportW,
        inferenceHeight: exportH,
      }
    }

    const scale = preset.maxInferenceEdge / infEdge
    const infW = Math.max(1, Math.round(exportW * scale))
    const infH = Math.max(1, Math.round(exportH * scale))
    const inference = await bitmapToJpeg(bitmap, infW, infH, 0.92)

    return {
      inference,
      exportSource,
      exportWidth: exportW,
      exportHeight: exportH,
      inferenceWidth: infW,
      inferenceHeight: infH,
    }
  } finally {
    bitmap.close()
  }
}

async function bitmapToJpeg(
  source: ImageBitmap,
  w: number,
  h: number,
  quality: number,
): Promise<Blob> {
  let draw: ImageBitmap = source
  let extra: ImageBitmap | null = null
  try {
    // Native resize when possible
    extra = await createImageBitmap(source, {
      resizeWidth: w,
      resizeHeight: h,
      resizeQuality: 'high',
    })
    draw = extra
  } catch {
    /* canvas path */
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Rasm tayyorlanmadi'))),
      'image/jpeg',
      quality,
    )
  })
}
