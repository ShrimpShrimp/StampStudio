# Development evidence — November 12, 2026

These screenshots were captured from the working application during implementation. Captures 01–03 document the first functional pass; capture 04 documents the subsequent interaction revision. They are not participant research. No user study has been conducted.

## 01 — A user-drawn symbol becomes the stamp

`01-custom-symbol.jpg` is a Chrome capture after drawing an asymmetric triangle through pointer input. The live preview retains the custom shape. The drawing, preview, and later paper impressions use the same original canvas.

Decision: keep the original transparent and separate from both paper pixels and the moving cursor. Editing the symbol changes future impressions while retaining existing paper artwork.

## 02 — Tap, dwell, and a connected path

`02-tap-hold-drag.jpg` shows actual output from a quick click, an approximately 1.8-second hold, and a drag using that same symbol. The hold visibly darkens the original; the drag forms a closely connected patterned band.

Decision: accumulate ink continuously during contact. Deposit time-based opacity on animation frames, and interpolate spatial deposits to cover fast pointer movement. Weight movement ink by distance so event frequency does not determine trail darkness.

## 03 — Rotation and travel in one gesture

`03-combined-gestures.jpg` is captured during the browser integration test after wheel rotations in both directions, keyboard rotations, and dragging without releasing. Rotation leaves multiple overlapping orientations around the start of the trail. The paper counts the entire sequence as one gesture.

Decision: rotation updates the contact pose and deposits intermediate angles. It does not transform existing paper pixels. Arrow keys provide a fallback for trackpads.

## Actual verification

The initial six Chrome integration tests passed locally. Pixel checks confirmed that opacity rises while still pressed, stops changing after release, fast drags have no empty columns along the path, twist covers new pixels, and undo restores previous artwork exactly. The downloaded PNG was checked for its dimensions and opaque paper background. Responsive checks included 1440, 1024, and 390-pixel widths.

The native browser automation could exercise simple clicks, holds, and drags, but could not reliably overlap a held click with a scroll. Dedicated automated browser tests verified wheel/keyboard combinations using controlled pointer events instead. This is a tooling constraint, not a participant observation.

## 04 — Placement first, pressure second

Feedback from the project owner: the continuous trail felt like drawing, and uniform darkening missed the act of working pressure around a physical stamp. The revised direction separates placement from ink transfer.

`04-place-and-pressure.jpg` is an actual automated browser capture of the revised version. Both impressions use the same square outline. The left impression received one short press along its left edge; the right impression received eight short contacts around its perimeter. The missing edges on the left and fuller coverage on the right result from where pressure was applied.

Behavior change: the first click sets the center and leaves no ink. Subsequent presses apply a localized contact field to the stamp face. Moving during contact shifts pressure, while the stamp's center remains fixed. Moving outside pauses transfer. Lifting reveals the paper, and placing elsewhere starts another impression. Twisting remains available during contact. This deliberately replaces the first pass's continuous drag behavior.

The carrier has a border, grip marks, a slight directional lean, and a contact indicator. Size increases from 10% to approximately 17% of paper width by default to give the pressure interaction more room.

Validation: the revised browser suite checks placement without ink, anchored movement, local opacity buildup, opposite-edge coverage, stopping outside the face, both twist directions, lift, undo, clear, export, stage preservation, and narrow layouts. An initial test sampled the left edge before releasing the pointer, allowing an extra animation frame before the comparison; its baseline was corrected to sample after release.

## Next review

Try placing, pressing around the edges, and lifting with a real mouse or trackpad. Assess whether the contact area is too broad or narrow, how long useful coverage takes, and whether the carrier communicates physical pressure clearly. Automated checks establish behavior, not how satisfying it feels.

## 05 — The workbench and the review desk

The project owner's next feedback addressed the drawing-pad presentation, requested optional inconsistent sliding and rotation before contact, and proposed a document context with over-inking failure. They also clarified that a light tap should transfer strong ink in some areas, not uniformly faint ink everywhere.

`05-circular-workbench.jpg` and `05-document-desk.jpg` are actual browser captures of this revision. The editor now presents a circular rubber face, warm cut-line feedback, a rim, and compact shaping tools. The desk uses an illustrated form with wireframe text and a marked stamp area. The document illustration is generated with Canvas paths, typography, and blocks, rather than a downloaded reference image.

The previous no-ink placement behavior is deliberately superseded. Landing immediately transfers a coherent patchwork of strong, thin, and dry regions. A short click places the face for later local pressure. An initial drag beyond an 8-pixel threshold slides it with changing contact patterns; subsequent movement on a placed face continues to rock it. Idle rotation changes orientation without ink transfer. An angle field supports deliberate alignment.

## 06 — Paper can absorb too much

`06-soaked-document.jpg` captures an actual failed document after sustained contact. The moisture grid first produces a visible damp halo and low-resolution ink diffusion, then marks the document as soaked through. Concentrated contact is riskier than distributing pressure around the face. The sheet remains available for export, undo, or explicit replacement; failure does not silently clear the participant's work.

The thresholds, contact radius, and texture distribution are a first attempt for hands-on review, not measured physical properties. Moisture does not automatically dry in this version. The nine updated integration tests passed locally, including immediate dark/thin patches, local gap filling, initial-drag sliding, idle and contact rotation, moisture/failure/recovery, export composition, and narrow layouts. Desktop paper sizing was adjusted after visual inspection so the target remains in view while wheel input is used for rotation.

For the assignment's two-to-four evidence pieces, a useful selection is 01 (custom symbol), 04 (separated pressure), 05 (new context), and 06 (consequential ink). Earlier captures remain unchanged as development history.


## Speed-sensitive ink transfer

Further project-owner feedback: sliding looked too faint even when staying in place long enough to soak the sheet. They proposed that slower sliding and spinning should transfer more ink, while fast movement should leave lighter marks.

The motion model now measures translation and angular rim speed using a shared response. Regular and slow slides deposit more ink than the previous version; rapid movement transfers less. When a sliding stamp stops, stale speed decays quickly, ink accumulates more strongly, and contact coverage shifts gradually to fill some dry areas. Moisture uses the same speed adjustment, keeping wetting consistent with contact.

Three regression checks compare identical slow/fast paths, compare equal-angle slow/fast turns using an asymmetric mark, and confirm substantial visible ink buildup at a stopped slide's endpoint before soaking. The circular outline used by other tests saturated too quickly to make a useful comparison of rotational sweeps, so the rotation test uses an L-shaped symbol. These are automated checks, not participant observations.

The first hosted run exposed a timing dependency in the wheel comparison: automation latency made its fast case slower on the shared runner. The comparison now uses Playwright's controlled clock with equal angle increments at 16 ms and 120 ms intervals, while still delivering real wheel events and running the animation frames. Production ink behavior was not weakened to accommodate the runner.
