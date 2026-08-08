import { useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface Props {
  message: string
  onClose: () => void
  /** Auto-dismiss ms; 0 = never. Default 6000 */
  durationMs?: number
}

export function ErrorToast({ message, onClose, durationMs = 6000 }: Props) {
  useEffect(() => {
    if (!durationMs) return
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [message, durationMs, onClose])

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-[slideUp_0.25s_ease-out] sm:left-auto sm:right-6"
    >
      <div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-zinc-900 px-4 py-3 shadow-xl shadow-black/40">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <p className="flex-1 text-sm leading-snug text-zinc-200">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Yopish"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
