# Make Your Mark

A personal seal, an illustrated request form, and a shared surface. Shape a symbol on a circular rubber face, then land, rock, slide, and rotate it in the Personal Studio or draft a contribution to the Global Stamp Board.

Built for Georgia Tech LMC 4730. DE2 explores Image and Identity; the DE3 prototype changes the audience's role from individual creator to contributor to a collective artwork.

**DE3 status:** Supabase persistence is configured and verified with independent visitor sessions, concurrent submissions, refresh recovery, and a lost-response retry. The frontend publishes through GitHub Pages. See [setup and verification](docs/de3/README.md).

## Run locally

Requires Node.js 24 for the local shared-board server and tests.

```sh
npm ci
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:5173/StampStudio/`.

```sh
npm run build       # TypeScript checks and production build
npm run preview     # Serve the production build locally
npm test            # Seventeen browser integration tests, with isolated shared storage
npm run test:server # Four storage and validation tests
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

Editing the seal preserves the current personal document. Personal Studio work lives in this tab's memory; refreshing or closing resets it. Export before leaving. Personal artwork is never submitted to the shared board automatically.

## On the shared board

Browse without making a stamp or signing in. The finite 2400 × 1600 surface has four inks, fit/zoom controls, and a move mode. The same stamp engine handles landing, rocking, sliding, and rotation. Shared paper does not soak through: one participant cannot spoil everyone else's surface. The original document still does.

Marks stay in a separate private draft until **Leave my mark**. Undo and discard affect only that draft. Completed contacts are saved in this browser's IndexedDB, with a download option; the stamp design itself still lives in memory. Submitted contributions become independent, immutable transparent layers ordered by the server. A lost response preserves the exact pending submission so a retry cannot duplicate it. The board checks for new contributions every 15 seconds and on manual refresh.

To try shared persistence locally, copy `.env.example` to `.env.local`, start `npm run board:dev` in one terminal and `npm run dev` in another. The board says **Local shared preview**; its SQLite database lives in ignored `.local/`. This is a development backend, not public hosting. Production ignores the local backend URL and uses the configured Supabase project only.

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

The original twelve browser tests cover the circular editor, erase/undo, strong and thin regions from a light tap, local pressure, connected sliding, idle/contact rotation, exact angles, dampness and failure, recovery, stage preservation, PNG contents, and desktop/mobile layout. Additional comparisons replay identical slides and asymmetric rotations at different speeds, and verify visible ink buildup before a stopped slide soaks the paper. Five DE3 browser tests exercise independent browsers, concurrent commits, refresh recovery, failed-response retries, draft isolation, color/pressure/slide preservation, and pan/zoom on desktop and mobile. Four server tests check durable storage, append-only routes, authorization, safe PNG handling, idempotency, and atomic limits.

See [`docs/process/README.md`](docs/process/README.md) for actual development captures and notes. They document implementation and project-owner feedback, not a participant study.
