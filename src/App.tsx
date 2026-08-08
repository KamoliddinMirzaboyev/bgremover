import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import { Dropzone } from './components/Dropzone'
import { Processing } from './components/Processing'
import { Studio } from './components/Studio'
import { ErrorToast } from './components/ErrorToast'
import { SeoContent } from './components/SeoContent'
import { Footer } from './components/Footer'
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval'
import { validateImageFile } from './lib/canvas'
import type { AppStep } from './types'

interface StudioData {
  originalUrl: string
  resultUrl: string
  fileName: string
}

export default function App() {
  const [step, setStep] = useState<AppStep>('upload')
  const [studio, setStudio] = useState<StudioData | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<{ url: string; owned: boolean } | null>(null)

  const {
    progress,
    error,
    setError,
    processFile,
    processFromUrl,
    reset,
    cancel,
  } = useBackgroundRemoval()

  const clearPreview = useCallback(() => {
    const cur = previewRef.current
    if (cur?.owned && cur.url.startsWith('blob:')) {
      URL.revokeObjectURL(cur.url)
    }
    previewRef.current = null
    setPreviewUrl(null)
  }, [])

  const runProcess = useCallback(
    async (file: File) => {
      const validation = validateImageFile(file)
      if (validation) {
        setError(validation)
        return
      }
      clearPreview()
      const preview = URL.createObjectURL(file)
      previewRef.current = { url: preview, owned: true }
      setPreviewUrl(preview)
      setStep('processing')

      const result = await processFile(file)
      clearPreview()

      if (result) {
        setStudio(result)
        setStep('studio')
      } else {
        setStep('upload')
      }
    },
    [processFile, setError, clearPreview],
  )

  const runSample = useCallback(
    async (url: string, name: string) => {
      clearPreview()
      previewRef.current = { url, owned: false }
      setPreviewUrl(url)
      setStep('processing')

      const result = await processFromUrl(url, name)
      clearPreview()

      if (result) {
        setStudio(result)
        setStep('studio')
      } else {
        setStep('upload')
      }
    },
    [processFromUrl, clearPreview],
  )

  const handleCancel = useCallback(() => {
    cancel()
    clearPreview()
    setStudio(null)
    setStep('upload')
  }, [cancel, clearPreview])

  const handleReset = useCallback(() => {
    reset()
    clearPreview()
    setStudio(null)
    setStep('upload')
  }, [reset, clearPreview])

  useEffect(() => {
    if (step !== 'upload') return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void runProcess(file)
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [step, runProcess])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex flex-1 flex-col py-8 sm:py-12">
        {step === 'upload' && (
          <>
            <Dropzone onFile={runProcess} onSample={runSample} />
            <SeoContent />
          </>
        )}
        {step === 'processing' && (
          <Processing progress={progress} previewUrl={previewUrl} onCancel={handleCancel} />
        )}
        {step === 'studio' && studio && (
          <Studio
            originalUrl={studio.originalUrl}
            resultUrl={studio.resultUrl}
            fileName={studio.fileName}
            onReset={handleReset}
            onError={setError}
          />
        )}
      </main>

      {step === 'upload' ? (
        <Footer />
      ) : (
        <footer className="border-t border-zinc-900 py-4 text-center text-[11px] text-zinc-600">
          BG Remover · 100% brauzerda · free background remover
        </footer>
      )}

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    </div>
  )
}
