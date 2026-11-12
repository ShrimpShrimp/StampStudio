# Codex Handoff — Design Experiment 2: Interactive Stamp Studio

## 1. Project Overview

Build a polished, interactive browser-based digital art experiment centered on creating and using a personalized stamp.

The experience has two stages:

1. **Design Your Stamp:** Users draw a custom symbol or pattern that they choose to represent themselves.
2. **Make Your Mark:** Users apply their stamp to a digital paper canvas using physical, gesture-driven interactions.

The central creative idea is that a stamp is not merely a fixed image. The way a person applies that stamp can become another layer of visual expression.

Traditional stamping prioritizes consistent reproduction of a predefined symbol. This experiment intentionally changes that convention by allowing users to manipulate the mark through pressing, holding, dragging, and twisting.

The result should feel like a small, standalone digital toy that people would enjoy experimenting with even without knowing the academic assignment.

**Working title:** Make Your Mark

**Core design question:**

*How can transforming a fixed personal symbol through physical gestures change the way identity is visually expressed?*

The project is for Georgia Tech's LMC 4730, Design Experiment 2 — Image and Identity. The final submission deadline is Friday, November 13, 2026, at 11:59 p.m. The working prototype should ideally be completed on Thursday, November 12, leaving Friday for writing and documentation.

---

## 2. Design Philosophy

Prioritize the following qualities:

- **Tactile interaction:** Digital stamping should behave like manipulating a physical object rather than clicking an ordinary UI button.
- **Playfulness and discovery:** Users should discover creative possibilities by experimenting with gestures.
- **Expressive freedom:** There should be no required final composition or correct way to use the stamp.
- **Minimalism:** The interface should be visually quiet, allowing the stamp and ink to be the focus.
- **Clear visual feedback:** Every gesture should visibly influence the resulting impression.
- **Small scope:** One focused interactive experience, not a complex drawing application.

The interaction philosophy draws inspiration from playful physical-to-digital experiences, including the original Peel-to-Reveal experiment. However, **do not reuse peeling, uncovering, or layered-reveal mechanics**.

The new project must have a distinct interaction and concept.

---

## 3. Stage One — Design Your Stamp

When users enter the experience, they are invited to create their own identifying symbol.

Suggested introductory copy:

**Make Your Mark**

*Every mark begins with a symbol. Draw something that represents you.*

### Drawing interface

Provide a small, dedicated canvas representing the engraved face of a stamp.

Users should be able to:

- Draw freely with their mouse, trackpad, or pointer.
- Erase portions of their drawing.
- Clear the design.
- Undo their most recent drawing action.
- See a live preview of the resulting stamp.

Use a simple monochrome design for the stamp artwork. The final ink color can be applied during stamping rather than permanently baked into the original drawing.

A circular or square boundary may communicate the idea of a physical stamp, but it should not unnecessarily restrict what users can draw.

The custom drawing must be retained accurately when converted into the stamping tool. Avoid replacing the user's drawing with a generic icon, preset, or simplified approximation.

### Completing the stamp

Provide a primary action such as:

**Use This Stamp**

This transitions the experience to Stage Two.

The user's original symbol should remain accessible as a small preview while stamping. This allows them to compare the original mark with the different impressions they create.

Include a way to return to the design stage without unexpectedly losing their artwork.

---

## 4. Stage Two — Make Your Mark

The user now encounters a blank, paper-like drawing surface and their custom stamp.

The stamp should feel like an object being manipulated, not a conventional Photoshop brush.

Users can position it, press it down, drag it, and rotate it.

There are **four core gesture behaviors**, which must work together without requiring users to switch between separate tools.

### Gesture A — Quick Tap

**Action:** Move the cursor to a location and quickly click and release.

**Expected result:** A light, slightly translucent stamp impression.

Requirements:

- Short interactions leave relatively faint impressions.
- The original pattern remains visible.
- Pressing and releasing has a subtle physical animation.
- The stamped image appears to transfer onto the paper.
- Each additional tap creates another impression.

This is the simplest and most intuitive stamping action.

### Gesture B — Long Press

**Action:** Click and hold the mouse button while keeping the cursor relatively stationary.

