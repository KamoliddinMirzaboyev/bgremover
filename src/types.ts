export type AppStep = 'upload' | 'processing' | 'studio'

export type BackgroundMode = 'transparent' | 'color' | 'image'

/** Fast = quint8 + smaller AI input; quality = fp16 + larger AI + full-res export */
export type QualityMode = 'fast' | 'quality'

export interface BackgroundState {
  mode: BackgroundMode
  color: string
  imageUrl: string | null
}

export interface ProcessProgress {
  key: string
  current: number
  total: number
  percent: number
  label: string
}

export const MAX_FILE_SIZE_MB = 12
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const
export const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.webp'

export const COLOR_PRESETS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Light Gray', value: '#E5E7EB' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Red', value: '#DC2626' },
] as const

export const QUALITY_PRESETS = {
  fast: {
    id: 'fast' as const,
    label: 'Tez',
    labelEn: 'Fast',
    hint: 'Tezroq · yaxshi sifat',
    model: 'isnet_quint8' as const,
    maxInferenceEdge: 1280,
    maxExportEdge: 2560,
  },
  quality: {
    id: 'quality' as const,
    label: 'Yuqori sifat',
    labelEn: 'High quality',
    hint: 'Sekinroq · eng yaxshi chetlar',
    model: 'isnet_fp16' as const,
    maxInferenceEdge: 2048,
    maxExportEdge: 4096,
  },
} as const
