import type { ProcessProgress } from '../types'

interface Props {
  progress: ProcessProgress | null
  previewUrl?: string | null
}

export function Processing({ progress, previewUrl }: Props) {
  const percent = progress?.percent ?? 0
  const label = progress?.label ?? 'Tayyorlanmoqda...'
  // Pastki qismda “fon erib ketayotgan” hissi
  const dissolve = Math.min(72, Math.max(12, percent * 0.75))

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-6 sm:py-10">
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-zinc-50 sm:text-xl">
          Rasmingiz ustida ishlanmoqda
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400 min-h-[1.25rem]">{label}</p>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="relative mx-auto flex min-h-[280px] max-h-[min(68vh,620px)] w-full items-center justify-center sm:min-h-[380px]">
          {previewUrl ? (
            <>
              {/* Checker underlay — visible where image dissolves */}
              <div className="bg-checker absolute inset-0" aria-hidden />

              {/* Full original image */}
              <img
                src={previewUrl}
                alt="Qayta ishlanayotgan rasm"
                className="relative z-[1] max-h-[min(68vh,620px)] w-full object-contain select-none"
                draggable={false}
                style={{
                  WebkitMaskImage: `linear-gradient(to top, transparent 0%, black ${dissolve}%, black 100%)`,
                  maskImage: `linear-gradient(to top, transparent 0%, black ${dissolve}%, black 100%)`,
                }}
              />

              {/* Soft top vignette */}
              <div
                className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,10,11,0.45)_100%)]"
                aria-hidden
              />

              {/* Scanning beam */}
              <div className="proc-scan pointer-events-none absolute inset-x-0 z-[3] h-28" aria-hidden>
                <div className="h-full w-full bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.04)_35%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0.04)_65%,transparent)]" />
                <div className="absolute left-[8%] right-[8%] top-1/2 h-px bg-white/80 shadow-[0_0_14px_3px_rgba(255,255,255,0.35)]" />
              </div>

              {/* Detection corners */}
              <div className="pointer-events-none absolute inset-3 z-[4] sm:inset-5" aria-hidden>
                <span className="proc-corner absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-white/55 rounded-tl" />
                <span className="proc-corner absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-white/55 rounded-tr" />
                <span className="proc-corner absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-white/55 rounded-bl" />
                <span className="proc-corner absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-white/55 rounded-br" />
              </div>

              {/* Live status pill */}
              <div className="absolute bottom-4 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-zinc-700/90 bg-zinc-950/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-xs font-medium text-zinc-100 whitespace-nowrap">
                  AI tahlil qilmoqda
                </span>
                <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] tabular-nums font-medium text-zinc-300">
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
              className="h-full rounded-full bg-zinc-100 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(4, percent)}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-zinc-600">
        Birinchi marta AI model yuklanishi biroz vaqt olishi mumkin. Keyingi rasmlar tezroq.
        Qurilma sekin bo‘lsa ham kuting — hammasi brauzeringizda bajariladi.
      </p>
    </section>
  )
}
