# BG Remover

Professional client-side background removal web app. 100% browser-based — no backend, no server costs.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- `@imgly/background-removal` (WebAssembly / ONNX)
- lucide-react

## Features

- Drag-and-drop upload (PNG, JPG, JPEG, WEBP)
- Sample images for instant testing
- Progress UI while the AI model runs
- Before/after comparison slider
- Background modes: transparent, solid color, custom image
- Zoom controls
- HD download (PNG transparent / JPEG with background)

## Develop

```bash
npm install
npm run dev
```

## Build & Deploy (Vercel)

```bash
npm run build
```

Deploy the `dist` folder as a static site on Vercel. The app loads ONNX/WASM assets from IMG.LY’s CDN by default.

## Privacy

Images never leave the user’s device. All processing happens in the browser.

## Quality & speed

- **Tez / Yuqori sifat** toggle (quint8@~1280 vs fp16@~2048, device-adaptive)
- Full-res mask export + smart soft edge + Studio **edge feather** slider
- Service worker caches IMG.LY model assets for faster repeat visits
- Optional self-host models: set `VITE_IMGLY_PUBLIC_PATH=/imgly/` (or CDN URL) and mirror assets under `public/imgly/`

## SEO (production)

Live: https://bgremover.webportfolio.uz/

- `robots.txt`, `sitemap.xml`, Open Graph, JSON-LD (WebApp / FAQ / HowTo)
- After deploy: Google Search Console → submit `https://bgremover.webportfolio.uz/sitemap.xml`
- Request indexing for the homepage URL
- Optional: Bing Webmaster Tools + same sitemap
