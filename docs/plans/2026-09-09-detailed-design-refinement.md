# Detailed BrainStorm design refinement

Implement the user's eight screenshot instructions from 2026-09-09. No approval pause is required; changes are authorized and reversible. Current source is the baseline. Snapshot: `/tmp/brainstorm-before-detailed-refinement-2026-09-09`.

## Global constraints

- Preserve booking state, API calls, validation, availability, uploads, professor identities, authentication and backend/environment configuration.
- Preserve the approved hero video asset and mouse/touch scrubbing; remove its visible position control as requested.
- Maintain navy, purple and pink with modest periwinkle highlights. No whole pale booking workspace or pale form.
- Keep the right summary size, existing subject/calendar design and two lesson-format panels. Slightly widen the left progress rail and narrow the middle panel.
- Keep keyboard focus, labels, mobile containment and reduced-motion support. No real booking or email submissions during verification.
- Header appearance and left-aligned brand/navigation must be shared across routes. Remove the footer.
- All booking step titles type character by character without changing layout or accessible names.

## Implementation tasks

1. Shared header and hero: real logo + equally sized/colored “Edukativni centar BrainStorm” lettering, left adjacent menu, improved login; new welcome/motivational greeting, larger animated booking CTA; remove video position UI/footer.
2. Booking presentation: wider rail/modestly smaller colorful panel, actual logo in summary, remove all specified helper copy. Add animated initials and multiple teaching subjects. Duration only number/title. One individual/three group figures. Preserve date tiles. Vertical large start time/end beneath. Replace verbose full-date displays with compact numeric dates in essential reservation details.
3. Details form (isolated ownership): three distinct tinted cards, functional titles “Kontakt”, “O času”, “Materijali”, contemporary readable controls and restrained relevant motion. Preserve every prop, callback, field, limit, error and upload action.
4. Verification: source diff against snapshot, safe existing browser flows with updated expectations, inspect home and booking screens at desktop/mobile, production build and independent source review.

## Acceptance checklist

- [x] Brand, left menu, login and shared header; no footer.
- [x] Welcome copy, typing, prominent animated CTA; approved video; no position UI.
- [x] Rail/panel balance and modest color; summary actual logo; unwanted helper copy removed.
- [x] Professor animated initials and multiple subjects; all step titles type.
- [x] Duration descriptions/recommendation removed.
- [x] Individual figure count 1, group count 3; description removed.
- [x] Calendar preserved; description removed.
- [x] Large start time above end; verbose date/subtitle removed.
- [x] Three separate tinted form cards, simple titles, animations and existing behavior.
- [x] Build, safe UI flows, responsive visual inspection and source review.
