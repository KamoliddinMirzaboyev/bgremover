/**
 * Model asset base URL.
 * - Default: IMG.LY CDN
 * - Override: VITE_IMGLY_PUBLIC_PATH=/imgly/ or full CDN URL
 *
 * IMPORTANT: never touch bare `document` without a guard — Web Workers
 * may have `window` polyfilled but no `document` (throws ReferenceError).
 */

const PACKAGE_VERSION = '1.7.0'

export const DEFAULT_IMGLY_CDN =
  `https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/`

function hasDocument(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.document !== 'undefined'
}

export function resolvePublicPath(): string {
  const env = import.meta.env.VITE_IMGLY_PUBLIC_PATH as string | undefined
  if (env && env.trim()) {
    const t = env.trim()
    return t.endsWith('/') ? t : `${t}/`
  }

  if (hasDocument()) {
    try {
      const meta = globalThis.document.querySelector('meta[name="imgly-public-path"]')
      const content = meta?.getAttribute('content')
      if (content) {
        const t = content.trim()
        return t.endsWith('/') ? t : `${t}/`
      }
    } catch {
      /* worker / restricted */
    }
  }

  return DEFAULT_IMGLY_CDN
}

export function resourcesManifestUrl(publicPath?: string): string {
  const base = publicPath ?? resolvePublicPath()
  return new URL('resources.json', base).href
}
