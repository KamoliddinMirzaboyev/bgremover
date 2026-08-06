import { useCallback, useState } from 'react'
import { Header } from './components/Header'
import { Dropzone } from './components/Dropzone'
import { Processing } from './components/Processing'
import { Studio } from './components/Studio'
import { ErrorToast } from './components/ErrorToast'
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
  const { progress, error, setError, processFile, processFromUrl, reset } = useBackgroundRemoval()

  const runProcess = useCallback(
    async (file: File) => {
      const validation = validateImageFile(file)
      if (validation) {
        setError(validation)
        return
      }
      const preview = URL.createObjectURL(file)
      setPreviewUrl(preview)
      setStep('processing')
      const result = await processFile(file)
      URL.revokeObjectURL(preview)
      setPreviewUrl(null)
      if (result) {
        setStudio(result)
        setStep('studio')
      } else {
        setStep('upload')
      }
    },
    [processFile, setError],
  )

  const runSample = useCallback(
    async (url: string, name: string) => {
      setPreviewUrl(url)
      setStep('processing')
      const result = await processFromUrl(url, name)
      setPreviewUrl(null)
      if (result) {
        setStudio(result)
        setStep('studio')
      } else {
        setStep('upload')
      }
    },
    [processFromUrl],
  )

  const handleReset = () => {
    reset()
    setStudio(null)
    setPreviewUrl(null)
    setStep('upload')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex flex-1 flex-col py-8 sm:py-12">
        {step === 'upload' && (
          <Dropzone onFile={runProcess} onSample={runSample} />
        )}
        {step === 'processing' && (
          <Processing progress={progress} previewUrl={previewUrl} />
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

      <footer className="border-t border-zinc-900 py-4 text-center text-[11px] text-zinc-600">
        BG Remover · @imgly/background-removal · barcha ishlov berish brauzerda
      </footer>

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    </div>
  )
}
