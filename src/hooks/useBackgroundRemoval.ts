import { useCallback, useEffect, useRef, useState } from 'react'
import { preload, removeBackground } from '@imgly/background-removal'
import { createBgConfig } from '../lib/bgConfig'
import { prepareForInference } from '../lib/imagePrep'
import { ProgressController, yieldToMain } from '../lib/progress'
import { loadQualityMode, saveQualityMode } from '../lib/qualityStore'
import { refineCutout, type EdgeMode } from '../lib/refineMatte'
import { trySolidBackgroundCutout } from '../lib/solidBgMatte'
import type { ProcessProgress, QualityMode } from '../types'

interface Result {
  originalUrl: string
  resultUrl: string
  fileName: string
  quality: QualityMode
  width: number
  height: number
  /** hard = QR/logo — UI should default feather to 0 */
  edgeMode: EdgeMode
}

const preloadCache = new Map<QualityMode, Promise<void>>()

function ensurePreloaded(quality: QualityMode): Promise<void> {
  let p = preloadCache.get(quality)
  if (!p) {
    p = preload(createBgConfig(quality)).catch((err) => {
      preloadCache.delete(quality)
      throw err
    })
    preloadCache.set(quality, p)
  }
  return p
}

export function useBackgroundRemoval() {
  const [progress, setProgress] = useState<ProcessProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQualityState] = useState<QualityMode>(() => loadQualityMode())
  const qualityRef = useRef(quality)
  qualityRef.current = quality

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

  // Warm default + current quality model ASAP
  useEffect(() => {
    void ensurePreloaded(quality).catch(() => {
      /* process retries */
    })
  }, [quality])

  const setQuality = useCallback((mode: QualityMode) => {
    setQualityState(mode)
    saveQualityMode(mode)
    void ensurePreloaded(mode).catch(() => undefined)
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
    const mode = qualityRef.current
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

      tracker.setStage('prep', 0.15, 'Rasm tayyorlanmoqda...')
      const prepP = prepareForInference(file, mode)
      const warmP = ensurePreloaded(mode).catch(() => undefined)

      tracker.startNudge(
        'fetch',
        mode === 'quality' ? 'Yuqori sifat modeli yuklanmoqda...' : 'AI model yuklanmoqda...',
      )

      const [prepared] = await Promise.all([prepP, warmP])
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }

      tracker.stopNudge()
      tracker.setStage('fetch', 1, 'Tayyorlanmoqda...')
      await yieldToMain()

      // 1) Flat-background path (QR/logo) — much cleaner than AI for solid BG
      tracker.setStage('compute', 0.15, 'Tekis fon tekshirilmoqda...')
      await yieldToMain()
      const solid = await trySolidBackgroundCutout(
        prepared.exportSource,
        prepared.exportWidth,
        prepared.exportHeight,
      )
      if (jobId !== jobIdRef.current) {
        dropOriginal()
        return null
      }

      let resultBlob: Blob
      let edgeMode: EdgeMode

      if (solid && solid.confidence >= 0.42) {
        tracker.setStage('compute', 0.9, 'Grafika fon olib tashlandi...')
        await yieldToMain()
        resultBlob = solid.blob
        edgeMode = 'hard'
      } else {
        // 2) AI fallback for photos / complex backgrounds
        const config = createBgConfig(mode, (key, current, total) => {
          tracker.fromLibrary(key, current, total)
        })

        tracker.startNudge(
          'compute',
          mode === 'quality' ? 'Yuqori sifatda aniqlanmoqda...' : 'Subyekt aniqlanmoqda...',
        )
        await yieldToMain()

        // Ensure model warm if we skipped wait earlier
        await ensurePreloaded(mode).catch(() => undefined)
        if (jobId !== jobIdRef.current) {
          dropOriginal()
          return null
        }

        const rawBlob = await removeBackground(prepared.inference, config)
        if (jobId !== jobIdRef.current) {
          dropOriginal()
          return null
        }

        tracker.stopNudge()
        tracker.setStage('compute', 1, 'Segmentatsiya tayyor')
        await yieldToMain()

        tracker.startNudge('refine', 'Chetlar + HD export...')
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        )
        await yieldToMain()

        const refined = await refineCutout(rawBlob, {
          exportSource: prepared.exportSource,
          exportWidth: prepared.exportWidth,
          exportHeight: prepared.exportHeight,
        })
        if (jobId !== jobIdRef.current) {
          dropOriginal()
          return null
        }
        tracker.stopNudge()
        resultBlob = refined.blob
        edgeMode = refined.edgeMode
      }

      tracker.finish()
      await yieldToMain()

      const resultUrl = trackUrl(URL.createObjectURL(resultBlob))
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'

      return {
        originalUrl,
        resultUrl,
        fileName: base,
        quality: mode,
        width: prepared.exportWidth,
        height: prepared.exportHeight,
        edgeMode,
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
            ? 'Qurilmada xotira yetarli emas. «Tez» rejimini yoki kichikroq rasm sinab ko‘ring.'
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

      setProgress({
        key: 'fetch',
        current: 2,
        total: 100,
        percent: 2,
        label: 'Namuna yuklanmoqda...',
      })

      try {
        void ensurePreloaded(qualityRef.current).catch(() => undefined)
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
    quality,
    setQuality,
    processFile,
    processFromUrl,
    reset,
    cancel,
  }
}
