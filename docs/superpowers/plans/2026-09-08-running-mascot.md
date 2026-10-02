# Running brand mascot and richer booking design

> Execute with superpowers:subagent-driven-development. The user has already authorized autonomous design changes without questions. Use snapshot diffs because this live workspace has no commits.

**Goal:** Replace the anatomical brain with a polished running 3D mascot inspired by the exact BrainStorm logo, then enrich subject cards, date choices and the contact form.

**Architecture:** Keep the lazy Three.js lifecycle and input controller, replacing the fetched anatomy with a lightweight procedural articulated mascot. Keep booking state and API code untouched; enrich presentation with subject-specific decorative formula groups, a redesigned date tile and grouped form panels.

**Spec:** The user's latest message in this conversation, together with the preserved full-width design and earlier approved pink/purple/navy/white palette and all booking behavior.

## Global constraints

- Preserve the fullscreen layout, original logo artwork, current palette/font tokens, manual360-degree rotation, mouse/touch/keyboard/reset controls, pause/reduced-motion/hidden/offscreen handling and WebGL fallback.
- Do not modify backend, .env, SMTP, database, API contracts, booking IDs/filter, dates/times, validation, attachment limits, submission/reset/cancellation or add required form data. Richer form means presentation, not more fields or registration.
- No actual bookings or emails during verification. Native controls must remain usable at320px.
- Keep the hero booking CTA prominent and fully visible on desktop. Do not add lower marketing sections.

### Task 1: Running brand mascot

**Files:** components/BrainScene.jsx/.css, components/brain3d/createBrainScene.js, new components/brain3d/createRunningMascot.js as needed, public/assets/running-brain-fallback.svg if needed.
**Input:** Existing BrainScene({paused=false,compact=false}) and original logo at public/assets/logo2.png (running mark crop395235490300 of1280x1024).
**Output:** Same scene contract/data-renderer/data-state/data-angle-y. Add data-character="brand-runner" and a rendered run-phase diagnostic for integration checks. A named procedural mascot group with update(time) gives a meaningful animation test surface.

- [x] Replace MRI anatomy with rounded stylized pink brain lobes, deliberate magenta grooves/highlights, burgundy bent arms/legs, pink fists and elongated shoes like the logo. No cerebellum/stem, eyes or unrelated character face. This must look like a brand mascot rather than a biological model. Keep visible depth all around.
- [x] Animate an articulated continuous running gait: opposite arms/legs, knee/elbow bends, body bob/lean, small motion trails/shadow. Keep a clear three-quarter default view and gentle science motion; manual rotation still works. Freeze automatic gait when paused/reduced/hidden/offscreen; reduced motion retains deliberate rotation.
- [x] Replace programming formula with a legible syntax-colored if/else block, such as `if (znaš) { reši(); } else { pitaj(); }`, wrapped across lines so text fits the plaque. Retain other scientific plaques/objects.
- [x] Provide a fallback using the original brand mark, not the old biological brain image. Dispose generated geometries/materials/textures and stop callbacks as before. Remove the unused GLTF loading work from the live renderer.
- [x] Build, visually inspect the mascot/gait in Chrome, and write the task report. Root owns browser scheduling and regression tests.

### Task 2: Richer subject, date and form presentation

**Files:** components/ScienceCard.jsx, pages/BookingPage.jsx presentation/helpers only, pages/BookingPage.css; new scoped presentation components/styles if clearer.
**Input:** Existing actual subject.name, getNextBookingDates result, selected states and existing contact/upload controls.
**Output:** Same booking handlers/fields and native card buttons; each subject card contains several subject-related decorative formulas, stronger date typography, richer form composition.

- [x] Add4–5 relevant formula/symbol/word fragments per subject card, arranged in multiple depths around the main icon/title. Examples: math∑/π/x²+y²/√/a²+b²=c²; physicsF=ma/E=mc²/λ/Δt; chemistryH₂O/CO₂/NaCl/CH₄; programmingif/else/{}/const/return; language cases/word pairs/characters relevant to that language. Avoid repeating one generic formula everywhere. Idle drift is subtle; hover/focus brings layers forward. Decorative content is aria-hidden and noninteractive. Pause CSS animation offscreen/hidden and honor reduced motion; maintain readable titles.
- [x] Redesign date tiles with a much larger day number, prominent weekday and month, subtle calendar-page structure/header/details and dimensional selection animation. Preserve exactly the available dates, ordering, selected-state callbacks and calendar grid behavior.
- [x] Redesign the existing contact form as a composed workspace: section headers/numbers/icons, personal-info panel, learning context/note panel and a distinctive materials-upload panel. Improve spacing, surfaces, input focus treatment and typography. Keep current labels/IDs, optional status, fields, validation errors, attachment limits/removal and exact payload. Use current choices to decorate/contextualize, without adding required fields.
- [x] Verify build and compare all booking business code against snapshot. Write the task report; root verifies the complete fixture flow and mobile form.

### Task 3: Root integration and reviews

- [x] Snapshot current src/public/tests and backend hashes before implementation. Add meaningful mascot/gait and formula/date/form checks before accepting changes.
- [x] Run the existing17 design/spatial checks with only necessary assertions adapted to running rather than anatomical-idle behavior. Verify real WebGL, mouse/touch/keyboard, pause/reduced motion/fallback,8bookingsteps,320–2560widths.
- [x] Inspect front/running poses, subject cards, day tiles and form on desktop/mobile. Review task-scoped diffs and final integration, resolve findings and verify build/backend invariants.

## Review baseline

Snapshot: /tmp/brainstorm-before-running-mascot. Reports/diffs: .superpowers/sdd/running-mascot/. Renderer task and booking task are implemented sequentially; root prepares tests and reviews alongside useful local work. Existing completed agent threads may be reused because the harness has a fixed thread limit. No commits or deployment.
