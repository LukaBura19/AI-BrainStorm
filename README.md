# BrainStorm Booking

Web aplikacija za zakazivanje časova u **Edukativnom Centru BrainStorm**.

Klijenti biraju predmet, profesora, datum, vreme i trajanje časa (45 / 60 / 90 min), unose svoje podatke i dobijaju email potvrdu. Profesori i admini imaju svoje panele za upravljanje rasporedom.

---

## Tech stack

| Sloj | Tehnologije |
|------|-------------|
| **Frontend** | React 18, Vite 8, React Router 7 |
| **Backend** | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| **Baza** | PostgreSQL 16 |
| **Auth** | JWT (python-jose), Passlib + bcrypt |
| **Email** | ugrađeni SMTP servis — MailHog lokalno, bilo koji SMTP nalog u produkciji |
| **Infra** | Docker Compose (lokalni razvoj) |
| **Testovi** | pytest, FastAPI TestClient, Playwright E2E |

---

## Struktura projekta

```
AI-BrainStorm/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/            # Rute (admin, teacher, public, auth)
│   │   ├── core/           # Config, security, dependencies
│   │   ├── db/             # Engine, session, seed
│   │   ├── models/         # SQLAlchemy ORM modeli
│   │   ├── schemas/        # Pydantic request/response sheme
│   │   ├── services/       # Poslovna logika (availability, classroom, email)
│   │   └── utils/
│   ├── tests/              # pytest testovi
│   ├── alembic/            # Migracije baze
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── pages/          # Stranice (Booking, Login, Dashboard...)
│   │   ├── components/     # UI komponente (Stepper, Alert, Spinner...)
│   │   ├── services/       # API pozivi (api.js)
│   │   ├── hooks/          # Custom React hookovi
│   │   └── styles/         # CSS varijable i global stilovi
│   ├── package.json
│   └── Dockerfile
├── docs/                   # Dokumentacija
│   ├── mvp-plan.md         # Poslovna pravila, arhitektura, entiteti
│   └── mvp-tickets.md      # Backlog sa redosledom implementacije
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Brzo pokretanje (Docker Compose)

### Preduslovi

- [Docker](https://docs.docker.com/get-docker/) (>= 20.x)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

### 1. Kloniraj repo

```bash
git clone <url-repozitorijuma>
cd AI-BrainStorm
```

### 2. Kopiraj env fajl

```bash
cp .env.example .env
```

> Za lokalni razvoj default vrednosti su dovoljne — ne moraš ništa menjati.

### 3. Pokreni sve servise

```bash
docker compose up --build
```

Ovo pokreće 4 kontejnera:

| Servis | URL | Opis |
|--------|-----|------|
| **Frontend** | http://localhost:5174 | React aplikacija |
| **Backend API** | http://localhost:8002 | FastAPI + Swagger UI |
| **PostgreSQL** | localhost:55432 | Baza podataka (sa hosta; u mreži `postgres:5432`) |
| **MailHog** | http://localhost:8036 | Web UI za pregled emailova |

### 4. Migracije baze

Backend ih automatski primenjuje pri pokretanju. Za ručno pokretanje koristi:

```bash
docker compose exec backend alembic upgrade head
```

### 5. Seed (admin + test podaci)

```bash
docker compose exec backend python -m app.db.seed
docker compose exec backend python -m app.db.seed_luka_test_data
```

Prva komanda kreira predmete, admin nalog i odobrene profesore. Druga je
ponovljiva i dodaje Luki raspoloživost od 08:00 do 20:00 za narednih 14 dana,
bez dupliranja postojećih termina.

Test pristupi:

| Uloga | Email | Lozinka |
|-------|-------|---------|
| Admin | `admin@brainstorm.com` | `admin123` |
| Profesor Luka Bura | `lukabura89@gmail.com` | `profesor123` |

> Pre produkcije obavezno promeni podrazumevanu admin lozinku i `SECRET_KEY`.

### 6. Otvori aplikaciju

- **Aplikacija:** http://localhost:5174
- **API docs (Swagger):** http://localhost:8002/docs
- **Emailovi:** http://localhost:8036

---

## Razvoj

### Backend (FastAPI)

Backend se automatski reload-uje pri svakoj izmeni fajla (uvicorn `--reload`).

```bash
# Pokreni samo backend + bazu
docker compose up backend postgres

# Pogledaj logove
docker compose logs -f backend

