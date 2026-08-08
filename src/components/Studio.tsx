import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { ComparisonSlider } from './ComparisonSlider'
import { BackgroundToolbar } from './BackgroundToolbar'
import { downloadComposed } from '../lib/canvas'
import { featherCutout, featherLabel } from '../lib/alphaFeather'
import type { EdgeMode } from '../lib/refineMatte'
import { QUALITY_PRESETS, type BackgroundState, type QualityMode } from '../types'

interface Props {
  originalUrl: string
  resultUrl: string
  fileName: string
  quality: QualityMode
  width: number
  height: number
  edgeMode: EdgeMode
  onReset: () => void
  onError: (msg: string) => void
}

export function Studio({
  originalUrl,
  resultUrl,
  fileName,
  quality,
  width,
  height,
  edgeMode,
  onReset,
  onError,
}: Props) {
  const [background, setBackground] = useState<BackgroundState>({
    mode: 'transparent',
    color: '#FFFFFF',
    imageUrl: null,
  })
  const [zoom, setZoom] = useState(1)
  const [downloading, setDownloading] = useState(false)
  /** Default 0 — feather was making logos/QR look "chewed". User can raise for hair. */
  const [feather, setFeather] = useState(0)
  const [featheredUrl, setFeatheredUrl] = useState(resultUrl)
  const [featherBusy, setFeatherBusy] = useState(false)
  const featherBlobRef = useRef<string | null>(null)
  const featherGen = useRef(0)

  // Revoke custom bg blob on unmount / replace
  useEffect(() => {
    return () => {
      if (background.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(background.imageUrl)
      }
    }
  }, [background.imageUrl])

  // Debounced feather preview from base result
  useEffect(() => {
    const gen = ++featherGen.current
    let cancelled = false

    const run = async () => {
      if (feather < 1) {
        if (featherBlobRef.current) {
          URL.revokeObjectURL(featherBlobRef.current)
          featherBlobRef.current = null
        }
        setFeatheredUrl(resultUrl)
        setFeatherBusy(false)
        return
      }

      setFeatherBusy(true)
      try {
        const res = await fetch(resultUrl)
        const base = await res.blob()
        const out = await featherCutout(base, feather)
        if (cancelled || gen !== featherGen.current) return
        if (featherBlobRef.current) URL.revokeObjectURL(featherBlobRef.current)
        const url = URL.createObjectURL(out)
        featherBlobRef.current = url
        setFeatheredUrl(url)
      } catch {
        if (!cancelled) setFeatheredUrl(resultUrl)
      } finally {
        if (!cancelled && gen === featherGen.current) setFeatherBusy(false)
      }
    }

    const t = window.setTimeout(() => void run(), 180)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [resultUrl, feather])

  useEffect(() => {
    return () => {
      if (featherBlobRef.current) URL.revokeObjectURL(featherBlobRef.current)
    }
  }, [])

  const previewStyle = useMemo((): CSSProperties => {
    if (background.mode === 'color') {
      return { backgroundColor: background.color }
    }
    if (background.mode === 'image' && background.imageUrl) {
      return {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return {}
  }, [background])

  const containerClass =
    background.mode === 'transparent' ? 'bg-checker' : 'bg-zinc-900'

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadComposed(featheredUrl, background, `${fileName}-no-bg`)
    } catch {
      onError('Yuklab olish amalga oshmadi. Qayta urinib ko‘ring.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Studio</h2>
          <p className="text-sm text-zinc-500">
            Solishtiring, fonni sozlang va HD formatda yuklab oling
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300">
              {QUALITY_PRESETS[quality].label}
            </span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-400">
              {edgeMode === 'hard' ? 'Grafika / QR' : 'Foto'}
            </span>
            {width > 0 && height > 0 && (
              <span className="tabular-nums">
                {width}×{height} px · full-res
              </span>
            )}
            {featherBusy && <span className="text-zinc-600">Chet yangilanmoqda…</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            <RotateCcw className="h-4 w-4" />
            Boshqa rasm
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloading
              ? 'Tayyorlanmoqda...'
              : background.mode === 'transparent'
                ? 'PNG yuklab olish'
                : 'JPEG yuklab olish'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className={`${containerClass} rounded-xl`}>
            <ComparisonSlider
              originalUrl={originalUrl}
              resultUrl={featheredUrl}
              backgroundStyle={previewStyle}
              zoom={zoom}
              transparent={background.mode === 'transparent'}
            />
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              aria-label="Kichiklashtirish"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-zinc-500">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
              className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              aria-label="Kattalashtirish"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="ml-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Reset
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <BackgroundToolbar background={background} onChange={setBackground} />

          <div className="mt-6 border-t border-zinc-800 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-300">Chet yumshoqligi</p>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {featherLabel(feather)} · {feather}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              className="w-full"
              aria-label="Chet yumshoqligi"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              {edgeMode === 'hard'
                ? 'Grafika/logo — 0 da qoldiring. Yumshatish chetlarni buzadi.'
                : 'Default 0 (o‘tkir). Faqat soch/odam uchun 30–60 ga oshiring.'}
            </p>
          </div>

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-xs leading-relaxed text-zinc-500">
              Shaffof fon — PNG. Rang yoki rasm fon — JPEG. Full-res export.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
