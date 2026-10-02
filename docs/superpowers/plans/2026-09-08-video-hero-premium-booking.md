# Video hero and premium booking implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated implementation and review. User authorization is autonomous and explicit; no approval pauses, commits, deployment or live submissions. Root coordinates serial Chrome use.

**Goal:** Replace the rejected brain comparison with the exact supplied mouse-controlled video concept in BrainStorm colors, and substantially redesign the requested booking steps.
**Architecture:** Home uses native video and a small React typewriter hook. Existing Layout receives home-only header/overlay styling. Booking presentation stays separate from its state, API and validation; the rich contact form becomes a focused component.
**Tech stack:** Existing React/Vite app, code-native CSS/SVG and existing router. New hero uses React and CSS only. No framework migration or new UI dependencies. H.264 encoding of the exact supplied HEVC clip makes it playable in the app's supported browser.
**Spec:** Latest user message of 2026-09-08, including the complete Mainframe reference, adapted to BrainStorm brand, routes and contact details. This supersedes the previous two-brain home comparison. Earlier booking behavior and navy/purple/pink/white palette remain binding.

## Global constraints

- Work in the shared workspace; preserve all untracked pre-existing work. Baseline `/tmp/brainstorm-before-video-hero`. No backend/env/SMTP, booking logic, API, validation, attachment limits, existing teacher IDs, schedule, cancellation, reset or submission changes.
- Exact reference video is `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4`; root provides the same clip transcoded to `/assets/brainstorm-interface.mp4` and original-frame poster `/assets/brainstorm-interface-poster.jpg`. Recolor with CSS, preserving the source character/scene. Original logo assets stay untouched.
- All copy is Serbian Latin and all user-facing branding is BrainStorm. Use existing real routes and `edukativni.centar.brainstorm@gmail.com`. No fabricated claims or real bookings for demonstration teachers.
- Keep full-width app, prominent booking action, usable keyboard/touch navigation and 320px layout. Respect reduced motion and document visibility; clean listeners/timers on unmount. Animation objects remain inside their panels.
- Root owns API-fixture/browser tests and all Chrome sessions. Never run `booking.spec.js` or the full e2e suite because it includes live mail. Agents do not spawn children.

## Task 1: Mouse-controlled reference video hero

Exact font links: https://db.onlinewebfonts.com/c/5ac3fe7c6abd2f62067f266d89671492?family=HelveticaNowDisplay-Medium and https://db.onlinewebfonts.com/c/1aa3377e489837a26d019bba501e779d?family=HelveticaNowDisplayW01-Rg. Variables: --font-heading uses HelveticaNowDisplay-Medium, --font-body uses HelveticaNowDisplayW01-Rg, both followed by Helvetica Neue, Arial, sans-serif.


**Owner/files:** Faraday: `HomePage.jsx/.css`, new `MouseScrubVideo.jsx/.css`, `hooks/useTypewriter.js`, home-specific `Layout.jsx/.css`, `index.html` font links. Do not touch BookingPage, BookingForm, shared palette, backend or tests.
**Interface:** Home renders `.home-hero-layout` as the full-width hero and `.home-booking-cta` as the booking Link. Video uses `.home-background-video`; source/poster above. Keep existing BrandLogo, navigation, login/logout destinations and controls.

