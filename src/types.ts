export type AppStep = 'upload' | 'processing' | 'studio'

export type BackgroundMode = 'transparent' | 'color' | 'image'

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

export interface AppError {
  message: string
  id: number
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
