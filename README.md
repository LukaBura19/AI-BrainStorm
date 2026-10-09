# BrainStorm Booking

Web aplikacija za zakazivanje časova u **Edukativnom Centru BrainStorm**.

Klijenti biraju predmet, profesora, datum, vreme i trajanje časa (45 / 60 / 90 min), unose svoje podatke i dobijaju email potvrdu. Profesori i admini imaju svoje panele za upravljanje rasporedom.
Na stranicama za malu i veliku maturu su snimci rešenih zadataka, a uz svaki snimak AI asistent (Claude) kome učenik postavlja pitanja o zadacima.

---

## Tech stack

| Sloj | Tehnologije |
|------|-------------|
| **Frontend** | React 18, Vite 8, React Router 7 |
| **Backend** | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| **Baza** | PostgreSQL 16 |
| **Auth** | JWT (python-jose), Passlib + bcrypt |
| **Email** | ugrađeni SMTP servis — MailHog lokalno, bilo koji SMTP nalog u produkciji |
| **AI asistent** | Claude API (`anthropic` Python SDK), odgovor se strimuje u browser (SSE) |
| **Infra** | Docker Compose (lokalni razvoj) |
| **Testovi** | pytest, FastAPI TestClient, Playwright E2E |

---

## Struktura projekta

```
AI-BrainStorm/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/            # Rute (admin, teacher, public, auth, student, prep)
│   │   ├── data/           # Katalog snimaka za pripreme (prep_lectures.json)
│   │   ├── core/           # Config, security, dependencies
│   │   ├── db/             # Engine, session, seed
│   │   ├── models/         # SQLAlchemy ORM modeli
│   │   ├── schemas/        # Pydantic request/response sheme
│   │   ├── services/       # Poslovna logika (availability, classroom, email, katalog, asistent)
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
| Profesor i admin Luka Bura | `lukabura89@gmail.com` | `profesor123` |
| Učenik Mina Petrović (test) | `mina.petrovic@example.rs` | `ucenik123` |
| Novi učenik | napravi nalog na `/ucenik/prijava` → „Napravi nalog“ | min. 8 karaktera |

Luka postoji i kao profesor i kao admin (isti email i lozinka u obe tabele). Prijava
na bilo koji od ta dva panela vraća i token za drugu ulogu (`linked_tokens`), pa meni
„Moj panel“ i dugme u zaglavlju panela nude prebacivanje profesor ⇄ admin bez nove
prijave. Druge osobe sa jednom ulogom ne vide tu opciju.

### Paneli po ulogama

- **Učenik** (`/ucenik/panel`): istaknut sledeći čas (mesto, adresa, rok za
  besplatno otkazivanje), tabovi Predstojeći / Održani / Otkazani, otkazivanje
  sa razlogom direktno iz kartice, „Zakaži ponovo“ sa već izabranim predmetom i
  profesorom, izmena imena i nivoa obrazovanja i prečice ka pripremama za maturu.
- **Profesor** (`/teacher/dashboard`): raspored za narednih 7 dana po danima,
  dostupnost za više dana odjednom (kalendar od 4 nedelje i prečice
  prepodne/popodne/ceo dan) sa pregledom već zakazanih časova u svakom bloku,
  svi časovi (predstojeći, održani, otkazani) i otkazivanje sa razlogom.
- **Administrator** (`/admin/dashboard`): raspored dana po učionicama i online,
  rezervacije sa filterima i pretragom, prebacivanje časa drugom profesoru ili u
  drugi termin (svi dobijaju email „Izmena termina“), otkazivanje bez roka od 24h,
  profesori (odobravanje, izmena, predmeti), učenički nalozi i predmeti.

Učenici se sami registruju. Časovi zakazani dok je učenik prijavljen vezuju se za
njegov nalog i vide se u panelu „Moji časovi“ (`/ucenik/panel`), sa linkom za
otkazivanje. Časovi zakazani bez prijave se ne prikazuju u panelu, čak ni ako je
email isti, da niko ne bi mogao da vidi tuđe časove registracijom na tuđu adresu.

### Snimci predavanja i AI asistent (mala i velika matura)

Stranice `/mala-matura` i `/velika-matura` čitaju katalog iz
`backend/app/data/prep_lectures.json`: ispit → predmet → oblast → snimak → zadaci.
Mala matura ima srpski i matematiku podeljene na osnovni, srednji i napredni nivo,
a velika matura matematiku po oblastima (algebra, trigonometrija, logaritmi...).
Svaki snimak ima svoju stranicu, npr. `/mala-matura/matematika/procenti`, sa
videom, zadacima sa snimka i asistentom pored videa.

Novi snimak ili nova oblast dodaju se samo u JSON, bez izmene koda:

```json
{
  "slug": "razlomci-2",
  "title": "Razlomci, 2. deo",
  "summary": "Množenje i deljenje razlomaka.",
  "youtube_id": "dQw4w9WgXcQ",
  "duration_minutes": 42,
  "tasks": [
    { "text": "Izračunaj 2/3 · 9/4.", "solution": "2/3 · 9/4 = 18/12 = 3/2." }
  ]
}
```

`youtube_id` je deo YouTube linka posle `watch?v=` (11 znakova); umesto njega
može `video_url` sa direktnim linkom na video fajl, a za snimke koje niko ne sme
da kopira `vdocipher_id` (vidi [Zaštićeni snimci](#zaštićeni-snimci-drm-bez-preuzimanja-i-sa-crnim-ekranom-pri-snimanju)).
Bez videa stranica prikazuje „Snimak stiže uskoro“. `slug` mora biti jedinstven
u okviru predmeta. Rešenja (`solution`) se ne prikazuju na sajtu: dobija ih samo
asistent, da bi proverio postupak učenika i davao tačne rezultate. Posle izmene
JSON-a restartuj backend (`docker compose restart backend`).

### Zaštićeni snimci (DRM): bez preuzimanja i sa crnim ekranom pri snimanju

Snimak upisan kao `youtube_id` ili `video_url` može da se preuzme i snimi sa
ekrana kao i svaki drugi video na internetu. Za snimke koje ne želiš da iko
kopira koristi `vdocipher_id`: video se otprema na
[VdoCipher](https://www.vdocipher.com) (DRM hosting za e-učenje), a na sajtu se
pušta kroz Widevine/FairPlay DRM, istu zaštitu koju koristi Netflix. Fajl nikad
ne stiže u pregledač u celini i dešifruje se tek u zaštićenom delu uređaja, pa
ne može da se sačuva ni alatima za skidanje videa. Skrinšot i snimanje ekrana
daju crn ekran tamo gde uređaj to podržava: Windows (Chrome, Edge, Firefox) na
većini računara, Safari na Mac-u, iPhone-u i iPad-u (kad je na nalogu uključen
FairPlay) i Android telefoni (VdoCipher to uključuje na nalogu na zahtev, piše se
njihovoj podršci). Na Mac-u u Chrome-u i Firefox-u i na Linux-u crn ekran nije
moguć, ni kod Netflixa. Telefon uperen u ekran uvek može da snimi sliku. Zato
preko svakog snimka ide i vodeni žig: na promenljivom mestu slike ispisuje se ime
i email prijavljenog učenika (za gosta IP adresa), pa se zna odakle je kopija
snimljena telefonom ili drugim uređajem.

Podešavanje:

1. Napravi nalog na VdoCipher-u (ima besplatnu probu, posle se plaća DRM plan).
   Otpremi snimak u kontrolnoj tabli i prepiši njegov *Video ID* (32 znaka).
2. U kontrolnoj tabli pod *Config → API Keys* klikni *Generate API Key* i upiši
   ključ samo u lokalni `.env`:

   ```dotenv
   VDOCIPHER_API_SECRET=...
   ```

3. Snimku u `prep_lectures.json` dodaj `"vdocipher_id": "<Video ID>"` umesto
   `youtube_id` i pokreni `docker compose up -d --no-deps --force-recreate backend`.

Pri svakom otvaranju stranice backend svojim tajnim ključem traži od VdoCipher-a
jednokratnu propusnicu (OTP) i pregledaču vraća samo adresu plejera, pa ključ
nikad ne napušta server. Propusnica važi 5 minuta i plejer sa njom radi samo na
domenu iz `FRONTEND_URL` (sa `www.` ili bez), zato `FRONTEND_URL` mora imati
`https://` i domen. Bez domena se zaštićeni snimci ne puštaju, a u logu piše
zašto. Jedna IP adresa može zatražiti najviše 120 propusnica u 10 minuta. Ako
backend stoji iza reverse proxy-ja, upiši IP adresu proxy-ja u
`FORWARDED_ALLOW_IPS`, inače svi posetioci izgledaju kao jedna adresa. Snimak
ne sme imati i `vdocipher_id` i `youtube_id` ili `video_url`, jer bi se preko
javnog linka mogao preuzeti; backend tada odbija katalog. Bez ključa zaštićeni
snimci javljaju „Snimak trenutno nije dostupan“, a ostatak sajta radi.

