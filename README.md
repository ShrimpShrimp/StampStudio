# Make Your Mark

A small browser-based stamp studio. Draw a personal symbol, then change its expression through pressure, movement, and rotation.

Built for Georgia Tech LMC 4730, Design Experiment 2 — Image and Identity.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:5173/StampStudio/`.

```sh
npm run build       # TypeScript checks and production build
npm run preview     # Serve the production build locally
npm test            # Six browser integration tests
```

Local tests use installed Google Chrome. CI downloads Playwright Chromium. To use bundled Chromium locally instead, install it with `npx playwright install chromium` and remove the local `channel` override in `playwright.config.ts`.

## Use the studio

1. Draw a symbol. Adjust line width, erase, undo, or clear the drawing.
2. Select **Use this stamp**.
3. **Tap** for a light impression. **Hold** to darken it in real time. **Drag** for a connected trail. While pressed, **scroll** to twist, or hold **← / →**.
4. Combine these gestures without releasing. One continuous press is one undo action.
5. Edit the original at any point; existing paper marks stay intact. The updated symbol applies to future impressions.
6. **Save PNG** exports a paper-backed 1800 × 1200 image, without the cursor or interface.

⌘Z / Ctrl+Z undoes a drawing stroke or a complete stamping gesture. Clearing the drawing or paper can also be undone. Drawing history keeps 30 actions; paper history keeps 12 to bound memory.

Work lives in the current tab's memory. Switching stages preserves it; refreshing or closing the page resets it. Export your composition before leaving. No drawing is uploaded and there is no backend, account, or analytics.

## GitHub Pages

Target: **https://shrimpshrimp.github.io/StampStudio/**

The Vite base is `/StampStudio/`. `.github/workflows/deploy.yml` checks types, builds, runs the browser tests, and deploys `dist/` on pushes to `main`. GitHub Pages must use **GitHub Actions** as its publishing source under **Settings → Pages**.

If the repository is renamed, update `base` in `vite.config.ts`. For a root domain, use `/`.

## Implementation

- React + TypeScript + Vite; Canvas 2D handles all artwork.
- `src/canvas.ts`: the transparent original drawing, stamp mask, paper pixels, and temporary cursor are separate canvases. Paper is rendered at a fixed export resolution independent of the displayed size.
- Dwell ink is time-based; movement and rotation are interpolated. Ink along a path is weighted by distance and angle rather than pointer-event count.
- Wheel input is intercepted only while the stamp is pressed. Pointer capture, cancellation, lost focus, and tab visibility changes terminate gestures safely.
- The stamp has fixed subtle grain, with no random replacement or displacement of the original symbol.
- The interface is responsive, includes visible keyboard focus and reduced-motion support, and is primarily intended for desktop Chrome. Pointer drawing also works on touch; touch twisting is outside this first pass.
- Google Fonts supplies DM Sans and Instrument Serif, with system/Georgia fallbacks.

## Validation and process

`tests/studio.spec.ts` covers drawing/erasing/undo, tap versus live hold accumulation, a fast interpolated drag, both wheel directions, both keyboard directions, combined gestures, scrolling behavior, stage preservation, leaving the paper, PNG contents, and narrow layouts.

See [`docs/process/README.md`](docs/process/README.md) for genuine development captures and notes. These are implementation evidence, not participant testing or a claim that the interaction has been validated with users.