- [x] Replace both home brains with fixed fullscreen video: object-fit cover, object-position 70% center, muted, playsInline, preload auto, no autoplay/loop. Use the supplied video, with navy/purple color grade and pink accents. A dark gradient ensures text readability without hiding the character. Show the original poster if media is unavailable.
- [x] Mouse scrub uses window mousemove, previous X, `delta / innerWidth * 0.8 * duration`, a clamped latest target and exactly one seek at a time; seeked drains the latest pending target. Ignore invalid duration. No video playback loop. Provide deliberate touch horizontal scrub without blocking vertical scrolling and keyboard/range control. Reduced motion disables incidental mouse following; deliberate keyboard/touch input remains usable. Pause offscreen/hidden and clean all listeners/RAF/timers.
- [x] Implement `useTypewriter(text, speed=38, startDelay=600)` returning displayed/done. Stop/cancel on unmount, pause when hidden, show full text under reduced motion. Keep a full accessible text alternative so screen readers do not hear every character. Reserve the final text's height to prevent layout jumps.
- [x] Match reference composition: minimal fixed header across the viewport; original BrainStorm logo left, simple large desktop navigation and action, full-screen navy mobile menu with animated three-line toggle. Existing login/logout menu remains functional. Home-only styles must not leak into booking/admin pages. Footer stays reachable without creating another marketing section.
- [x] Load both supplied Helvetica links in index.html; set font-heading/font-body variables and use them on the hero and home navigation, with safe Helvetica Neue/Arial fallbacks. Retain original logo artwork. Intro uses the requested 4px blur with accessible text, then clear typewritten Serbian greeting at clamp(18px,4vw,26px), max-width about36rem. Mobile content toward the bottom; desktop vertically centered with character to right.
- [x] Four action pills appear after 400ms independently of typing: Zakaži svoj čas (`/booking`, dominant), Pogledaj cenovnik (`/cenovnik`), Upoznaj BrainStorm (existing main-site URL), Pošalji poruku (mailto). Outline email pill copies the supplied Gmail address and gives clear success/failure feedback. Small screens must fit the email. No dead links or new pages.
- [x] Build and write report `.superpowers/sdd/2026-09-08-video-hero-premium-booking/task-1-report.md`; include resource/loading/input lifecycle, exact files and actual check results. Root performs browser acceptance. No Chrome until root schedules it.

## Task 2: Professor examples, lesson-format composition and time intervals

**Owner/files:** Root: BookingPage presentation, new `LessonFormatVisual.jsx/.css`, `BookingRefinements.css`, optional `TeacherPreviewCards.jsx`. No root edits to Task 1 or Task 3 owned files during implementation.
**Interfaces:** Keep displayedTeachers and real teacher handlers unchanged. Demonstration cards are UI-only and explicitly marked `Primer profila`, never used for teacher_id or availability. Keep `.booking-option-card` native controls/aria-pressed for all four existing options. Keep `.booking-slot-start strong` and `.booking-slot-end` with exact actual times.

- [x] Show five extra demonstration people alongside real available teachers: Pera Perić, Ana Jovanović, Marko Petrović, Milica Nikolić, Nikola Ilić. Use polished monogram/abstract portrait treatments and real subject context, no invented qualifications/rating/contact details. They can animate on hover but cannot submit bookings. Empty real-teacher state must remain intact.
- [x] Rebuild step 4 into TWO large independent sections side by side on desktop: Način održavanja and Tip časa. Each has an ample contained animated illustration, clear heading, two native choices and a description for the selected choice. Preserve delivery callback's slot clearing and session callback exactly. Stack only when content width cannot support two panels. Native selected/focus states remain unambiguous.
- [x] Give each format illustration a deliberate dimensional composition (classroom/video-call window; individual/group learning), gentle bounded float and response to the actual selected mode. No rotating escaped lucide icon or old small tile layout. Decorative objects aria-hidden; CSS reduced/hidden motion gates.
- [x] Refine step 6 into an interval composition: equal readable start/end times labeled Početak/Završetak, a connecting line and a visible duration badge. Preserve all actual timestamps, ordering, handlers and 08–20 rules. Retain calendar styling, pink selection and graceful grids at12/23 slots and320px.

## Task 3: Premium details form

**Owner/files:** Halley: create `components/BookingDetailsForm.jsx` and `.css` only. Root replaces the old step-7 form body with this component after delivery; do not edit BookingPage or old BookingForm.css.
**Interface:** `BookingDetailsForm({clientName,clientEmail,clientCategory,clientNote,formErrors,setClientName,setClientEmail,setClientCategory,setClientNote,setFormErrors,selectedSubject,selectedDuration,categories,attachmentFiles,setAttachmentFiles,attachmentInputRef,dragActive,setDragActive,addAttachments,maxAttachments})`.

