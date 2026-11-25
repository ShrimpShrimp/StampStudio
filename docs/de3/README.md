# DE3 prototype — shared stamp board

The intervention preserves the DE2 stamp and changes the destination of its consequences. A personal impression can now be left on one finite collective surface. Overlap is allowed; the board gives no score or prescribed composition.

## Status, November 25, 2026

Implemented and tested locally: destination choice; public viewing without an account screen; the existing tactile engine on a shared 2400 × 1600 surface; four inks; local drafts; undo/discard of drafts only; explicit sharing; ordered independent layers; pan and zoom; refresh recovery; durable storage across server restarts; concurrent submissions; safe retries; file validation and submission caps. Personal Studio retains its document, saturation/failure behavior, and PNG export.

**Hosted persistence is pending.** The owner chose a new Supabase Free project and installed the plugin. Its project-management tools were not exposed to the active chat, and the CLI had no authenticated account. No hosted project was created, no hosted schema was applied, and no hosted data was written. The Edge Function passed a Deno type check, but Supabase deployment, RLS enforcement, anonymous Auth, and cross-device persistence still need live verification. The existing GitHub Pages release remains the DE2 experience until this branch is merged and deployed.

The technical checks below are not participant testing. The owner will conduct the audience study.

## Run a durable local board

Use Node 24. In the repository:

```sh
npm ci
cp .env.example .env.local
npm run board:dev
```

In another terminal:

```sh
npm run dev
```

Open the printed URL. The header above the shared paper says **Local shared preview**. Open a separate browser/profile on the same computer to verify another visitor sees committed work. Browser refresh keeps a completed-contact draft in IndexedDB; restarting the local server keeps shared contributions in `.local/board.sqlite`. Keep that file for continuity. The local server binds to loopback and is not a production or cross-device deployment.

The personal document and stamp design are still in-memory. A recovered shared draft can be submitted or downloaded without redrawing its stamp, but continuing to stamp after refresh requires a new design. Undo history is not restored across refresh. Draft persistence can be unavailable in restricted/private browsers; an explicit warning and PNG download are provided.

## Hosted setup — owner-approved new Free project

Keep the frontend on GitHub Pages. Supabase supplies Auth, Postgres, and one Edge Function. The frontend needs only a public project URL and publishable key. Never copy a service-role key, database password, or access token into a Vite variable, source file, chat message, or GitHub Pages artifact.

1. Finish the Supabase connection so project tools are available, then create one project named `Make Your Mark DE3` in an owner-selected **Free** organization. Do not upgrade a plan or attach paid add-ons. If a paid organization is the only choice, stop and resolve that with the owner.
2. Apply `supabase/migrations/20261125062237_stamp_board.sql` to this new project. The table enables RLS, denies direct anonymous/authenticated access, and gives the service role a single append-only submission function. Do not apply it to an unrelated existing project.
3. Enable **Allow anonymous sign-ins** in Supabase Auth. Viewing does not create an Auth user. The browser silently starts a session only when sharing; no email, password, profile, or account form is added to the artwork.
4. Deploy `supabase/functions/stamp-board/index.ts` as `stamp-board`, including `../_shared/validation.mjs`. Gateway JWT verification is disabled for this function because GET requests are public; the function explicitly checks the user's bearer token with `auth.getUser()` before accepting POST requests. Its service-role credentials are server environment values supplied by Supabase.
5. Set the repository's GitHub Actions **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public client configuration, not administrative credentials. Set the same values in ignored `.env.local` to verify the hosted project from a local frontend. Remove/leave unused `VITE_BOARD_API_URL`; Supabase takes precedence when configured.
6. Perform the hosted acceptance checks below before merging/deploying the DE3 branch. The Pages workflow embeds the two public variables at build time. An environment change needs a rebuild.

The current CLI help was checked during implementation. CLI v3 targets the local database by default, so use an explicit remote target. After the owner signs in with `supabase login`, the corresponding deployment commands are:

```sh
supabase db push --remote=PROJECT_REF --dry-run
supabase db push --remote=PROJECT_REF
supabase functions deploy stamp-board --remote=PROJECT_REF --use-api --no-verify-jwt
```

Replace `PROJECT_REF` with the new project's actual reference. Review the dry run before applying. A database password may be required by the CLI; enter it through its secure prompt, not command arguments. The migration was generated with `supabase migration new stamp_board`. Do not use `--prune`, reset the database, or clear a shared board to test deployment. Run Supabase advisors after provisioning and address any access warnings.

## Why store independent rendered layers

The physical engine produces detailed raster ink from duration, movement, local pressure, and rotation. A cropped transparent PNG records the exact result without asking future browser versions to replay gestures identically. Each shared contribution is one immutable row with its own ID, sequence, position, dimensions, color, and server timestamp.

For this small experiment, base64 PNG data is stored in the same Postgres row as its metadata. This adds about one third encoding overhead, but makes a commit atomic and avoids orphaned uploads or a race between object storage and metadata. It is not a whole-board snapshot: overlapping submissions append independently and composite in server order. A single transaction/advisory lock handles idempotency and limits. At higher volume, move the bytes to object storage and retain immutable metadata, with an explicit upload/finalization protocol.

