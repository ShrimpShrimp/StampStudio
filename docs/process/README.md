# First-pass development evidence — November 12, 2026

These screenshots were captured from the working application during implementation. They document the first functional pass, not separate historical prototypes or participant research. No user study has been conducted.

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

## Next review

Have the project owner try the actual mouse/trackpad experience. Review wheel sensitivity, stamp scale, ink buildup, and whether the drag's patterned band feels expressive. These are tuning questions; automated correctness checks do not establish how satisfying an interaction feels.
