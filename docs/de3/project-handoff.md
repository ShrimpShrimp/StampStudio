# Make Your Mark — DE3 Development Handoff

## 1. Project Background

This project is a continuation of Make Your Mark (StampStudio), originally developed for Design Experiment 2 in Georgia Tech's LMC 4730 Experimental Digital Art course.

Existing website:
https://shrimpshrimp.github.io/StampStudio/

Repository:
https://github.com/ShrimpShrimp/StampStudio

The existing experience allows users to design their own personal rubber stamp and apply it to a digital document. The stamping system simulates different physical behaviors, including:

- Custom stamp design and editing.
- Uneven ink transfer when placing a stamp.
- Localized pressure when pressing different areas of the stamp.
- Sliding and dragging.
- Rotation through scrolling.
- Speed-sensitive ink transfer.
- Ink accumulation and paper saturation.

DE2 explored how a fixed personal symbol could be expressed differently depending on the physical gestures used to apply it.

The existing interactions are physically convincing and interesting to experiment with. However, after discovering how the stamp behaves, there is relatively little motivation to return to the experience.

Rather than further expanding the stamping mechanics, DE3 will investigate whether giving those interactions a new purpose changes the audience's experience.

## 2. Experimental Question

How does introducing a shared, persistent canvas change the way people use a personal creative tool when their contributions become part of a collective artwork?

The existing experience positions the audience as an individual creator. Their actions affect their own document, and their creations remain isolated from other visitors.

The proposed intervention introduces a global stamp board, shifting the audience's role from an individual creator to a contributor to a collective artwork.

The goal is to investigate whether the presence of other people's contributions influences how participants design, position, and apply their own stamps.

This is an experimental art project, not a conventional social media platform.

## 3. Core Experience

Preserve the existing stamp design workbench and stamping mechanics.

Introduce two destinations within the experience:

### Personal Studio

Retain the existing DE2 document-stamping experience. Users should still be able to experiment privately with their stamps without affecting the global board.

### Global Stamp Board

Introduce a shared canvas that displays persistent stamp impressions contributed by previous visitors.

Users should be able to:

- View the existing collective artwork without creating an account.
- Design their own personal stamp using the existing editor.
- Bring that stamp onto the global board.
- Choose where and how to apply their stamp.
- Overlap or interact compositionally with previous contributions.
- Leave their contribution on the board for future visitors to encounter.
- Return later and discover how the artwork has evolved.

The board should be a single collective artwork rather than a gallery of separate individual submissions.

A participant's contribution should become part of the environment that subsequent participants encounter.

## 4. Interaction and Design Principles

### Preserve the stamping experience

Reuse as much of the existing stamp interaction system as reasonably possible. The physical qualities of the stamp are a distinctive part of the project and should not be replaced with a simple image-placement tool.

However, individual mechanics may need to be adapted to work within a shared environment.

### Allow creative freedom

Participants should be able to decide whether to:

- Find an empty space.
- Position their stamp alongside another person's contribution.
- Deliberately overlap existing impressions.
- Create patterns or compositions with existing marks.
- Apply their stamp in a recognizable or abstract manner.

Do not prescribe a specific artistic outcome.

### Persistent contributions

The global board should retain submitted contributions across browser sessions and different devices.

A participant should not be able to clear the entire board or erase other people's contributions.

Consider allowing undo for uncommitted local actions before submission.

### Finite shared space

For the initial experiment, use a large but finite canvas rather than an infinite workspace.

Limited space creates an opportunity to observe whether participants respect existing contributions, seek empty areas, overlap marks, or respond to the evolving composition.

Consider pan and zoom if the board becomes larger than the viewport.

### Ink colors

Introduce a small, curated selection of ink colors if appropriate. This could make the collective artwork more visually varied and allow participants to respond to existing compositions through color.

Avoid unnecessarily expanding the customization interface.

### Accessibility and simplicity

Avoid requiring accounts or complicated onboarding for the initial experiment.

Preserve the tactile, visually coherent aesthetic of the existing application.

The global board should feel like another physical surface within the studio, not a separate social media application.

## 5. Proposed User Flow

1. User enters Make Your Mark.
2. User designs or edits their personal stamp.
3. User chooses between the Personal Studio and Global Stamp Board.
4. In the global board, the user encounters existing contributions.
5. User selects an area and applies their stamp using the existing interactions.
6. User finishes and commits their contribution.
7. The contribution persists and becomes visible to other visitors.
8. User may continue stamping, return to the editor, or leave the experience.

This flow is a starting point. Adjust it if a more intuitive solution emerges during development.

Users should also be able to view the global board without first designing a stamp.

## 6. Technical Considerations

Before implementation, inspect the existing repository and understand its architecture, rendering system, interaction logic, and deployment workflow.

The existing application uses React, TypeScript, Vite, Canvas 2D, and GitHub Pages.