- [x] Replace the rejected triple dark raised-card appearance with one composed pale lavender/white form workspace inside the existing main card. Keep three identifiable contact/learning/material panels, aligned when space permits and stacked within the parent on small screens. Use the named `booking-content` container, not viewport assumptions.
- [x] Use editorial hierarchy, large deliberate section numbering, navy text, restrained fine borders, spacious inset fields, pink focus rails and subtle depth. A tasteful live name/initial treatment may echo typed contact data but adds no validation or required field. Avoid toy-like gradients, extruded badges and generic repeated cards.
- [x] Preserve all current fields and IDs: client-name, client-email, client-category, client-note; same name/email/category error reset callbacks, autocomplete/inputMode, category values, note maxLength1000, optional status and error text. No new required information. Keep all file picker/drop/remove callbacks, 10-file/25MB/type limits in parent behavior. Own file-size formatting can remain a presentation helper.
- [x] Make the materials area intentional: large contained folder/sheets composition, sophisticated drag state and readable file rows. Keep all fields/files inside the parent at320/375/768/1024/1440/1920px. Labels/errors accessible, touch targets at least44px, text16px inputs, reduced-motion behavior.
- [x] Build, self-review against baseline handlers, and write `.superpowers/sdd/2026-09-08-video-hero-premium-booking/task-3-report.md`. No Chrome until root schedules it.

## Task 4: Integration, tests and review

**Owner/files:** Root: e2e safe design tests, native video asset, form integration, plan ledger and review packages. Baseline preservation hashes and comparisons.

- [x] Before implementation, add a browser test requiring an actual paused video and mouse-seek behavior; run it against old home to establish the missing-video failure. Pure CSS changes use existing meaningful visual/bounds tests, without implementation-mirroring unit tests.
- [x] Replace obsolete two-brain home assertions with video semantics, successful decode and seek serialization/clamping, independent CTA/typewriter timing, reduced motion, fallback, mobile overlay/login and clipboard. Keep unchanged subject motion and booking coverage. Fixture tests must never hit live public submissions.
- [x] Verify all eight steps at1440/375/320, all payload/attachment fields, occupied slot and empty teacher recovery, UI-only demonstration IDs, option containment and two desktop panels, equally legible interval times, complete form bounds and 23 slots. Inspect actual screenshots before acceptance.
- [x] Run build, verify source/backend scope, obtain both spec and quality task reviews and one broad final review. Resolve findings and recheck affected behavior. Leave http://localhost:5174 running. User receives the concrete completed design, no confirmation question.

## Final evidence

- All26safe browser checks passed in4.1minutes, using the separate localVite5175after the DockerDesktop outage. Browser artifacts: `/tmp/brainstorm-video-final-checks`. No live submissions ormail.
- Final production build passed. The existing lazyThree.js summary chunk retains Vite's size advisory; the new home loads a native video and does not import the prior home brains.
- Task1,2,3and final integration spec/quality reviews approved. All findings resolved. Root inspected final1888/375home,1440step4and6,1440form plus filled1920/320form screenshots.
- Booking state/effects/API/validation/reset, success/cancellation rendering and all extracted field/file callbacks match the turn baseline. All65backend source hashes unchanged.
- The unavailable DockerDesktop engine was restarted after repeated API500and ping failures, to restore the standard local app. No Docker settings,images,volumes,backend orenvironment files were changed. Runtime health verification is pending below.

Runtime acceptance: Docker Desktop's existing user service was started through systemd after the CLI restart's process did not persist. Existing containers recovered; backend and PostgreSQL are healthy. The actual app at `http://localhost:5174` passed a final read-only browser check: native paused video decodes and scrubs to2.02s,8actualsubjects load, Luka Bura plus5disabled examples render, both public GET requests return200, and there are zero page errors. No live booking was submitted. Actual home capture: `/tmp/brainstorm-final-home-1440.png`. All required work complete.
