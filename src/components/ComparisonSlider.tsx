import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

interface Props {
  originalUrl: string
  resultUrl: string
  backgroundStyle: CSSProperties
  zoom: number
}

export function ComparisonSlider({ originalUrl, resultUrl, backgroundStyle, zoom }: Props) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.min(100, Math.max(0, x)))
  }, [])

  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }

  const onPointerUp = (e: PointerEvent) => {
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-[4/3] w-full max-h-[min(70vh,560px)] overflow-hidden rounded-xl border border-zinc-800 select-none touch-none"
      style={backgroundStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Result (full) */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <img
          src={resultUrl}
          alt="Fon olib tashlangan"
          draggable={false}
          className="max-h-full max-w-full object-contain pointer-events-none"
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease' }}
        />
      </div>

      {/* Original (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <img
            src={originalUrl}
            alt="Asl rasm"
            draggable={false}
            className="max-h-full max-w-full object-contain pointer-events-none"
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-zinc-900 shadow-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
            <path d="M5 4L2 8L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4L14 8L11 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <span className="absolute left-3 top-3 rounded bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
        Oldin
      </span>
      <span className="absolute right-3 top-3 rounded bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
        Keyin
      </span>
    </div>
  )
}
