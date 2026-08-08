import { getDeviceProfile, scaleEdge } from './deviceProfile'
import { QUALITY_PRESETS, type QualityMode } from '../types'

export interface PreparedImage {
  inference: Blob
  exportSource: Blob
  exportWidth: number
  exportHeight: number
  inferenceWidth: number
  inferenceHeight: number
  /** Effective caps after device adapt */
  caps: { inference: number; export: number }
}

/**
 * Prepare inference-sized + export-sized images.
 * Caps are quality preset × device profile (phones get smaller AI input).
 */
export async function prepareForInference(
  file: File,
  quality: QualityMode = 'fast',
): Promise<PreparedImage> {
  const preset = QUALITY_PRESETS[quality]
  const device = getDeviceProfile()
  const maxInference = scaleEdge(preset.maxInferenceEdge, device.inferenceScale, 640, 2560)
  const maxExport = scaleEdge(preset.maxExportEdge, device.exportScale, 1280, 4096)

  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const edge = Math.max(width, height)

    let exportW = width
    let exportH = height
    let exportSource: Blob = file
    if (edge > maxExport) {
      const scale = maxExport / edge
      exportW = Math.max(1, Math.round(width * scale))
      exportH = Math.max(1, Math.round(height * scale))
      exportSource = await bitmapToJpeg(bitmap, exportW, exportH, 0.95)
    }

    const infEdge = Math.max(exportW, exportH)
    if (infEdge <= maxInference) {
      const inference =
        exportSource === file && edge <= maxInference
          ? file
          : await bitmapToJpeg(bitmap, exportW, exportH, 0.92)
      return {
        inference,
        exportSource,
        exportWidth: exportW,
        exportHeight: exportH,
        inferenceWidth: exportW,
        inferenceHeight: exportH,
        caps: { inference: maxInference, export: maxExport },
      }
    }

    const scale = maxInference / infEdge
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
      caps: { inference: maxInference, export: maxExport },
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