# Pristupi Python shell-u
docker compose exec backend python
```

### Frontend (React + Vite)

Frontend koristi Vite HMR — svaka izmena se odmah vidi u browseru.

```bash
# Pokreni samo frontend
docker compose up frontend

# Pogledaj logove
docker compose logs -f frontend
```

### Migracije baze (Alembic)

```bash
# Primeni sve migracije
docker compose exec backend alembic upgrade head

# Kreiraj novu migraciju
docker compose exec backend alembic revision --autogenerate -m "opis_promene"

# Vrati poslednju migraciju
docker compose exec backend alembic downgrade -1
```

### Testovi

Testovi koriste zasebnu bazu (`brainstorm_test`) koja se automatski kreira.

```bash
# Pokreni sve testove
docker compose run --rm backend python -m pytest tests/ -v

# Pokreni samo availability testove
docker compose run --rm backend python -m pytest tests/test_availability_service.py -v

# Pokreni sa kratkim outputom
docker compose run --rm backend python -m pytest tests/ --tb=short

# Kompletan browser E2E: booking, prilog, emailovi, otkazivanje i paneli
cd frontend
npm install
npm run test:e2e
```

E2E očekuje da Docker servisi rade na podrazumevanim adresama i da je Luka
prethodno dobio termine pomoću `seed_luka_test_data`. Alternativne adrese mogu
se zadati kroz `E2E_BASE_URL` i `MAILHOG_URL`, a putanja do Chrome/Chromium
browsera kroz `CHROME_PATH`.

### Resetovanje baze

```bash
# Obriši sve podatke i volume
docker compose down -v

# Ponovo pokreni
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.db.seed
```

---

## Environment varijable

| Varijabla | Default | Opis |
|-----------|---------|------|
| `POSTGRES_USER` | `brainstorm` | PostgreSQL korisnik |
| `POSTGRES_PASSWORD` | `brainstorm_local` | PostgreSQL lozinka |
| `POSTGRES_DB` | `brainstorm_booking` | Ime baze |
| `DATABASE_URL` | auto-generisan | Pun connection string |
| `SECRET_KEY` | `change-me-...` | JWT secret (promeni za produkciju!) |
| `ALGORITHM` | `HS256` | JWT algoritam |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Trajanje tokena (8h) |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5174` | Dozvoljeni CORS origini |
| `FRONTEND_URL` | `http://localhost:5174` | Za linkove u emailovima |
| `APP_TIMEZONE` | `Europe/Belgrade` | Zona u kojoj centar prikazuje i računa termine |
| `MAIL_SERVER` | `mailhog` | SMTP server |
| `MAIL_PORT` | `1025` | SMTP port |
| `MAIL_USERNAME` | *(prazno)* | SMTP username |
| `MAIL_PASSWORD` | *(prazno)* | SMTP password |
| `MAIL_FROM` | `noreply@brainstorm.com` | Email pošiljalac |
| `MAIL_ENABLED` | `true` | Uključuje slanje notifikacija |
| `MAIL_TIMEOUT_SECONDS` | `10` | SMTP timeout |
| `MAIL_TLS` | `false` | TLS za SMTP |
| `MAIL_SSL` | `false` | SSL za SMTP |
| `MAIL_DELIVERY_MODE` | `smtp` | `smtp` za pravi server; `capture` za test server. MailHog/Mailpit se prepoznaju automatski. |
| `VITE_API_URL` | `http://localhost:8002` | API URL za frontend |
| `ADMIN_EMAIL` | `admin@brainstorm.com` | Seed admin email |
| `ADMIN_PASSWORD` | `admin123` | Seed admin lozinka |

### Email u produkciji

**Podrazumevani MailHog samo čuva poruke na http://localhost:8036. Ne prosleđuje
ih u Gmail ili druga stvarna sandučeta.** Rezervacija u tom režimu vraća
`status=captured`, `sent=0` i broj poruka u polju `captured`. Korisnik vidi
da slanje emaila nije podešeno i može da sačuva link za otkazivanje.

PostHog služi za analitiku proizvoda, a ne za transakcione potvrde termina.
Aplikacija zato ima sopstveni SMTP sloj i ne zavisi od PostHog-a. Za produkciju
unesi podatke stvarnog SMTP naloga u lokalni `.env`, na primer:

```dotenv
MAIL_SERVER=smtp.provajder.rs
MAIL_PORT=587
MAIL_USERNAME=brainstorm
MAIL_PASSWORD=promeni-me
MAIL_FROM=zakazivanje@tvoj-domen.rs
MAIL_ENABLED=true
MAIL_TLS=true
MAIL_SSL=false
MAIL_DELIVERY_MODE=smtp
```

