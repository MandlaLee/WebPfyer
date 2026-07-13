# WebPfyer

**Turn heavy images into web-ready WebP files.**

WebPfyer is a private, browser-based image converter and optimizer for static websites. It resizes images, creates responsive WebP variants, strips metadata through canvas re-encoding, generates matching HTML, and packages outputs into a ZIP without uploading source files to a server.

## Features

- Drag-and-drop, file picker, batch upload, and clipboard paste
- PNG, JPEG, WebP, BMP, and first-frame GIF input where supported by the browser
- Website hero, page, card, thumbnail, blog, product, logo, social, and custom presets
- Responsive desktop/tablet/mobile output variants
- Preserve aspect ratio by default
- Never upscale images by default
- Quality mode and target-file-size mode
- Transparency detection and preservation
- Lightweight photo/graphic classification
- SEO-friendly output filenames
- Individual downloads and dependency-free ZIP generation
- Responsive `<picture>` markup generator
- Local dark/light theme preference
- Installable offline PWA
- No account, analytics, trackers, uploads, or backend

## Run locally

Because ES modules and service workers are restricted on `file://` URLs, use a tiny local web server:

```bash
cd webpfyer
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

The converter itself still processes images locally in the browser.

## Deploy to GitHub Pages

1. Create a GitHub repository, for example `webpfyer`.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Visit `https://USERNAME.github.io/webpfyer/` after deployment completes.

All application paths are relative, so project-site deployment works without editing source files.

## Custom domain

Add a `CNAME` file containing only your domain, then configure the DNS records shown by GitHub Pages. Update `robots.txt` and `sitemap.xml` from `example.com` to the production domain.

## Privacy

- Images are decoded and converted by browser APIs.
- Source images are never uploaded by WebPfyer.
- Export metadata is removed because a new image is encoded from canvas pixels.
- Temporary object URLs are released when files are removed or reconverted.
- Theme and onboarding preferences are the only values kept in localStorage.

## Browser support

Use a current version of Chrome, Edge, Firefox, or Safari. WebP encoding, `createImageBitmap`, clipboard access, and PWA installation vary slightly between browsers. The app checks WebP encoding support on startup.

## Project structure

```text
webpfyer/
├── index.html
├── 404.html
├── manifest.webmanifest
├── service-worker.js
├── robots.txt
├── sitemap.xml
├── README.md
├── LICENSE
└── assets/
    ├── css/style.css
    ├── js/
    │   ├── app.js
    │   ├── image.js
    │   ├── presets.js
    │   ├── html.js
    │   └── zip.js
    └── icons/
```

## Technical notes

WebPfyer uses no external runtime dependencies. Its ZIP exporter writes standards-compliant, stored ZIP entries in the browser. WebP files are already compressed, so additional ZIP deflation generally provides little benefit.

The browser Canvas API does not expose a guaranteed lossless WebP switch consistently across browsers. The logo preset therefore exports at maximum encoder quality and preserves transparency; true vector logos should remain SVG whenever possible.

## Known limitations

- HEIC and TIFF are not included in this dependency-free release.
- GIF input exports the browser-decoded first frame, not animation.
- Very large images may exceed the browser's canvas or memory limits.
- Exact WebP encoding characteristics differ by browser engine.
- Target size is a best-effort quality search and may not hit extremely small targets.

## License

MIT. See `LICENSE`.
