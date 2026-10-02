# BrainStorm visual redesign

**Goal:** Refresh every existing application screen with the former navy, purple, pink and white identity, animated glass elements and a prominent lesson-booking action.

**Architecture:** Keep React/Vite, existing routes, forms, API calls and business logic. Change shared design tokens, presentational components and page styles. Use Motion for entrance/parallax animation and a local generated brain asset. Do not migrate the application to a different language or CSS framework merely because the references use them.

**Design source:** User's two MotionSites references and `/tmp/brainstorm-home-before.png`. The screenshot's dominant navy is `#091245`; use magenta/purple accents, white text, translucent navy cards and Instrument Serif emphasis paired with Outfit/Inter.

**Authorization:** User explicitly requested autonomous implementation of the complete design, keeping functionality. Work directly in the provided workspace: there are no Git commits and all application files are untracked. A pre-change frontend snapshot is saved in `/tmp/brainstorm-design-baseline`.

## Implementation

- [x] Shared visual system: update `frontend/src/styles/{variables,global}.css`, keep semantic status colors legible, use reusable liquid-glass styles and respect reduced motion.
- [x] Navigation: update `frontend/src/components/Layout.{jsx,css}` with a floating glass pill, prominent booking link, animated menus and consistent footer. Preserve authentication and routing.
- [x] Homepage: replace `frontend/src/pages/HomePage.{jsx,css}`; add focused brain/reveal components. Include hero CTA, local sculptural brain, gentle pointer parallax, animated subject strip, three-step booking explanation, educational approach and closing CTA. Pause offscreen/hidden animation and offer animation pause.
- [x] Other screens: apply the same surface, typography, control and animation system to booking, pricing, teacher/admin login and dashboards, cancellation and 404. Keep booking steps, validation, attachment handling, pricing and all server behavior intact.
- [x] Verification: production build, real browser screenshots at desktop/mobile/tablet widths, no horizontal overflow, working mobile/keyboard navigation, reduced-motion/pause behavior, existing Playwright booking/auth flows where local services are available. Review the diff against the baseline to confirm business logic is unchanged.

## Validation commands

```sh
cd frontend
npm run build
npm run test:e2e
```

Visual checks use Playwright and the existing local Chromium installation. Any unavailable server-dependent check will be reported explicitly; do not change production data to satisfy a visual test.


## Verification outcome

- Production build passes.
- Original Playwright suite: **4/4 passed** against the real local API and MailHog, including individual online booking, group booking in a classroom, attachment downloads, notifications, cancellation and teacher/admin login.
- Browser visual checks: seven public routes at 320, 375, 768, 1024 and 1440 px; no horizontal overflow, main hero booking action in the initial viewport, no unexpected console or page errors.
- Additional browser checks with isolated API fixtures verified the eight-step form on desktop/mobile, validation, retained state when returning to the form, attachments, cancellation and both dashboards. Fixtures live only in `/tmp` and are not part of the application.
- Animation pause/resume, reduced-motion behavior, image loading, pointer parallax and mobile menu/Escape checked.
- Read-only independent review addressed paused marquee content accessibility and dropdown indicator contrast.
- Direct baseline comparisons confirm API client, date helpers, dashboard logic, cancellation logic and stepper logic are unchanged. Booking and login page JSX changes only add the glass presentation class.
- Brain asset is local transparent WebP, 565,818 bytes; the original generated image was 2.3 MB. No external reference videos are required.
- Docker Desktop lost connectivity to its VM during testing; restarting the existing user service restored all local services. The original application is available at `http://localhost:5174`.
