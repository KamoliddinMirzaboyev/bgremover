import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { ACCEPTED_EXTENSIONS } from '../types'

const SAMPLES = [
  { src: '/samples/person1.jpg', name: 'person1.jpg', label: 'Namuna 1' },
  { src: '/samples/person2.jpg', name: 'person2.jpg', label: 'Namuna 2' },
  { src: '/samples/person3.jpg', name: 'person3.jpg', label: 'Namuna 3' },
] as const

interface Props {
  onFile: (file: File) => void
  onSample: (url: string, name: string) => void
  disabled?: boolean
}

export function Dropzone({ onFile, onSample, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled) return
      onFile(files[0])
    },
    [onFile, disabled],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
          Fonni bir zumda olib tashlang
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
          Rasmingiz faqat brauzeringizda qayta ishlanadi. Serverga yuborilmaydi, maxfiylik saqlanadi.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 sm:py-16 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-500',
          dragging
            ? 'border-zinc-400 bg-zinc-900'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900',
          disabled ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950">
          <Upload className="h-6 w-6 text-zinc-300" />
        </div>
        <p className="text-base font-medium text-zinc-100">Rasmni bu yerga tashlang</p>
        <p className="mt-1 text-sm text-zinc-500">yoki tanlash uchun bosing</p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
        >
          <ImagePlus className="h-4 w-4" />
          Rasm yuklash
        </button>
        <p className="mt-4 text-xs text-zinc-600">PNG, JPG, JPEG, WEBP · max 12 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={onChange}
          disabled={disabled}
        />
      </div>

      <div className="mt-8">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
          Yoki namuna bilan sinab ko‘ring
        </p>
        <div className="grid grid-cols-3 gap-3">
          {SAMPLES.map((s) => (
            <button
              key={s.src}
              type="button"
              disabled={disabled}
              onClick={() => onSample(s.src, s.name)}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50"
            >
              <img
                src={s.src}
                alt={s.label}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute inset-x-0 bottom-0 bg-zinc-950/80 py-1.5 text-center text-[11px] font-medium text-zinc-300">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
