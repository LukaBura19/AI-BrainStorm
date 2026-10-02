# Full-screen 3D BrainStorm redesign

> Execute the independent rendering and layout tasks with superpowers:subagent-driven-development. The user has explicitly authorized autonomous implementation without questions. Review using the pre-change snapshot because the repository has no commits and .git is read-only.

**Goal:** Replace the tilted brain picture with genuine 3D geometry and make the home and booking interfaces use the entire available viewport, honoring every earlier design request.

**Architecture:** A lazily loaded Three.js renderer owns the 3D model, lights, scientific objects and pointer/keyboard interaction. React retains the existing booking state and API behavior. Desktop layout has a full-width header and workspace, readable vertical step navigation, broad selection area and a separate summary at the right edge. Mobile adapts to an accessible stacked layout.

**Global constraints:**
- Preserve navy #091245, existing purple/pink/white palette tokens and existing fonts. Keep the original running-brain logo.
- Do not change backend, database, .env, SMTP, API request contracts, authentication, reservation validation, attachment handling, slot selection/reset rules or cancellation.
- Only show Luka Bura when returned by the API for the chosen subject.
- Headings: Izaberi predmet; Izaberi profesora; Izaberite dužinu i način časa; Podesi vrstu časa; Izaberi dan; Izaberi vreme; Unesite svoje podatke; Potvrdi rezervaciju; Vidimo se na času!
- No manifesto or lower home marketing sections; large animated Zakaži svoj čas CTA remains the main action.
- True WebGL 3D brain must show different anatomical surfaces after 180-degree rotation, including mouse/touch drag and keyboard. CSS-tilting an image does not satisfy this requirement.
- Science objects and formulas move in depth. Cards, icons and duration rings receive intentional CSS 3D motion; the number circles still fill on hover/focus/selection.
- On 1440/1920/2560 desktop widths, header/home/booking shell use at least 94% of viewport width with small consistent gutters, not max-width centered strips. Text line lengths can be constrained within full-width compositions.
- Keep all booking controls usable on 320px screens, keyboard access, reduced-motion and a real fallback when WebGL is unavailable. Stop continuous rendering offscreen/hidden/paused and dispose GPU resources.
- Verification must intercept reservation POSTs; no real emails or test reservations in the live backend.

## Tasks

- [x] Task 1: Build BrainScene genuine 3D renderer. Own BrainScene.jsx/.css and new components/brain3d runtime modules. Interface default BrainScene({ paused=false, compact=false }); full mode contains accessible model interaction, subtle idle rotation, readable world-space scientific formula plaques, orbiting atoms/brackets and lit 3D geometry. Compact mode fits a summary support region and hides verbose controls. Root supplies optimized CC0 model at /assets/brain-model.glb and installs Three.js. Expose data-renderer, data-state and current angle on scene for genuine 3D browser checks. Preserve existing fallback image only for load/context failures. Visual review plus pointer/touch/reduced-motion/fallback tests.
- [x] Task 2: Rebuild full-screen layouts and 3D card treatment. Own HomePage, Layout, BrandLogo CSS, BookingPage presentation only, BookingSummary, ScienceCard and Stepper. Full-width hero with large 3D scene, outsized booking CTA; compact full-width navigation/footer. Broad desktop booking composition uses a vertical step rail, expansive cards and the independent right summary; smaller layouts retain horizontal stepper and collapsible summary. Enlarge review/success with full-width compositions. Maintain every requested heading, teacher filter and handlers. Include quiet compact 3D scene in desktop summary if space permits. No main-page fixed max widths, no dead side gutters. Every step feels complete, not a small panel floating in a large void.
- [x] Task 3: Root integration: optimize/download/provenance of model, Three.js package and Docker dependency refresh, meaningful 3D/full-width/browser tests, screenshots at 320/375/768/1440/1920/2560. Run build and compare business code/back-end hashes to baseline. Independent review and addressed findings before completion.

## Interfaces and review evidence

Baseline: /tmp/brainstorm-before-fullscreen-3d/{src,public,e2e,package.json,package-lock.json,backend-hashes.json}.
Task reports: .superpowers/sdd/fullscreen-3d/task-1-report.md and task-2-report.md.
Task 1 and Task 2 share only the BrainScene React interface; no file overlap. Root owns assets/package/tests. Review uses snapshot diffs, not nonexistent commit ranges.