Za port 465 se uobičajeno koristi `MAIL_SSL=true` i `MAIL_TLS=false`. Nemoj
uključiti oba režima istovremeno. Nakon promene pokreni ponovo backend sa
`docker compose up -d --no-deps --force-recreate backend`. Sam `restart` ne
učitava izmenjene Compose environment promenljive. Lozinku čuvaj u `.env`,
bez upisivanja u repozitorijum ili poruke. `MAIL_FROM` mora biti adresa koju
SMTP provajder dozvoljava; primer `noreply@brainstorm.com` nije povezan nalog.
`ADMIN_EMAIL` je i primalac admin obaveštenja, pa za njih treba stvarna adresa.

Provera konekcije, TLS-a i podešene prijave **bez slanja poruke**:

```bash
docker compose exec -T backend python -m app.check_email
```

Jedna test poruka na sopstvenu adresu, bez rezervacije i obaveštavanja profesora:

```bash
docker compose exec -T backend python -m app.check_email --to tvoja-adresa@domen.rs
```

Izlazni kod je `0` za uspešnu SMTP proveru/prihvaćenu test poruku, `1` za
grešku ili isključeno slanje, a `2` za lokalni test server. Provera bez `--to`
ne proverava dozvolu pošiljaoca ni prijem poruke. Tek poruka u stvarnom
prijemnom ili Spam sandučetu potvrđuje prijem.

API vraća `sent`, `partial`, `failed` ili `captured`. `sent` znači da je pravi
SMTP server prihvatio poruke; naknadno odbijanje ili spam filtriranje provajdera
nije potvrda koju aplikacija može da dobije iz SMTP odgovora. Browser E2E
testovi koriste **MailHog**, a ne pravi SMTP nalog, i proveravaju test poruke.

#### Gmail nalog

Za Gmail koristi `MAIL_SERVER=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_TLS=true`,
`MAIL_SSL=false` i `MAIL_DELIVERY_MODE=smtp`. `MAIL_USERNAME` i `MAIL_FROM`
su puna Gmail adresa. `MAIL_PASSWORD` je Google App password za tu aplikaciju.
Potreban je nalog sa uključenom verifikacijom u dva koraka:
[Google uputstvo](https://support.google.com/mail/answer/185833),
[kreiranje App password-a](https://myaccount.google.com/apppasswords).

Dok lozinka nije uneta, koristi `MAIL_ENABLED=false`: aplikacija radi i čuva
rezervacije bez pokušaja slanja. Posle unosa lozinke postavi `MAIL_ENABLED=true`,
ponovo kreiraj backend prethodnom komandom i pokreni proveru sa `--to` na
sopstvenu adresu. Pristupni podatak unosi samo u lokalni `.env`.

---

## Poslovna pravila

- **Trajanja časa:** 45, 60 ili 90 minuta
- **Učionice:** 2 (velika i mala) — automatska dodela, prioritet učionica 1
- **Max simultanih časova:** 2 (po jedan u svakoj učionici)
- **Otkazivanje:** minimum 24h pre početka časa
- **Profesori:** moraju biti odobreni od admina pre korišćenja sistema
- **Email notifikacije:** klijent, profesor i admin dobijaju email pri rezervaciji i otkazivanju
- **Vremenska zona:** svi termini i rokovi računaju se u `Europe/Belgrade`, dok se u bazi čuvaju u UTC-u
- **Prilozi:** najviše 10 PDF/slikovnih fajlova, do 25 MB po fajlu; proverava se i sadržaj fajla, ne samo ekstenzija

## Dokumentacija

- [MVP Plan](docs/mvp-plan.md) — Kompletan opis sistema, arhitektura, entiteti, API moduli
- [MVP Tiketi](docs/mvp-tickets.md) — Backlog sa svim tiketima i statusom

---

## API pregled

| Grupa | Prefix | Auth | Opis |
|-------|--------|------|------|
| Public | `/public/*` | ❌ | Predmeti, profesori, termini, booking, cancel |
| Auth | `/auth/*` | ❌ | Login za admin i profesora |
| Teacher | `/teacher/*` | 🔐 JWT | Dashboard, bookings, cancel, availability |
| Admin | `/admin/*` | 🔐 JWT | CRUD predmeti/profesori, bookings, reassign, cancel, učionice |

Detaljna API dokumentacija: http://localhost:8002/docs (Swagger UI)