The browser holds one flattened committed image, a separate draft canvas, and at most four draft undo snapshots to bound memory. Each fetched layer is decoded, drawn, and released. Refresh polling fetches only metadata after the last sequence. Images have immutable cache headers. There is no realtime dependency and no UI route to delete, replace, or clear shared marks.

## Limits and operational tradeoffs

Limits enforced by the server:

- A 2400 × 1600 finite board; all bounding boxes must fit.
- At most 512 shared contributions and 256 KiB of PNG data per contribution.
- Three new contributions per minute and twenty per day per anonymous session. Safe retries of the same accepted contribution do not consume these allowances.
- Standard non-interlaced RGBA PNG only. Validate signature, chunk lengths, checksums, dimensions, bounded decompression, scanline filters, nonempty ink, and the selected ink color. Compressed metadata and active formats such as SVG are rejected. Low-alpha RGB rounding from Canvas is tolerated.
- Only four curated colors. Public metadata excludes the anonymous owner ID. No arbitrary text or HTML is rendered.

The maximum encoded image payload across 512 full-size allowed submissions is approximately 171 MiB, before row/index overhead. This fits within the currently advertised 500 MB Free database allowance, but anonymous Auth and other database usage also count. Smaller actual stamp crops use much less. Free hosting has usage quotas and may pause after inactivity; check the project before testing and monitor database/function/egress usage. No paid resource was provisioned during this implementation.

Anonymous rate limits are modest spam resistance, not proof of a unique person: a determined visitor can start new sessions. The finite global cap bounds stored artwork, but request/egress abuse still needs provider controls. For a small supervised study, retain Auth's provider IP limits and observe usage. A wider public launch may require a challenge/rate limiter and a moderation process. This prototype has no participant deletion interface; an owner can use administrative tools if necessary, with explicit care for the shared artwork.

References checked November 25: [Supabase Free pricing](https://supabase.com/pricing), [anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [Edge Function authentication](https://supabase.com/docs/guides/functions/auth), [Supabase CLI v3 changes](https://supabase.com/changelog/supabase-cli-v3), and [Firebase Storage billing changes](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). Supabase was chosen to keep this experiment on a Free project without requiring a billing-enabled Firebase Storage plan.

## Technical checks

```sh
npm run build
npm run test:server
npm run check:function
npm test
```

The browser suite launches a separate Vite server on port 5175 and a local API on 8788 with a fresh temporary SQLite database. It never writes to the hosted board. The local API and Supabase function share the PNG/input validator and the same public route contract; local test success does **not** establish that the remote migration, Auth settings, or RLS are configured correctly.

Verified locally:

- All twelve DE2 tests: editor, undo/restore, uneven first impression, fixed-center pressure, dragging, idle/contact rotation, speed-sensitive transfer, saturation/failure, PNG export, and desktop/mobile layout.
- Five DE3 browser tests: independent contexts submit concurrently; refresh restores the composed board; a draft recovers after refresh; draft discard leaves community pixels unchanged; a lost response after the server saved the contribution preserves the draft and retries without duplication; navigation preserves private work; original gestures and color selection work; pan/zoom adds no ink and the layout fits 390 px.
- Four server tests: disk persistence after restart; ordered independent rows; public metadata privacy; idempotent retry; other-session replacement rejection; absent edit/delete routes; authorization and safe PNG validation; per-minute/day limits; two competing submissions for the final board space admit exactly one.
- The Edge Function passes `deno check supabase/functions/stamp-board/index.ts`.
- A manual Chrome preview confirmed that a test seal could be drawn, stamped/slid in indigo, and committed to the local board.

Hosted acceptance checks still required:

1. Load the Pages URL without a prior session. Confirm viewing works without creating an Auth user or showing an account form.
2. In browser A, make one small technical test contribution and share it. Record its ID and the time. Refresh and compare the pixels.
3. Open browser B or a separate device. Verify A's contribution appears. Commit from A and B at roughly the same time; verify both IDs remain and neither replaces the other.
4. Interrupt the network while sharing. Keep the draft, restore connectivity, retry, and confirm exactly one row for the same ID. Never clear the board to reset this check.
5. Verify direct table reads/writes and submission RPC execution are denied to anonymous/authenticated client credentials. Verify public GET works, POST without a valid bearer token fails, and DELETE/PUT do not exist. Check Supabase advisors and logs.
6. Confirm the production bundle contains no server credential and no local API endpoint. Return to Personal Studio and verify a stamped request form can still be saved.

Keep technical test marks visibly distinguishable from participant work in the study log. Avoid automatically seeding the public artwork: early marks can influence audience behavior and should be an intentional experimental choice.

## Process and audience testing

See [process captures](evidence/README.md) and the [participant test guide](participant-test.md). These capture development decisions and actual technical checks. No participant feedback or engagement conclusion has been invented. The 250–350-word assignment rationale should be finalized after the owner has observations to reflect on.

Actual process screenshots were captured November 25, 2026 with `CAPTURE_DE3_PROCESS=1 npm test -- tests/board.spec.ts`. This uses an isolated temporary local board and technical test marks; it does not seed the hosted artwork.
