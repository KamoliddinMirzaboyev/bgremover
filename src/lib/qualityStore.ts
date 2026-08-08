import type { QualityMode } from '../types'

const KEY = 'bg-remover-quality'

export function loadQualityMode(): QualityMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'fast' || v === 'quality') return v
  } catch {
    /* private mode */
  }
  return 'fast'
}

export function saveQualityMode(mode: QualityMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
}