**Expected result:** The impression gradually darkens as the stamp remains pressed against the paper.

Requirements:

- Ink opacity increases smoothly with the duration of the press.
- Users can see the impression becoming darker while holding.
- The effect has a reasonable maximum saturation.
- Releasing lifts the stamp and stops the ink transfer.
- Quick taps and long presses should produce visibly different impressions.

Think of this as maintaining contact between inked rubber and paper.

Do not make darkness change only after release. The gradual accumulation is important visual feedback.

### Gesture C — Press and Drag

**Action:** Hold the mouse button and move the cursor across the paper.

**Expected result:** The stamp produces a continuous or closely connected trail of its pattern, similar to using a patterned marker.

Requirements:

- Ink deposits along the entire cursor path.
- Fast and slow movement should produce coherent, continuous results.
- Dragging should preserve the user's original symbol as the underlying pattern.
- Overlapping portions of the trail can become darker.
- The resulting composition should feel expressive rather than merely duplicating widely separated stamp icons.

For example, users should be able to write letters, draw curves, make spirals, or create illustrations using their custom pattern.

**This behavior is particularly important.** It transforms the stamp from a reproduction tool into an expressive drawing instrument.

### Gesture D — Press and Twist

**Action:** Hold the mouse button to press the stamp against the paper, then scroll the mouse wheel.

**Expected result:** The stamp rotates while maintaining contact, continuously transferring ink as its orientation changes.

Requirements:

- Mouse-wheel input controls the stamp's rotation while pressed.
- Rotating deposits successive overlapping orientations of the original stamp.
- The resulting impression can form circular, radial, or spirograph-like patterns.
- Clockwise and counterclockwise scrolling should rotate in opposite directions.
- The system must visibly accumulate ink during rotation.
- Rotation should feel smooth and responsive.
- The mouse wheel must not scroll the webpage while actively twisting the stamp on the canvas.
- Normal page scrolling should remain available outside the active stamping interaction.

Provide a simple keyboard fallback for trackpad users if wheel-based twisting is unreliable, such as holding the stamp and pressing the left/right arrow keys to rotate.

**Important:** This is not simply rotating the final stamped image after it has been created. The stamp is rotating *while making contact*, producing a new composite impression as it moves.

### Combined gestures

The four behaviors should be part of one coherent interaction system.

A user should be able to:

- Press and hold to darken an impression.
- Begin dragging without releasing.
- Twist using the wheel while still pressed.
- Continue dragging with the new orientation.
- Release to finish the mark.

These transitions should feel natural rather than requiring mode switches.

---

## 5. Ink and Physical Feedback

A major goal is to make the experience feel tactile.

The ink should have some physical character without requiring an elaborate physics simulation.

Prioritize:

- Progressive opacity accumulation.
- Subtle variation in ink coverage.
- Slight imperfections along stamped edges.
- Natural-looking overlapping impressions.
- Smooth rendering during dragging and twisting.
- A subtle visual indication that the stamp is lifted versus pressed.

Keep the original user-designed shape recognizable when appropriate, but allow the user to distort or abstract it through gesture.

Do not artificially prevent people from making messy or unrecognizable impressions.

The important principle is **user control over the expressive outcome**.

For the initial version, use one carefully chosen ink color, such as a traditional deep stamp red. Additional color selection is optional and should not distract from completing the interaction.

Avoid excessive particle effects, simulated splashes, or elaborate 3D physics unless the core stamping behavior is already excellent.

---

## 6. Visual Design and Layout

Create a clean, modern, minimalist experience.

### General visual direction

- Soft neutral background.
- Large paper-like canvas.
- Restrained typography.
- Generous whitespace.
- Subtle shadows and depth.
- Minimal instructional text.
- No unnecessary navigation or decorative elements.

The page should feel like a focused creative experiment, not a dashboard or enterprise design tool.

### Stage One layout

The user's custom stamp drawing area should be visually prominent.

Show a short instruction and only the necessary editing controls.

### Stage Two layout

The paper surface should dominate the screen.

Place the original stamp preview and minimal tools in a small toolbar or side area.

The interface should allow users to concentrate on the physical interaction.

