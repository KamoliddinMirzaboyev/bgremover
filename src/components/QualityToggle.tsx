import { Gauge, Sparkles } from 'lucide-react'
import { QUALITY_PRESETS, type QualityMode } from '../types'

interface Props {
  value: QualityMode
  onChange: (mode: QualityMode) => void
  disabled?: boolean
}

export function QualityToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="mx-auto mb-6 w-full max-w-md">
      <p className="mb-2 text-center text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
        Sifat rejimi
      </p>
      <div
        className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1.5"
        role="radiogroup"
        aria-label="Sifat rejimi"
      >
        {(['fast', 'quality'] as const).map((id) => {
          const p = QUALITY_PRESETS[id]
          const active = value === id
          const Icon = id === 'fast' ? Gauge : Sparkles
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={[
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-2.5 text-center transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200',
                disabled ? 'pointer-events-none opacity-50' : '',
              ].join(' ')}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </span>
              <span
                className={[
                  'text-[10px] leading-tight',
                  active ? 'text-zinc-600' : 'text-zinc-600',
                ].join(' ')}
              >
                {p.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
