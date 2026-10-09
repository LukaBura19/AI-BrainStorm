#!/bin/sh
# Vercel build za servis "api" (vercel.json): migracije i početni podaci pre nego što nova verzija
# krene da radi. Vercel ga pokreće iz backend/, u Python okruženju, posle instalacije zavisnosti.
set -eu

: "${DATABASE_URL:?Nema baze: u Vercel projektu dodaj Neon (Storage), pa ponovo pokreni deploy.}"
: "${SECRET_KEY:?Postavi SECRET_KEY u Settings, Environment Variables (nasumičan tekst, 32+ znaka).}"
: "${SEED_PASSWORD:?Postavi SEED_PASSWORD: lozinka za početne naloge (admin, profesori) na ovom serveru.}"
# Repo je javan: podrazumevani ključ ili kratak ključ bi svakome dali da napravi važeći token.
if [ "$SECRET_KEY" = "change-me-to-a-random-secret-key" ] || [ "${#SECRET_KEY}" -lt 32 ]; then
  echo "SECRET_KEY mora biti nasumičan tekst od najmanje 32 znaka." >&2
  exit 1
fi

# Migracije idu direktnom vezom (Neon pooler ne podržava sve što Alembic radi); aplikacija koristi DATABASE_URL.
export DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
alembic upgrade head
# ponytail: test podaci na svakom deploy-u (seed preskače postojeće); izbaci ove dve linije kad sajt krene sa pravim korisnicima.
python -m app.db.seed
python -m app.db.seed_luka_test_data
