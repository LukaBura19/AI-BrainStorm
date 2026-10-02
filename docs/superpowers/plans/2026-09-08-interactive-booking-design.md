# Interactive BrainStorm design

> **For agentic workers:** Execute in this workspace with superpowers:executing-plans; review with superpowers:requesting-code-review. User explicitly authorized implementation without questions.

**Goal:** Refine the existing home page and every booking screen using the user's September 8 screenshots and instructions.

**Architecture:** Keep React, existing routes, API calls, validation and booking state. Reuse the original transparent logo, add small presentation components for science-themed interactions and a responsive summary, and replace page styling without touching backend or SMTP settings.

**Tech Stack:** React 18, Vite, motion/react, lucide-react, CSS, Playwright.

**Spec:** Both September 8 user prompts plus nine screenshots and the original pink running-brain logo. Existing palette is approved. Home retains hero and subject strip; remove the manifesto and every following marketing section. Increase the booking CTA. Brain reacts to movement/drag with layered mathematical, physical, chemical and programming notation. The booking summary lives separately on the right; it remains accessible on mobile. Only Luka Bura is presented while retaining actual API IDs and subject associations.

## Constraints

- Preserve `#091245` navy, existing purple/pink/white tokens and Inter/Outfit/Instrument Serif.
- No backend, database, SMTP or API changes; no external emails during design verification.
- Keep eight booking steps, duration values, slot availability, attachments, validation, submission, cancellation and admin/teacher access.
- Exact requested headings: Izaberi profesora; Izaberite dužinu i način časa; Podesi vrstu časa; Izaberi dan; Izaberi vreme; Unesite svoje podatke; Potvrdi rezervaciju.
- Use original transparent `frontend/public/assets/logo2.png`, matching the supplied reference. SVG viewBoxes frame its mark and wordmark without regenerating the logo.
- Support keyboard focus, touch, narrow screens and prefers-reduced-motion; avoid animations covering inputs or navigation.

## Implementation

- [x] Create `BrandLogo.jsx/.css` using the original asset and apply it to shared navigation/footer and confirmation. Frame the brain with SVG viewBox `400 240 480 290`; frame the wordmark with `330 575 660 66`.
- [x] Revise `BrainScene.jsx/.css`: spring-driven rotation and formula depth, drag and keyboard support, bounded tilt, visibility/pause handling. Keep existing glass-brain asset. Build valid notation such as `a² + b² = c²`, `E = mc²`, `H₂O` and `x => x ** 2` as text.
- [x] Shorten `HomePage.jsx/.css`, enlarge the CTA, keep subject strip, make the common footer compact on home/booking.
- [x] Add reusable `ScienceCard` and `BookingSummary` presentation components. Summary is sticky on desktop and a compact disclosure on mobile.
- [x] Revise booking markup and CSS, preserving handlers. Remove subject card helper text, apply requested headings, show Luka only when returned for the chosen subject, add iconography and duration fills, date/time cards and stronger form focus states.
- [x] Expand review and success tickets with readable lesson, contact, note and attachment details. Preserve mail status messages and cancel link.
- [x] Run `npm run build` in frontend and browser checks for all eight steps, mobile summary, pointer/reduced-motion, attachment validation and submission payload using intercepted APIs. Inspect desktop/mobile screenshots. Compare backend hashes with `/tmp/brainstorm-september8-before/backend-hashes.json`.
- [x] Independent code review and correct material findings. Update existing E2E selectors for requested labels without weakening their booking assertions.

## Verification boundary

The live backend currently has Gmail sending disabled after rejected credentials. Design tests must not change this or send messages. Use real read-only API data for layout inspection and browser fixtures for reservation/cancellation writes. No screenshot or passing local test constitutes SMTP delivery verification.

## Verification results — September 8

- Production build passes (`npm run build`).
- All 12 design browser tests pass with intercepted booking APIs, including full eight-step flows at 1440, 375 and 320 px, attachment payload and success details, occupied-slot recovery, empty teacher state, mouse/keyboard/touch interaction, reduced motion and navigation through 1888 px.
- After final visual polish, four focused tests passed on the original `http://127.0.0.1:5174` address. Desktop/tablet/mobile screenshots were inspected; the original logo is explicitly clipped to avoid the source wordmark leaking through letterboxing.
- Review findings fixed: touch/pen drag with vertical scrolling, pause for CTA pseudo-elements, exact logo clipping and meaningful collapsed summary text. Screen transitions now focus and reveal the next panel after long forms.
- All 61 backend file hashes match the pre-design snapshot. Booking loaders, validation, attachment handling, submission and reset functions match the snapshot; API/date utilities and palette tokens are unchanged.
- Docker Desktop briefly lost its VM connection during the first browser run. Restarting its user service restored the existing containers; API and database health report OK. No volumes or application settings were changed.
- The existing mobile navigation test and a final full desktop fixture flow also pass on port 5174 (2/2).
- No real booking or email was created by design tests. Email delivery remains outside this design verification.
