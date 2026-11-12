# Make Your Mark

A small browser-based stamp studio. Draw a personal symbol, then change its expression through placement, localized pressure, and rotation.

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
npm test            # Eight browser integration tests
```

Local tests use installed Google Chrome. CI downloads Playwright Chromium. To use bundled Chromium locally instead, install it with `npx playwright install chromium` and remove the local `channel` override in `playwright.config.ts`.

## Use the studio

1. Draw a symbol. Adjust line width, erase, undo, or clear the drawing.
2. Select **Use this stamp**.
3. **Place:** click the paper once to set the stamp's center. This leaves no ink, even if that first click is held or dragged.
4. **Press:** click and hold a part of the placed stamp's face. Only the nearby area transfers ink; a longer hold strengthens that contact.
5. **Rock:** move the pressure point or make separate presses around the edges. The stamp stays anchored, so moving does not create a brush trail. Moving outside its face pauses ink transfer until you return.
6. **Twist:** while pressing, scroll or hold **← / →** to rotate around the fixed center and transfer overlapping local impressions.
7. **Lift stamp** or press **Escape** to reveal the result. Click elsewhere to place again. Clicking outside an existing stamp also repositions it without applying ink.
8. Edit the original at any point; existing paper marks stay intact. The updated symbol applies to future impressions.
9. **Save PNG** exports a paper-backed 1800 × 1200 image, without the carrier, pressure indicator, or interface.

Lift the stamp before changing its size.

⌘Z / Ctrl+Z undoes a drawing stroke or one pressure pass (from press to release). Clearing the drawing or paper can also be undone. Drawing history keeps 30 actions; paper history keeps 12 to bound memory.

Work lives in the current tab's memory. Switching stages preserves it; refreshing or closing the page resets it. Export your composition before leaving. No drawing is uploaded and there is no backend, account, or analytics.

## GitHub Pages

Target: **https://shrimpshrimp.github.io/StampStudio/**

The Vite base is `/StampStudio/`. `.github/workflows/deploy.yml` checks types, builds, runs the browser tests, and deploys `dist/` on pushes to `main`. GitHub Pages must use **GitHub Actions** as its publishing source under **Settings → Pages**.

If the repository is renamed, update `base` in `vite.config.ts`. For a root domain, use `/`.

## Implementation

- React + TypeScript + Vite; Canvas 2D handles all artwork.
- `src/canvas.ts`: the transparent original drawing, stamp mask, paper pixels, and temporary cursor are separate canvases. Paper is rendered at a fixed export resolution independent of the displayed size.
- Placement and contact are separate states. A soft contact field clips the original mask around the pointer, so dwell deposits ink locally without moving the stamp center. Rotations deposit intermediate orientations. Low-opacity accumulation is recolored to keep the ink hue stable.
- Wheel input is intercepted only while the stamp is pressed. Pointer capture, cancellation, lost focus, and tab visibility changes terminate gestures safely.
- The stamp has fixed subtle grain, with no random replacement or displacement of the original symbol.
- The interface is responsive, includes visible keyboard focus and reduced-motion support, and is primarily intended for desktop Chrome. Pointer drawing also works on touch; touch twisting is outside this first pass.
- Google Fonts supplies DM Sans and Instrument Serif, with system/Georgia fallbacks.

## Validation and process

`tests/studio.spec.ts` covers drawing/erasing/undo, placement with no ink, anchored placement during pointer movement, localized edge buildup, opposite-edge coverage, movement outside the face, lift/reposition, both wheel and keyboard directions, scrolling behavior, stage preservation, leaving the paper, PNG contents, and narrow layouts. A development capture compares one partial contact with an impression worked around its edges.

See [`docs/process/README.md`](docs/process/README.md) for genuine development captures and notes. These are implementation evidence, not participant testing or a claim that the interaction has been validated with users.