**Asistent** koristi Claude API. Ključ se pravi na
[platform.claude.com](https://platform.claude.com) i upisuje samo u lokalni `.env`:

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

Zatim `docker compose up -d --no-deps --force-recreate backend`. Bez ključa sve
stranice rade, a asistent piše da još nije uključen. Model je `claude-opus-5-5`
(`CHAT_MODEL`), sa `CHAT_EFFORT=medium` kao kompromisom između kvaliteta, brzine
i cene. Uključeni su i rezervni modeli na serveru (`fallbacks: "default"`): ako
model odbije zahtev, Claude API ga u istom pozivu ponovi na modelu koji Anthropic
preporučuje za tu vrstu zahteva. Svaki odgovor se plaća po potrošenim tokenima;
potrošnja i model koji je odgovorio upisuju se u backend log. Jedna IP adresa
može poslati najviše `CHAT_RATE_LIMIT` poruka u `CHAT_RATE_WINDOW_SECONDS`
sekundi (podrazumevano 30 u 10 minuta). Razgovor se čuva samo u browseru
učenika (sessionStorage) dok je kartica otvorena.

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
| `ANTHROPIC_API_KEY` | *(prazno)* | Ključ za Claude API; bez njega je asistent isključen |
| `CHAT_MODEL` | `claude-opus-5-5` | Model asistenta |
| `CHAT_EFFORT` | `medium` | `low`/`medium`/`high`/`xhigh`/`max`: temeljnost naspram brzine i cene |
| `CHAT_RATE_LIMIT` | `30` | Najviše poruka sa jedne IP adrese u prozoru |
| `CHAT_RATE_WINDOW_SECONDS` | `600` | Dužina prozora za `CHAT_RATE_LIMIT` |
| `VDOCIPHER_API_SECRET` | *(prazno)* | API ključ sa VdoCipher-a; bez njega zaštićeni snimci (`vdocipher_id`) nisu dostupni |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | IP adresa reverse proxy-ja kome backend veruje za pravu IP adresu posetioca |
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
su puna Gmail adresa. `MAIL_PASSWORD` je Google App password za tu aplikaciju:
16 slova koje Google prikaže u grupama od po četiri (razmaci se ignorišu).
Obična lozinka Gmail naloga ne radi: Gmail odbije prijavu i zatvori vezu, a
`check_email` tada javlja „SMTP prijava je odbijena (kod 535)“.
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
