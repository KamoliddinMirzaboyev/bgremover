import { SITE } from '../seo/site'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-zinc-900 bg-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-zinc-200">{SITE.name}</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Free online background remover. Private AI in your browser — remove BG without uploading
            photos to a server.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Product</p>
          <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
            <li>
              <a href="#tool" className="transition-colors hover:text-zinc-200">
                Background remover tool
              </a>
            </li>
            <li>
              <a href="#seo-howto" className="transition-colors hover:text-zinc-200">
                How to remove background
              </a>
            </li>
            <li>
              <a href="#seo-faq" className="transition-colors hover:text-zinc-200">
                FAQ
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-zinc-500 uppercase">Privacy</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Client-side only. No account. Images are not stored on our servers because processing
            never leaves your device.
          </p>
        </div>
      </div>
      <div className="border-t border-zinc-900 py-4 text-center text-[11px] text-zinc-600">
        © {year} {SITE.name} · {SITE.domain} · Free remove background online
      </div>
    </footer>
  )
}
