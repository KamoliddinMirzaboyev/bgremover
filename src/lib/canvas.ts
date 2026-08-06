import type { BackgroundState } from '../types'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Rasm yuklanmadi'))
    img.src = src
  })
}

/** Composite subject over selected background at original resolution */
export async function composeImage(
  subjectUrl: string,
  background: BackgroundState,
): Promise<HTMLCanvasElement> {
  const subject = await loadImage(subjectUrl)
  const canvas = document.createElement('canvas')
  canvas.width = subject.naturalWidth
  canvas.height = subject.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas qo‘llab-quvvatlanmaydi')

  if (background.mode === 'color') {
    ctx.fillStyle = background.color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  } else if (background.mode === 'image' && background.imageUrl) {
    const bg = await loadImage(background.imageUrl)
    // Cover fit
    const scale = Math.max(canvas.width / bg.naturalWidth, canvas.height / bg.naturalHeight)
    const w = bg.naturalWidth * scale
    const h = bg.naturalHeight * scale
    const x = (canvas.width - w) / 2
    const y = (canvas.height - h) / 2
    ctx.drawImage(bg, x, y, w, h)
  }
  // transparent: leave clear

  ctx.drawImage(subject, 0, 0)
  return canvas
}

export async function downloadComposed(
  subjectUrl: string,
  background: BackgroundState,
  filenameBase = 'bg-removed',
): Promise<void> {
  const canvas = await composeImage(subjectUrl, background)
  const isTransparent = background.mode === 'transparent'
  const mime = isTransparent ? 'image/png' : 'image/jpeg'
  const ext = isTransparent ? 'png' : 'jpg'
  const quality = isTransparent ? undefined : 0.95

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Yuklab olish muvaffaqiyatsiz'))),
      mime,
      quality,
    )
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function validateImageFile(file: File): string | null {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  const name = file.name.toLowerCase()
  const extOk = ['.png', '.jpg', '.jpeg', '.webp'].some((e) => name.endsWith(e))
  if (!allowed.includes(file.type) && !extOk) {
    return 'Faqat PNG, JPG, JPEG yoki WEBP formatlarini yuklang.'
  }
  const max = 12 * 1024 * 1024
  if (file.size > max) {
    return `Rasm juda katta. Maksimal hajm: 12 MB (hozirgi: ${(file.size / 1024 / 1024).toFixed(1)} MB).`
  }
  return null
}

export function progressLabel(key: string): string {
  const k = key.toLowerCase()
  if (k.includes('fetch') || k.includes('download') || k.includes('wasm') || k.includes('model') || k.includes('onnx')) {
    return 'AI model yuklanmoqda...'
  }
  if (k.includes('session') || k.includes('init')) {
    return 'Model ishga tushirilmoqda...'
  }
  if (k.includes('compute') || k.includes('inference') || k.includes('process')) {
    return 'Subyekt aniqlanmoqda...'
  }
  return 'Fon olib tashlanmoqda...'
}
