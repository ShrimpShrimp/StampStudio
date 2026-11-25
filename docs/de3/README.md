# DE3 prototype — shared stamp board

The intervention preserves the DE2 stamp and changes the destination of its consequences. A personal impression can now be left on one finite collective surface. Overlap is allowed; the board gives no score or prescribed composition.

## Status, November 25, 2026

The prototype is implemented, and hosted persistence is verified. The owner created **Make Your Mark DE3** in the **Leon Free** organization, region `us-east-1`; its project reference is `meawmkrqndgbmruqrkiy`. The two database migrations and `stamp-board` Edge Function are deployed, anonymous sign-ins are enabled, and the GitHub Pages build has the public project URL and publishable key configured.

The original Personal Studio retains its document, saturation/failure behavior, and PNG export. The shared board adds destination choice, public viewing, the same tactile engine on a 2400 × 1600 surface, four inks, private drafts, explicit sharing, ordered independent layers, pan/zoom, and safe retries. Shared marks cannot be erased through the application.

An opt-in hosted browser check passed against the real project: two independent anonymous sessions submitted concurrently; both marks remained; a lost response preserved the draft; retry reused the same ID; refresh recovered the pending state; and a fresh visitor without an Auth session saw identical pixels. Direct storage reads were denied to both anonymous and authenticated client credentials. Database inspection confirmed two contributions from two owners, RLS enabled, and no direct client table/RPC grants. See [the actual hosted test record](hosted-verification.json).

The two indigo/ochre **T** marks on the public board are deliberate technical checks, not participant work. Their IDs are recorded in the test record. They were retained rather than clearing the artwork. The owner should identify them in the audience-study notes; early marks can influence placement decisions.

No participant study has been conducted or invented. The owner will run the audience comparison.

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

## Hosted project and maintenance

Frontend: [Make Your Mark on GitHub Pages](https://shrimpshrimp.github.io/StampStudio/). Backend: [the owner's Supabase project](https://supabase.com/dashboard/project/meawmkrqndgbmruqrkiy). Keep this project for continuity; do not create a replacement or reset it while maintaining the artwork.

Supabase supplies Auth, Postgres, and one Edge Function. The frontend uses only the public project URL and publishable key. Never put a service-role key, database password, or access token in a Vite variable, source file, chat message, or Pages artifact.

The setup consists of:

1. `supabase/migrations/20261125065342_stamp_board.sql`: table, sequence, bounds/color constraints, indexes, RLS, least-privilege service grants, and the transactional submission function.
2. `supabase/migrations/20261125065645_deny_direct_client_access.sql`: an explicit restrictive deny policy for anonymous/authenticated clients, retained as defense in depth if grants or permissive policies are added later. Both filenames match the actual remote migration history.
3. **Allow anonymous sign-ins** enabled in Auth. Viewing creates no Auth user; a session is started only when sharing. No email/password/profile form is added to the artwork. The project's default email provider remains enabled; the app does not use it.
4. `supabase/functions/stamp-board/index.ts` deployed with `_shared/validation.mjs`. Function gateway JWT verification is disabled for public GET requests; every POST explicitly checks its bearer token with `auth.getUser()`. Server credentials come from Supabase's function environment. Routing accepts both the gateway-prefixed and function-relative URL forms.
5. Repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. They are public client configuration. A change to either requires a frontend rebuild. Ignored `.env.local` holds the same values for hosted development; it is not committed. The normal browser suite explicitly overrides these with empty values and always uses isolated local storage.

For future changes, inspect the current schema and run Supabase advisors. Generate new migrations with `supabase migration new NAME`; do not edit an already-applied migration. The CLI v3 help was checked during setup. With an authenticated CLI, use an explicit remote target:

```sh
supabase db push --remote=meawmkrqndgbmruqrkiy --dry-run
supabase db push --remote=meawmkrqndgbmruqrkiy
supabase functions deploy stamp-board --remote=meawmkrqndgbmruqrkiy --use-api --no-verify-jwt
```

Review the dry run before applying. A database password may be required; use the secure prompt, not command arguments. Do not use `--prune`, reset the database, or clear the board to test deployment. The GitHub workflow tests pull requests and publishes only a successful `main` build.

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

The maximum encoded image payload across 512 full-size allowed submissions is approximately 171 MiB, before row/index overhead. This fits within the currently advertised 500 MB Free database allowance, but anonymous Auth and other database usage also count. Smaller actual stamp crops use much less. Free hosting has usage quotas and may pause after inactivity; check the project before testing and monitor database/function/egress usage. The organization remains on Free; no paid add-on or upgrade was requested.

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

Hosted acceptance checklist (completed for the initial prototype; repeat relevant checks after backend changes):

1. Load the Pages URL without a prior session. Confirm viewing works without creating an Auth user or showing an account form.
2. In browser A, make one small technical test contribution and share it. Record its ID and the time. Refresh and compare the pixels.
3. Open browser B or a separate device. Verify A's contribution appears. Commit from A and B at roughly the same time; verify both IDs remain and neither replaces the other.
4. Interrupt the network while sharing. Keep the draft, restore connectivity, retry, and confirm exactly one row for the same ID. Never clear the board to reset this check.
5. Verify direct table reads/writes and submission RPC execution are denied to anonymous/authenticated client credentials. Verify public GET works, POST without a valid bearer token fails, and DELETE/PUT do not exist. Check Supabase advisors and logs.
6. Confirm the production bundle contains no server credential and no local API endpoint. Return to Personal Studio and verify a stamped request form can still be saved.

Keep technical test marks distinguishable from participant work in the study log. This release intentionally retains two documented T marks from the hosted check. Do not describe them as earlier participant contributions.

## Process and audience testing

See [process captures](evidence/README.md) and the [participant test guide](participant-test.md). These capture development decisions and actual technical checks. No participant feedback or engagement conclusion has been invented. The 250–350-word assignment rationale should be finalized after the owner has observations to reflect on.

Actual process screenshots were captured November 25, 2026 with `CAPTURE_DE3_PROCESS=1 npm test -- tests/board.spec.ts`. The first three captures use an isolated temporary local board. The fourth comes from the opt-in real hosted check and shows its two technical marks.

## Opt-in hosted verification

```sh
ALLOW_HOSTED_WRITES=1 npm run test:hosted
```

This separate configuration uses `.env.local` and the real Supabase project. It adds **two permanent technical T marks**, so it is never part of ordinary CI and must be opted into deliberately. It records contribution IDs and assertions in `hosted-verification.json` and captures `evidence/04-hosted-cross-session.png`. Browser tracing is disabled to avoid saving live anonymous access tokens. It does not write account details or tokens to the report. Do not rerun it just to regenerate a screenshot; each fresh run contributes another pair of marks.

At verification time, Supabase's security advisor had no table/RLS findings after the restrictive policy was applied. It later reported [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), a Pro-only feature shown in the dashboard. The application uses anonymous Auth and has no password-based visitor flow. The default email provider was left enabled after automatic approval review rejected an optional attempt to disable it as an unapproved change to sign-in functionality. No workaround was attempted. Review that provider separately if the owner later introduces email accounts.

The performance advisor noted the owner/time index as [unused](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) on the two-row board. It is retained for the per-owner submission-limit query as the board grows.
