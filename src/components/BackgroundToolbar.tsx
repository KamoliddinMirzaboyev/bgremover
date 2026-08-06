import { useRef, type ChangeEvent } from 'react'
import { Check, Image as ImageIcon, Pipette, Square } from 'lucide-react'
import { COLOR_PRESETS, type BackgroundState } from '../types'

interface Props {
  background: BackgroundState
  onChange: (next: BackgroundState) => void
}

export function BackgroundToolbar({ background, onChange }: Props) {
  const bgInputRef = useRef<HTMLInputElement>(null)

  const setTransparent = () =>
    onChange({ ...background, mode: 'transparent', imageUrl: background.imageUrl })

  const setColor = (color: string) => onChange({ mode: 'color', color, imageUrl: background.imageUrl })

  const onBgImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (background.imageUrl) URL.revokeObjectURL(background.imageUrl)
    const url = URL.createObjectURL(file)
    onChange({ mode: 'image', color: background.color, imageUrl: url })
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Fon sozlamalari</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={setTransparent}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            background.mode === 'transparent'
              ? 'border-zinc-400 bg-zinc-800 text-zinc-50'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
          ].join(' ')}
        >
          <Square className="h-3.5 w-3.5" />
          Shaffof
          {background.mode === 'transparent' && <Check className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => bgInputRef.current?.click()}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            background.mode === 'image'
              ? 'border-zinc-400 bg-zinc-800 text-zinc-50'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
          ].join(' ')}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Fon rasmi
          {background.mode === 'image' && <Check className="h-3.5 w-3.5" />}
        </button>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onBgImage}
        />
      </div>

      <div>
        <p className="mb-2 text-xs text-zinc-500">Ranglar</p>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map((c) => {
            const active = background.mode === 'color' && background.color.toUpperCase() === c.value.toUpperCase()
            return (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => setColor(c.value)}
                className={[
                  'h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105',
                  active ? 'border-zinc-100 ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-950' : 'border-zinc-700',
                ].join(' ')}
                style={{ backgroundColor: c.value }}
                aria-label={c.name}
              />
            )
          })}
          <label
            className={[
              'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-600 bg-zinc-900 hover:border-zinc-400 transition-colors',
              background.mode === 'color' &&
              !COLOR_PRESETS.some((p) => p.value.toUpperCase() === background.color.toUpperCase())
                ? 'ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-950'
                : '',
            ].join(' ')}
            title="Maxsus rang"
          >
            <Pipette className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="color"
              value={background.color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Maxsus rang"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