The current document state is local to each browser session. The global board introduces a new requirement for shared persistence.

Investigate an appropriate lightweight backend solution, such as Supabase or Firebase, taking into account:

- Compatibility with the existing GitHub Pages deployment.
- Free-tier limitations and operational costs.
- Persistent storage of stamp contributions.
- Concurrent submissions from multiple visitors.
- Efficient loading and rendering as the board grows.
- Basic protection against spam and destructive submissions.
- Ease of setup and maintenance.

Evaluate whether individual contributions should be stored as rendered transparent ink layers, structured gesture data, or another representation.

The storage approach should preserve the visual details of the existing stamping engine, including uneven impressions, overlapping ink, pressure variations, and rotation.

Avoid storing and overwriting an entire shared canvas for every contribution, since simultaneous users could overwrite one another's work.

Prefer an approach where contributions can be independently submitted and composited onto the board.

Real-time synchronization is desirable but not mandatory for the initial DE3 experiment. Reliable persistence across independent browsers is more important.

Do not expose administrative credentials or privileged backend keys in the frontend repository. Use appropriate authorization rules, server-side validation, submission limits, and safe handling of user-generated content.

If backend configuration, credentials, account creation, or deployment permissions are required, explain the necessary steps to the project owner. Do not pretend that persistence is functional before it has been configured and tested.

## 7. Scope of the Initial Prototype

Prioritize:

- Preservation of existing stamp creation and application mechanics.
- Navigation between the personal studio and global board.
- Viewing existing shared contributions.
- Applying a custom stamp to the board.
- Committing a contribution.
- Persistent storage and retrieval.
- Basic safeguards against destructive behavior.
- A coherent visual experience.

Do not prioritize:

- User profiles.
- Likes or reactions.
- Comments.
- Followers.
- Leaderboards.
- Competitive scoring.
- Complex account systems.
- Social media features.
- Unnecessary gamification.

The project should remain a small, focused experimental artwork.

## 8. Experimental Testing

DE3 explicitly requires testing and critical reflection.

Once the prototype is functional, it should support a comparison between the original personal studio and the global board.

The intended testing process will involve a small number of participants, potentially three to five people, interacting with both experiences.

Questions to investigate include:

- Do existing contributions influence where participants place their stamps?
- Do participants deliberately interact with other people's marks?
- Does knowing that other people will see their contribution change how they design their stamps?
- Do participants approach the shared board differently from their private document?
- Does the collective artwork give participants a greater sense of purpose or motivation to participate?

Do not assume that the global board will improve engagement. The experiment is intended to discover whether and how the audience's behavior changes.

Even if participants ignore existing contributions, avoid overlapping marks, or prefer the personal studio, those are potentially meaningful findings.

Technical testing should also verify that:

- Contributions persist after refreshing the page.
- Contributions appear in a separate browser or device.
- Multiple submissions do not overwrite each other.
- Existing stamp interactions continue to function.
- Failed submissions are handled without losing local work.
- The original personal studio remains functional.

Technical tests are not a substitute for participant testing.

## 9. Academic Context and Documentation

This project is being developed for Design Experiment 3 — Change the Audience's Role.

Due: December 1, 2026, at 11:59 p.m.

The assignment requires:

1. An experimental artifact or prototype.
2. Two to four pieces of process evidence.
3. A 250–350-word design rationale.
4. At least one documented test of the intervention.
5. Application of at least one relevant Design Remix Logic feature.

The most relevant course concepts are:

**Purposeful Innovation:** Changing the audience's role by giving existing stamping interactions a new collective purpose rather than introducing novelty for its own sake.

**Design Thinking Integration:** Using prototyping, observation, feedback, and revision to investigate whether the intervention changes the experience as intended.

**Janet Murray's concept of agency:** Providing meaningful actions whose consequences extend beyond the immediate interaction. In this experiment, a participant's contribution can influence the artwork that future visitors encounter.

Preserve meaningful development milestones and capture actual screenshots during implementation.

Potential process evidence includes:

- Initial global board design or prototype.
- Early integration of the existing stamp mechanics with the shared canvas.
- A documented test involving contributions from separate participants or browsers.
- A revision informed by observations or participant feedback.

Record what changed, why it changed, and what was observed.

Do not fabricate participant feedback or experimental findings. The project owner will conduct the audience testing.

## 10. Development Approach

Begin by reviewing the existing codebase.

Establish a practical implementation plan and proceed with the initial prototype. Preserve the existing DE2 experience and maintain compatibility with the current deployment where possible.

Make reasonable implementation decisions independently, but identify consequential decisions involving backend services, persistent data, costs, security, or changes to the core experience.

Document the implementation, setup requirements, testing procedures, and known limitations.

The objective is to create a functional, testable global stamp board that extends the existing project without overengineering it.

The central design principle is:

Do not simply give users more ways to stamp. Give them a different reason to stamp.