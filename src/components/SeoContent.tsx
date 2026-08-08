/**
 * Visible SEO landing content: keywords, HowTo, FAQ (matches JSON-LD).
 * Shown on upload step only — real value for users + crawlers after JS render.
 */

const FEATURES = [
  {
    title: 'Free background remover',
    titleUz: 'Bepul fon olib tashlash',
    body: 'Remove background from images online free — no signup, no watermark, no credit card.',
  },
  {
    title: '100% private (client-side AI)',
    titleUz: '100% maxfiy (brauzerda AI)',
    body: 'Photos never leave your device. On-device AI — safer than cloud remove.bg-style uploads.',
  },
  {
    title: 'Transparent PNG & custom backgrounds',
    titleUz: 'Shaffof PNG va maxsus fon',
    body: 'Export transparent PNG, solid colors, or your own background image as JPEG.',
  },
  {
    title: 'Fast AI cutout',
    titleUz: 'Tez AI kesish',
    body: 'Instant subject detection for portraits, products, logos, and graphics in your browser.',
  },
] as const

const STEPS = [
  {
    n: '1',
    title: 'Upload image',
    body: 'PNG, JPG, WEBP — drag & drop, click, or paste (Ctrl/Cmd+V).',
  },
  {
    n: '2',
    title: 'AI removes background',
    body: 'Local AI segments the subject and erases the background automatically.',
  },
  {
    n: '3',
    title: 'Download result',
    body: 'Get HD transparent PNG or JPEG with color / image background.',
  },
] as const

const FAQS = [
  {
    q: 'Is this background remover free?',
    a: 'Yes. BG Remover is a free online background remover with unlimited personal use, no account required.',
  },
  {
    q: 'Do you upload my photos to a server?',
    a: 'No. Processing is 100% client-side in your browser. Images stay on your device — a private remove background tool.',
  },
  {
    q: 'Is BG Remover a remove.bg alternative?',
    a: 'Yes. It is a free privacy-first remove.bg alternative: AI background removal without sending files to the cloud.',
  },
  {
    q: 'Fon olib tashlash qanday ishlaydi?',
    a: 'Rasmni yuklang — AI brauzeringizda fonni olib tashlaydi. Serverga yuborilmaydi. PNG yoki JPEG yuklab oling.',
  },
  {
    q: 'Как бесплатно убрать фон с фото?',
    a: 'Откройте BG Remover, загрузите фото — ИИ удалит фон прямо в браузере. Скачайте PNG с прозрачностью.',
  },
  {
    q: 'Which file types work?',
    a: 'Upload PNG, JPG, JPEG, WEBP up to 12 MB. Download transparent PNG or high-quality JPEG.',
  },
] as const

export function SeoContent() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      {/* Secondary keyword H2 for crawlers + users */}
      <section className="mt-16 border-t border-zinc-900 pt-12" aria-labelledby="seo-why">
        <h2 id="seo-why" className="text-center text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          Free online background remover — private &amp; fast
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-zinc-400">
          BG Remover is a free AI tool to{' '}
          <strong className="font-medium text-zinc-300">remove background</strong> from photos in one
          click. Works as a browser-based{' '}
          <strong className="font-medium text-zinc-300">background eraser</strong> for product shots,
          portraits, and graphics — plus{' '}
          <span lang="uz">fon olib tashlash</span> and{' '}
          <span lang="ru">удаление фона онлайн</span>.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3.5"
            >
              <h3 className="text-sm font-semibold text-zinc-100">{f.title}</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500" lang="uz">
                {f.titleUz}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="seo-howto">
        <h2 id="seo-howto" className="text-center text-lg font-semibold text-zinc-50">
          How to remove background from an image
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-900">
                {s.n}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-zinc-100">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 mb-6" aria-labelledby="seo-faq">
        <h2 id="seo-faq" className="text-center text-lg font-semibold text-zinc-50">
          Background remover FAQ
        </h2>
        <div className="mt-6 space-y-2">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 open:bg-zinc-900/70"
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="shrink-0 text-zinc-500 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Keyword footer strip — natural language, not spam */}
      <p className="mb-10 text-center text-[11px] leading-relaxed text-zinc-600">
        Popular searches: remove background free · background remover online · remove bg · transparent
        background maker · AI cutout · fon olib tashlash · orqa fonni olib tashlash · убрать фон с фото
      </p>
    </div>
  )
}
