import { useCallback, useEffect, useRef, useState } from 'react'
import { preload, removeBackground } from '@imgly/background-removal'
import { createBgConfig } from '../lib/bgConfig'
import { prepareForInference } from '../lib/imagePrep'
import { ProgressController, yieldToMain } from '../lib/progress'
import { refineCutout } from '../lib/refineMatte'
import type { ProcessProgress } from '../types'

interface Result {
  originalUrl: string
  resultUrl: string
  fileName: string
}

let preloadPromise: Promise<void> | null = null

function ensurePreloaded(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = preload(createBgConfig()).catch((err) => {
      preloadPromise = null
      throw err
    })
  }
  return preloadPromise
}

export function useBackgroundRemoval() {
  const [progress, setProgress] = useState<ProcessProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlsRef = useRef<string[]>([])
  const busyRef = useRef(false)
  const jobIdRef = useRef(0)
  const trackerRef = useRef<ProgressController | null>(null)

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

  useEffect(() => {
    void ensurePreloaded().catch(() => {
      /* process path retries */
    })
  }, [])

  const disposeTracker = () => {
    trackerRef.current?.dispose()
    trackerRef.current = null
  }

  const cancel = useCallback(() => {
    jobIdRef.current += 1
    busyRef.current = false
    disposeTracker()
    setProgress(null)
  }, [])

  const processFile = useCallback(async (file: File): Promise<Result | null> => {
    if (busyRef.current) return null
    busyRef.current = true
    const jobId = ++jobIdRef.current
    setError(null)
    disposeTracker()

    const tracker = new ProgressController(
      (p) => {
        if (jobId !== jobIdRef.current) return
        setProgress(p)
      },
      () => jobId === jobIdRef.current,
    )
    trackerRef.current = tracker
    tracker.setStage('prep', 0, 'Rasm tayyorlanmoqda...')

    const originalUrl = trackUrl(URL.createObjectURL(file))

    const dropOriginal = () => {
      URL.revokeObjectURL(originalUrl)
      urlsRef.current = urlsRef.current.filter((u) => u !== originalUrl)
    }

    try {
      await yieldToMain()

      tracker.setStage('prep', 0.2, 'Rasm tayyorlanmoqda...')
      const prepP = prepareForInference(file)
      const warmP = ensurePreloaded().catch(() => undefined)

      // Soft progress while download/preload may still be running
      tracker.startNudge('fetch', 'AI model yuklanmoqda...')

      const [prepared] = await Promise.all([prepP, warmP])
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }

      tracker.stopNudge()
      tracker.setStage('fetch', 1, 'Model tayyor')
      await yieldToMain()

      const config = createBgConfig((key, current, total) => {
        tracker.fromLibrary(key, current, total)
      })

      tracker.startNudge('compute', 'Subyekt aniqlanmoqda...')
      await yieldToMain()

      const rawBlob = await removeBackground(prepared, config)
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }

      tracker.stopNudge()
      tracker.setStage('compute', 1, 'Segmentatsiya tayyor')
      await yieldToMain()

      tracker.startNudge('refine', 'Chetlarni tozalanmoqda...')
      // Two frames: paint progress before heavy canvas work
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await yieldToMain()

      const blob = await refineCutout(rawBlob, prepared)
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }

      tracker.stopNudge()
      tracker.finish()
      await yieldToMain()

      const resultUrl = trackUrl(URL.createObjectURL(blob))
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'

      return {
        originalUrl,
        resultUrl,
        fileName: base,
      }
    } catch (e) {
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }
      dropOriginal()
      const message =
        e instanceof Error
          ? e.message.includes('memory') || e.message.includes('Memory')
            ? 'Qurilmada xotira yetarli emas. Kichikroq rasm sinab ko‘ring.'
            : e.message.startsWith('Subyekt') || e.message.startsWith('Xatolik')
              ? e.message
              : e.message.length < 160
                ? e.message
                : 'Fon olib tashlashda xatolik yuz berdi. Qayta urinib ko‘ring.'
          : 'Fon olib tashlashda xatolik yuz berdi. Qayta urinib ko‘ring.'
      setError(message)
      setProgress(null)
      return null
    } finally {
      if (jobId === jobIdRef.current) {
        busyRef.current = false
        disposeTracker()
      }
    }
  }, [])

  const processFromUrl = useCallback(
    async (url: string, name: string): Promise<Result | null> => {
      if (busyRef.current) return null
      setError(null)

      // Lightweight fetch progress without resetting later peak badly
      setProgress({
        key: 'fetch',
        current: 2,
        total: 100,
        percent: 2,
        label: 'Namuna yuklanmoqda...',
      })

      try {
        void ensurePreloaded().catch(() => undefined)
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
    cancel()
    revokeAll()
    setError(null)
  }, [cancel, revokeAll])

  return {
    progress,
    error,
    setError,
    processFile,
    processFromUrl,
    reset,
    cancel,
  }
}