Provide brief instructions for the gestures, but keep them unobtrusive.

### Microinteractions

Use thoughtful transitions when:

- The stamp moves onto the paper.
- The stamp is pressed or lifted.
- The stamp rotates.
- The user transitions between stages.
- A composition is cleared or exported.

Favor subtle, responsive motion over elaborate animation.

---

## 7. Canvas Controls and Export

Provide these essential controls:

- Undo last stamping gesture.
- Clear the paper canvas.
- Return to edit the stamp.
- Export the finished composition as a PNG.

Undo should treat an entire continuous press/drag/twist session as one action, rather than forcing users to undo every tiny ink deposit individually.

Export should include the completed artwork on the paper background, without toolbars, cursors, or other interface elements.

The exported PNG should have sufficient resolution for documentation and sharing.

Additional controls such as redo or changing ink colors may be added only if they are straightforward and do not delay the core experience.

---

## 8. Technical Implementation

First inspect the existing repository, if one exists, and follow its structure where sensible.

Otherwise, create a lightweight standalone application using a suitable modern frontend setup, such as Vite, React, and TypeScript.

Use HTML Canvas for the drawing and stamping behavior. No backend or authentication is necessary.

### Recommended architecture

Maintain separate data or layers for:

1. The original user-drawn stamp.
2. The finished paper artwork.
3. The temporary cursor/stamp preview and press feedback.

The original stamp artwork must remain unchanged while the user creates impressions.

Use pointer events for press, release, and movement, and appropriate wheel events for rotation.

Capture the pointer during stamping to avoid losing an interaction when the mouse temporarily leaves the canvas.

Use offscreen canvas or another suitable approach to transform the user's custom image and deposit it onto the paper.

### Performance and responsiveness

- Account for high-density displays and device pixel ratio.
- Keep drawing smooth during fast dragging.
- Avoid gaps in ink trails by interpolating between pointer positions.
- Avoid excessive redraws or memory usage.
- Keep stamp orientation consistent across movement and wheel inputs.
- Clean up event handlers and gesture states correctly.
- Prevent accidental text selection and unwanted browser dragging.
- Test mouse-wheel and trackpad input where practical.

The experience should be primarily optimized for desktop browsers, particularly Chrome on macOS.

Touch support is welcome if easy, but not required for the initial deadline.

### Technical correctness

A drawing made on the stamp-design canvas must appear faithfully in the transferred impression, including its transparent areas.

Ink darkness should respond to dwell time rather than merely changing at random.

Twisting must generate an accumulated composite image, not just a single rotated stamp.

Avoid stamp trails that become disconnected when the cursor moves quickly.

Preserve users' work when transitioning between design and stamping stages.

---

## 9. Academic Intent — Design Experiment 2

This project is designed for the assignment **Image and Identity**.

The central question of the assignment is:

*How can a purposeful design intervention change the way identity is represented, communicated, or experienced?*

### Existing condition

Traditional stamps and personal seals can function as identifying marks or symbols of authorship.

Their conventional use emphasizes consistent, recognizable reproduction of a fixed design.

### Purposeful intervention

This project changes the stamp from a primarily reproductive tool into an interactive expressive instrument.

The user contributes to the final image in two ways:

**Layer One: Symbol creation**

The user draws a personal identifying mark.

**Layer Two: Gesture-based expression**

The user determines how that mark appears through pressing, holding, dragging, and twisting.

A single symbol can therefore generate many visually different impressions and compositions.

### Meaning and identity

The experiment investigates the distinction between a symbol's identity and its expression.

It does not claim that a stamped impression reveals someone's personality.

Instead, it asks whether an identifying symbol can also incorporate the creator's actions, choices, and expressive gestures.

The intervention challenges the expectation that a stamp's primary purpose is to reproduce the same mark accurately.

### Relevant design concepts

**DRL — Purposeful Innovation:** Transforming a familiar image-making convention to enable new kinds of expression.

**DRL — Contextual Awareness:** Considering the existing use of personal stamps, seals, and identifying marks, without falsely treating all stamping traditions as culturally interchangeable.

**DRL — Systematic Approach:** Developing and testing repeatable interaction rules that allow users to produce varied outcomes.

