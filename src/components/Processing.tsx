import { useEffect, useState } from 'react'
import type { ProcessProgress } from '../types'

interface Props {
  progress: ProcessProgress | null
  previewUrl?: string | null
  onCancel?: () => void
}

/**
 * Smooth displayed % — eases toward real value, never goes backwards.
 * Avoids jank from rapid React updates + CSS mask thrashing.
 */
function useSmoothPercent(target: number): number {
  const [shown, setShown] = useState(target)

  useEffect(() => {
    let raf = 0
    let current = shown

    const tick = () => {
      const goal = Math.max(current, target)
      const delta = goal - current
      if (delta < 0.15) {
        current = goal
        setShown(Math.round(current))
        return
      }
      // ease toward goal
      current += Math.max(0.35, delta * 0.18)
      setShown(Math.round(current))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when target rises
  }, [target])

  return Math.max(shown, 0)
}

export function Processing({ progress, previewUrl, onCancel }: Props) {
  const raw = progress?.percent ?? 0
  const percent = useSmoothPercent(raw)
  const label = progress?.label ?? 'Tayyorlanmoqda...'

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-6 sm:py-10">
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-zinc-50 sm:text-xl">
          Rasmingiz ustida ishlanmoqda
        </h2>
        <p className="mt-1.5 min-h-[1.25rem] text-sm text-zinc-400">{label}</p>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="relative mx-auto flex min-h-[280px] max-h-[min(68vh,620px)] w-full items-center justify-center sm:min-h-[380px]">
          {previewUrl ? (
            <>
              <div className="bg-checker absolute inset-0" aria-hidden />

              {/* Static image — no per-frame mask (was causing freezes) */}
              <img
                src={previewUrl}
                alt="Qayta ishlanayotgan rasm"
                className="relative z-[1] max-h-[min(68vh,620px)] w-full object-contain select-none"
                draggable={false}
              />

              {/* Soft vignette */}
              <div
                className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,10,11,0.5)_100%)]"
                aria-hidden
              />

              {/* Bottom dissolve overlay (CSS only, independent of % thrash) */}
              <div
                className="proc-dissolve pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[42%]"
                aria-hidden
              />

              {/* Scanning beam — pure CSS */}
              <div className="proc-scan pointer-events-none absolute inset-x-0 z-[3] h-28" aria-hidden>
                <div className="h-full w-full bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.04)_35%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0.04)_65%,transparent)]" />
                <div className="absolute left-[8%] right-[8%] top-1/2 h-px bg-white/80 shadow-[0_0_14px_3px_rgba(255,255,255,0.35)]" />
              </div>

              <div className="pointer-events-none absolute inset-3 z-[4] sm:inset-5" aria-hidden>
                <span className="proc-corner absolute left-0 top-0 h-8 w-8 rounded-tl border-l-2 border-t-2 border-white/55" />
                <span className="proc-corner absolute right-0 top-0 h-8 w-8 rounded-tr border-r-2 border-t-2 border-white/55" />
                <span className="proc-corner absolute bottom-0 left-0 h-8 w-8 rounded-bl border-b-2 border-l-2 border-white/55" />
                <span className="proc-corner absolute bottom-0 right-0 h-8 w-8 rounded-br border-b-2 border-r-2 border-white/55" />
              </div>

              <div className="absolute bottom-4 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-zinc-700/90 bg-zinc-950/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="whitespace-nowrap text-xs font-medium text-zinc-100">
                  AI tahlil qilmoqda
                </span>
                <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-300">
                  {percent}%
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-64 w-full items-center justify-center text-sm text-zinc-500">
              Rasm tayyorlanmoqda...
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800/80 bg-zinc-900/90 px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-xs text-zinc-400">{label}</p>
            <p className="shrink-0 text-xs font-medium tabular-nums text-zinc-300">{percent}%</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-100 will-change-transform"
              style={{
                width: `${Math.min(100, Math.max(2, percent))}%`,
                transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        >
          Bekor qilish
        </button>
      )}

      <p className="mt-4 max-w-md text-center text-xs leading-relaxed text-zinc-600">
        Birinchi marta AI model yuklanishi biroz vaqt olishi mumkin. Keyingi rasmlar tezroq. Hammasi
        brauzeringizda bajariladi.
      </p>
    </section>
  )
}
