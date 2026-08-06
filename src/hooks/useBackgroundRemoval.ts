import { useCallback, useRef, useState } from 'react'
import { removeBackground } from '@imgly/background-removal'
import type { Config } from '@imgly/background-removal'
import { progressLabel } from '../lib/canvas'
import type { ProcessProgress } from '../types'

interface Result {
  originalUrl: string
  resultUrl: string
  fileName: string
}

export function useBackgroundRemoval() {
  const [progress, setProgress] = useState<ProcessProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)
  const urlsRef = useRef<string[]>([])

  const trackUrl = (url: string) => {
    urlsRef.current.push(url)
    return url
  }

  const revokeAll = useCallback(() => {
    for (const u of urlsRef.current) {
      URL.revokeObjectURL(u)
    }
    urlsRef.current = []
  }, [])

  const processFile = useCallback(async (file: File): Promise<Result | null> => {
    abortRef.current = false
    setError(null)
    setProgress({
      key: 'start',
      current: 0,
      total: 1,
      percent: 0,
      label: 'AI model yuklanmoqda...',
    })

    const originalUrl = trackUrl(URL.createObjectURL(file))

    try {
      const config: Config = {
        model: 'isnet_fp16',
        output: {
          format: 'image/png',
          quality: 1,
        },
        progress: (key, current, total) => {
          if (abortRef.current) return
          const percent = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0
          setProgress({
            key,
            current,
            total,
            percent,
            label: progressLabel(key),
          })
        },
      }

      setProgress((p) =>
        p
          ? { ...p, label: 'Subyekt aniqlanmoqda...', percent: Math.max(p.percent, 10) }
          : null,
      )

      const blob = await removeBackground(file, config)

      if (abortRef.current) {
        URL.revokeObjectURL(originalUrl)
        return null
      }

      setProgress({
        key: 'done',
        current: 1,
        total: 1,
        percent: 100,
        label: 'Tayyor!',
      })

      const resultUrl = trackUrl(URL.createObjectURL(blob))
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'

      return {
        originalUrl,
        resultUrl,
        fileName: base,
      }
    } catch (e) {
      URL.revokeObjectURL(originalUrl)
      const message =
        e instanceof Error
          ? e.message.includes('memory') || e.message.includes('Memory')
            ? 'Qurilmada xotira yetarli emas. Kichikroq rasm sinab ko‘ring.'
            : `Xatolik: ${e.message}`
          : 'Fon olib tashlashda xatolik yuz berdi. Qayta urinib ko‘ring.'
      setError(message)
      setProgress(null)
      return null
    }
  }, [])

  const processFromUrl = useCallback(
    async (url: string, name: string): Promise<Result | null> => {
      setError(null)
      setProgress({
        key: 'fetch',
        current: 0,
        total: 1,
        percent: 2,
        label: 'Namuna yuklanmoqda...',
      })
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Namuna rasm yuklanmadi')
        const blob = await res.blob()
        const file = new File([blob], name, { type: blob.type || 'image/jpeg' })
        return processFile(file)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Namuna yuklanmadi')
        setProgress(null)
        return null
      }
    },
    [processFile],
  )

  const reset = useCallback(() => {
    abortRef.current = true
    revokeAll()
    setProgress(null)
    setError(null)
  }, [revokeAll])

  return {
    progress,
    error,
    setError,
    processFile,
    processFromUrl,
    reset,
  }
}
