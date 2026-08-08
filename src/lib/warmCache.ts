/**
 * Pre-warm HTTP cache + SW by fetching resources.json (and letting SW cache chunks on demand).
 * Does not re-download everything — browser/SW cache hits are free.
 */

import { resourcesManifestUrl, resolvePublicPath } from './modelPath'

export async function warmModelManifest(): Promise<void> {
  try {
    const url = resourcesManifestUrl(resolvePublicPath())
    await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
  } catch {
    /* offline / CORS — ignore */
  }
}
