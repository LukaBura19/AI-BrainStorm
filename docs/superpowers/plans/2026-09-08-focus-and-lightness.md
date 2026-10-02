# BrainStorm focus and lightness implementation plan

> Use subagent-driven-development for isolated form implementation and review. Existing user authorization is autonomous: no questions, commits, worktree moves or deployment. Preserve the shared untracked workspace. Root performs independent page integration and all Chrome checks.

**Goal:** Keep the approved home video intact while giving its greeting and booking action proper emphasis, refine booking proportions, lighten the interface, redesign time selection and the details form, and animate introductory headings.
**Architecture:** Existing React pages and booking state remain authoritative. Shared TypewriterText handles accessible visual typing; booking presentation components consume the existing controlled values. No new dependencies.
**Spec:** Latest user request following Screenshot from 2026-09-08 20-42-01.png. Earlier requests apply where not superseded.

## Global constraints

- Do not change MouseScrubVideo.jsx/.css, the media assets, their color grade or any video behavior. Hero greeting retains its exact Serbian text and existing 38ms/600ms typing behavior.
- Remove the blurred introduction, secondary hero links and copy-email button. Keep only a larger Zakaži svoj čas linking to /booking. Preserve navbar/footer routes and authentication.
- Booking state, effects, API calls, submitted IDs, slots, durations, validation, attachment callbacks/limits, cancellation and reset remain unchanged. Demo professors remain labeled and disabled.
- New central booking width is about 860px, overall shell at most1370px; no viewport-filling minimum height. Keep separate summary on desktop and its existing mobile behavior. Retain 320px usability.
- Navy, purple, pink and white only. More white on surfaces, borders and controls without touching the approved video. The form returns to tinted purple/navy sections with white inputs, not the previous full pale three-column document.
- Public page and step headings type in, with full accessible text, reserved final dimensions, cleanup, and reduced-motion instant text. Inputs, errors, availability and actions never wait for typing.
- All browser tests use API fixtures; never run booking.spec.js or send a live reservation/email. Only root runs Chrome. Baseline: /tmp/brainstorm-before-focus-refinement.

## Task 1: Details form (isolated implementer)

Files: components/BookingDetailsForm.jsx/.css only. Same controlled props and every field ID/callback as baseline. Root owns parent integration and titles.
- [x] Recompose three sections into contact and learning stacked in the main column, with an intentional materials column on sufficiently wide containers; stack all three on narrow screens.
- [x] Use purple/navy glass, white field surfaces, pink focus and restrained depth. Compact section numbering and headings, generous input spacing, all labels persist. A small live name/initial treatment may remain.
- [x] Preserve every input/select/textarea/upload/drop/remove interaction, field hints, errors and optional indicators. Keep input font16px and target44px. Constrain long names and files within the parent.
- [x] Build and report exact file/callback checks. Root owns fixture and visual checks. Review isolated diff before acceptance.

## Task 2: Home and shared introductory typography (root)

Files: HomePage.jsx/.css, new components/TypewriterText.jsx/.css, primary title markup in all page components.
- [x] Reuse useTypewriter without changing its implementation. TypewriterText has a static accessible string and hidden layout reserve plus decorative displayed text. Use keyed text instances; headings speed28ms/start120ms, existing hero untouched.
- [x] Home removes intro and all secondary pills/email. Enlarge greeting to clamp(34px,3.3vw,68px), use the left half with inset clamp(28px,6.25vw,160px). On mobile use full content width and smaller32px text while keeping the character visible.
- [x] Larger white/pink booking CTA, minimum72px desktop,62px mobile, arrow in circular inset and restrained hover sweep/lift; reduced motion supported.
- [x] Apply TypewriterText to primary page headings and StepHeading titles; preserve accent emphasis through an optional accent string. No animation of data rows, labels or error text.

## Task 3: Booking proportions, lightness, people and time selection (root)

Files: BookingPage.jsx/.css, BookingRefinements.css, LessonFormatVisual.jsx/.css, Layout.css, optional new BookingTimeChoices component.
- [x] Constrain shell1370px, central card860px, summary270px, progressrail150px, actual-content height. Adapt existing internal grids to the constrained named container so nothing depends on a2560px viewport for internal fit.
- [x] Add scoped white lighting and more opaque pale lavender accents outside home; strengthen text contrast and brighten central card/header details. Use a white nonhome navigation surface and keep the branded sidebar recognizable; home navigation remains unchanged.
- [x] Session artwork displays one central person for individual and adds two side people for group (3total); animation stays contained and respects reduced motion. Delivery artwork unchanged.
- [x] Replace time ticket styling with a day overview: header shows chosen date/duration, grouped morning/afternoon/evening start-time options, all actual slots retained in order. Each button clearly includes its actual end time; a calm selected-interval summary gives start/end and duration. No additional navigation step or availability rules.

## Task 4: Verification and review (root)

- [x] Update obsolete home-pills and full-width assertions to the latest requirements. Keep real video regression checks and all eight-step/attachment/conflict/empty-teacher checks. Add meaningful assertions for person count, smaller card bounds and stable accessible heading typing.
- [x] Run focused RED checks for changed rendering. Pure CSS refinements use existing visual/bounds checks instead of implementation-mirroring unit tests.
- [x] Build, run the four safe fixture suites on standard5174, using the identical local production build when the host Docker daemon is unavailable, inspect actual desktop and320/375px screenshots, verify approved video/source hashes and booking/backend invariants.
- [x] Obtain spec/quality and final integration review, resolve supported findings and recheck affected areas. Finish on the existing live local preview.

Research: Calendly's scheduling-page design prioritizes recognizable day/time availability; Carbon's form patterns recommend grouped related fields, clear labels and logical reading order. Here this informs presentation while the existing eight steps remain intact.
