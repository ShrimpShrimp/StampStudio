# Make Your Mark

A personal seal, an illustrated request form, and just enough ink to get into trouble. Shape a symbol on a circular rubber face, then land, rock, slide, and rotate it on a little document-review desk.

Built for Georgia Tech LMC 4730, Design Experiment 2 — Image and Identity.

## Run locally

Requires Node.js 22.12+; Node 24 is used for deployment.

```sh
npm ci
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:5173/StampStudio/`.

```sh
npm run build       # TypeScript checks and production build
npm run preview     # Serve the production build locally
npm test            # Twelve browser integration tests
```

Local tests use installed Google Chrome. CI installs Playwright Chromium. To use bundled Chromium locally, install it with `npx playwright install chromium` and remove the local `channel` override in `playwright.config.ts`.

## At the workbench

Shape a personal symbol inside the circular rubber face. **Carve** adds a line; **Restore** removes part of it. Choose a fine, medium, or bold tool, undo, or start over. The preview shows which lines will carry ink. The warm cut-line appearance is a visual treatment; the original artwork is retained as a transparent mask, not inverted into a different design.

## At the desk

- **Tap to land:** a quick contact leaves a patchy impression immediately. Some regions can be strongly inked while others are thin or dry. Releasing anchors the stamp at that center.
- **Rock:** press and hold parts of the placed face to fill dry patches locally. Moving during this contact changes pressure, not the stamp's center. Moving outside the face pauses transfer.
- **Slide:** while the stamp is lifted, press and drag more than 8 screen pixels. The moving stamp leaves an uneven trail with varying contact across its face. Slower movement leaves a heavier trail; fast movement leaves less ink. Stopping in sliding mode builds a rich, pooling impression before the sheet can soak. Releasing places it at the endpoint, ready to rock. A drag that begins on an already placed stamp stays a pressure gesture.
- **Turn:** scroll over the paper, use arrow keys with the paper active, or enter an angle. Rotation before contact deposits no ink. Rotation during contact transfers overlapping orientations, with slower turns leaving more ink than rapid spins.
- **Lift stamp / Escape:** reveal the impression and get ready to place or slide again. Clicking elsewhere also starts a new landing. Lift before changing stamp size.
- **Watch the paper:** repeated or prolonged contact accumulates moisture locally. A dampness meter and spreading ink warn you before the paper soaks through. Concentrated contact takes roughly six seconds from dry paper to failure; distributed contacts accumulate less at any one spot. These are prototype tuning values, not a physical fluid simulation. There is no automatic drying in this version.
- **Fresh document:** replace the spoiled or completed form while keeping your seal. Spoiling does not erase the result or immediately replace the sheet. Undo can restore the previous contact, moisture state, or document.
- **Save PNG:** export the illustrated form, actual ink, and seepage as an opaque 1800 × 1200 image. The stamp carrier and UI are excluded.

⌘Z / Ctrl+Z undoes a shaping stroke or an entire landing/pressure/slide gesture. Drawing history keeps 30 actions; document history keeps 10 to bound memory.

Editing the seal preserves the current document. Work lives in this tab's memory; refreshing or closing resets it. Export before leaving. No artwork is uploaded, and there is no backend, account, or analytics.

## GitHub Pages

**https://shrimpshrimp.github.io/StampStudio/**

The Vite base is `/StampStudio/`. `.github/workflows/deploy.yml` checks types, builds, runs the browser suite, and deploys `dist/` on pushes to `main`. GitHub Pages uses **GitHub Actions** as the publishing source. If the repository is renamed, update `base` in `vite.config.ts`; use `/` for a root domain.

## Implementation

- React + TypeScript + Vite; Canvas 2D handles artwork and the illustrated document.
- `src/canvas.ts` separates the original symbol, temporary contact masks, paper ink, moisture/diffusion, and the stamp carrier.
- Landing masks use coherent patches of high/low coverage. Sliding blends a small deterministic bank of contact patterns along the path. Dwell and path deposits share a speed response based on stamp widths per second, including motion at the rim during rotation. Slow motion transfers more ink and moisture, fast motion transfers less, and stopping promptly restores full contact. Fast movement is interpolated. Sliding dwell gently shifts the uneven contact pattern as ink pools into dry regions.
- Pressure uses a localized contact field. Rotation interpolates angles. Ink coverage accumulates without changing the underlying user symbol.
- A small moisture grid tracks local absorption. A low-resolution diffusion layer softens ink in damp regions without modifying the original paper pixels. Undo snapshots include moisture and document state.
- `src/document.ts` draws the simple illustrated form for both the live desk and PNG export.
- Pointer capture, cancellation, lost focus, and tab visibility changes end contact safely. Wheel input rotates on the paper; ordinary scrolling remains available outside it. The desktop layout keeps the target in view.
- The interface has responsive layouts, keyboard focus, reduced-motion support, and system font fallbacks. Desktop Chrome is the primary target; touch pressure/slide work, but multi-touch rotation is not implemented.

## Validation and process

The twelve browser tests cover the circular editor, erase/undo, strong and thin regions from a light tap, local pressure, connected sliding, idle/contact rotation, exact angles, dampness and failure, recovery, stage preservation, PNG contents, and desktop/mobile layout. Additional comparisons replay identical slides and asymmetric rotations at different speeds, and verify visible ink buildup before a stopped slide soaks the paper.

See [`docs/process/README.md`](docs/process/README.md) for actual development captures and notes. They document implementation and project-owner feedback, not a participant study.
