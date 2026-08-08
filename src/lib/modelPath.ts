/**
 * Model asset base URL.
 * - Default: IMG.LY CDN (library default if undefined)
 * - Override: VITE_IMGLY_PUBLIC_PATH=https://your.cdn/imgly/ or /imgly/
 * - Optional same-origin mirror: /imgly/ (if you deploy models there)
 */

const PACKAGE_VERSION = '1.7.0'

export const DEFAULT_IMGLY_CDN =
  `https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/`

export function resolvePublicPath(): string {
  const env = import.meta.env.VITE_IMGLY_PUBLIC_PATH as string | undefined
  if (env && env.trim()) {
    const t = env.trim()
    return t.endsWith('/') ? t : `${t}/`
  }

  // Prefer same-origin mirror when present (set at build via public/imgly/)
  if (typeof window !== 'undefined') {
    // Runtime flag from <meta name="imgly-public-path">
    const meta = document.querySelector('meta[name="imgly-public-path"]')
    const content = meta?.getAttribute('content')
    if (content) {
      const t = content.trim()
      return t.endsWith('/') ? t : `${t}/`
    }
  }

  return DEFAULT_IMGLY_CDN
}

/** URLs useful for Cache API / SW pre-warm (resources manifest) */
export function resourcesManifestUrl(publicPath = resolvePublicPath()): string {
  return new URL('resources.json', publicPath).href
}