**Audience agency:** The participant's physical gestures directly change the visual result. Interaction is consequential rather than decorative.

Cas Holman's approach to open-ended play is relevant to the freedom to experiment without one correct outcome. Ruth E. Carter's work is relevant more broadly to the idea that deliberate visual choices communicate identity.

Do not turn the website into a long educational explanation of these concepts. The experience should stand on its own.

---

## 10. Process Documentation

The assignment requires **two to four pieces of process evidence**, in addition to the final artifact and a 250–350-word rationale.

Make it easy to capture genuine development evidence.

Useful milestones include:

1. An early sketch or initial functional stamp-drawing prototype.
2. The first functional tap/hold stamping implementation.
3. A revision exploring drag and twist behavior.
4. The final version showing different impressions created from one symbol.

Where possible, save screenshots or actual development artifacts to a `docs/process/` directory with brief notes explaining the change.

Do not fabricate early prototypes, testing observations, or screenshots.

Keep short notes about what worked, what required revision, and any unexpected results. These will help the user write the rationale on Friday.

---

## 11. Implementation Priorities

Complete the project in this order:

**Priority 1 — Functional foundation**

Build both stages, allow users to draw a stamp, and transfer it to the paper.

**Priority 2 — Core gesture system**

Implement quick tap, long press, drag, and press-and-wheel twist. All four are part of the intended interaction.

**Priority 3 — Interaction quality**

Refine the way ink accumulates, improve the dragging and twisting feel, and eliminate rendering problems.

**Priority 4 — Supporting controls**

Implement undo, clear, stamp editing, and PNG export.

**Priority 5 — Presentation polish**

Improve typography, layout, subtle animation, and paper/ink appearance.

**Priority 6 — Documentation**

Capture actual process evidence and confirm the prototype is ready for a working-link submission.

Do not spend excessive time building decorative features while the stamping system remains incomplete.

If implementation constraints arise, prefer a simpler ink simulation with reliable gestures over an ambitious physical simulation that does not behave correctly.

---

## 12. Acceptance Criteria

The initial implementation is successful when:

- A user can freely draw their own stamp pattern.
- That exact pattern becomes the usable stamp.
- A quick click produces a light impression.
- Holding the stamp produces a progressively darker impression.
- Dragging produces a continuous patterned trail.
- Scrolling while pressed rotates the stamp and deposits overlapping ink.
- Gestures can transition naturally without changing modes.
- The paper retains the resulting composition.
- Users can undo, clear, edit the stamp, and export their artwork.
- The interface feels coherent, minimal, and satisfying.
- The project runs locally with clear instructions.
- Real development screenshots can be captured for the assignment.

Test the core gestures, including quick tap versus long hold, fast dragging, both twist directions, and combinations of drag and twist.

Fix any obvious failures before considering the implementation complete.

---

## 13. Scope Boundaries

Do not add the following unless requested later:

- User accounts or authentication.
- Online galleries or social sharing systems.
- Complicated brush libraries.
- Multiple paper environments or document types.
- Game mechanics, scoring, or achievements.
- Elaborate character narratives.
- A mandatory identity questionnaire.
- Complex 3D stamp simulations.
- Excessive tutorial screens.
- Additional gesture modes.

The goal is not to maximize the number of features.

**The goal is to make one custom stamp feel like an expressive physical object that users can manipulate in surprising ways.**

---

## 14. Execution Instructions

Implement the application in the current workspace rather than producing only a design proposal.

Make reasonable decisions independently when a detail is unspecified, while preserving the central experience and all four gestures.

After implementation:

1. Run the available build, type-checking, and relevant tests.
2. Test the user journey from drawing a stamp to exporting artwork.
3. Inspect the finished UI and refine obvious interaction or layout problems where possible.
4. Report what was implemented, what was tested, and any remaining limitations.
5. Provide clear instructions for running and optionally deploying the project as a static website.

Do not claim that a feature works unless it has been implemented and reasonably verified.

The user will review the interactive prototype and iterate on its feel and visual design.

**Final creative principle:**

*The stamp defines the mark. The gesture defines its expression.*

Build an experience where both matter.