import { Loader2 } from 'lucide-react'
import type { ProcessProgress } from '../types'

interface Props {
  progress: ProcessProgress | null
  previewUrl?: string | null
}

export function Processing({ progress, previewUrl }: Props) {
  const percent = progress?.percent ?? 0
  const label = progress?.label ?? 'Tayyorlanmoqda...'

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 sm:py-16">
      {previewUrl && (
        <div className="mb-8 h-40 w-40 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg opacity-80">
          <img src={previewUrl} alt="Yuklangan rasm" className="h-full w-full object-cover blur-[1px]" />
        </div>
      )}

      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-200" />
      </div>

      <h2 className="text-lg font-semibold text-zinc-50">Fon olib tashlanmoqda</h2>
      <p className="mt-1.5 text-sm text-zinc-400 text-center min-h-[1.25rem]">{label}</p>

      <div className="mt-6 w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-100 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs tabular-nums text-zinc-500">{percent}%</p>
      </div>

      <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-zinc-600">
        Birinchi marta AI model yuklanishi biroz vaqt olishi mumkin. Keyingi rasmlar tezroq ishlanadi.
        Qurilmangiz sekinroq bo‘lsa, kuting — barchasi brauzeringizda bajariladi.
      </p>
    </section>
  )
}
