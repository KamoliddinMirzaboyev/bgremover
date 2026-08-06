import { Eraser } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
            <Eraser className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-zinc-50">BG Remover</p>
            <p className="text-[11px] text-zinc-500 hidden sm:block">Brauzerda ishlaydi · server yo‘q</p>
          </div>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
          100% client-side
        </span>
      </div>
    </header>
  )
}
