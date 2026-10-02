# BrainStorm Booking MVP Plan

## 1. Cilj sistema

Napraviti odvojenu web aplikaciju za zakazivanje casova za Edukativni Centar BrainStorm.

Glavni javni tok:

1. Korisnik klikne na dugme `Zakazi cas` na glavnom sajtu.
2. Otvara se posebna booking aplikacija.
3. Korisnik bira predmet.
4. Korisnik bira profesora.
5. Korisnik bira datum i vreme iz dostupnih termina.
6. Korisnik bira trajanje casa: `45`, `60` ili `90` minuta.
7. Korisnik unosi svoje podatke i komentar.
8. Sistem kreira rezervaciju i salje email obavestenja.

## 2. MVP scope

U MVP ulazi:

- javna rezervacija bez registracije klijenta
- izbor predmeta
- izbor profesora
- pregled slobodnih termina
- izbor trajanja casa: `45`, `60`, `90` minuta
- slanje emaila klijentu, profesoru i adminu
- profesor login
- profesor panel za dostupnost i pregled rezervacija
- admin login
- admin panel za upravljanje predmetima, profesorima i rezervacijama
- otkazivanje casa od strane klijenta, profesora i admina po pravilima
- lokalni razvoj i pokretanje sistema preko `docker compose`

Van MVP-a ostaje:

- online placanje
- SMS / WhatsApp / Viber notifikacije
- klijentski nalozi
- automatski podsetnici
- napredna analitika
- vise lokacija
- napredan raspored i optimizacija ucionica

## 3. Zakljucane poslovne odluke

Ove odluke su definisane i treba ih tretirati kao izvor istine za implementaciju:

- trajanje casa moze biti `45`, `60` ili `90` minuta
- profesor unosi slobodne raspone, na primer `09:00-14:00`
- sistem iz raspolozivih raspona racuna konkretne dostupne termine
- `90` minuta zauzima dva uzastopna `45` minuta slota
- ucionica se dodeljuje automatski
- prioritet dodele ucionice je:
  - prvo `ucionica 1` (velika)
  - zatim `ucionica 2` (mala)
- klijent i profesor mogu da otkazu cas minimum `24h` ranije
- ako je rok za otkazivanje probijen, sistem salje email da otkazivanje nije moguce i da cas mora biti naplacen
- admin moze rucno da prebaci rezervaciju drugom profesoru
- profesor mora da bude odobren od strane admina pre koriscenja sistema

## 4. Glavni moduli sistema

### 4.1 Javni deo

Koristi ga klijent:

- izbor predmeta
- izbor profesora
- izbor datuma
- izbor slobodnog termina
- izbor trajanja
- unos licnih podataka
- potvrda rezervacije

### 4.2 Profesor panel

Koristi ga profesor:

- login
- pregled svojih predmeta
- unos raspolozivosti za naredne dane
- pregled svojih rezervacija
- otkazivanje rezervacija ako je dozvoljeno

### 4.3 Admin panel

Koristis ga ti:

- pregled svih rezervacija
- pregled svih profesora
- odobravanje profesora
- upravljanje predmetima
- upravljanje povezanoscu profesor-predmet
- pregled zauzeca ucionica
- rucno otkazivanje ili prebacivanje casa drugom profesoru
- eventualno blokiranje termina

## 5. Poslovna pravila rezervacije

Ovaj deo treba kasnije direktno preneti u backend logiku i testove.

### 5.1 Pravila dostupnosti

- profesor moze biti rezervisan samo za predmet koji predaje
- termin moze biti ponudjen samo ako je profesor slobodan u tom vremenskom rasponu
- profesor ne moze imati dve rezervacije koje se vremenski preklapaju
- sistem racuna slobodne termine na osnovu raspolozivih raspona profesora

### 5.2 Pravila kapaciteta

- postoje najvise `2` casa u istom vremenskom periodu jer postoje `2` ucionice
- ako u datom periodu vec postoje `2` aktivna casa, novi cas nije moguce zakazati
- pri kreiranju rezervacije sistem automatski dodeljuje prvu slobodnu ucionicu:
  - `1`
  - `2`

### 5.3 Pravila trajanja

- `45` minuta koristi jedan `45` minutni slot
- `60` minuta zahteva kontinuiran slobodan raspon od `60` minuta
- `90` minuta zauzima dva uzastopna `45` minutna slota i mora da prodje proveru za oba

Napomena:

- posto profesor unosi proizvoljne raspone, backend ne treba da cuva samo staticke slotove iz UI-ja
- backend mora da proverava realni vremenski opseg rezervacije i sva preklapanja

### 5.4 Pravila statusa

Predlog statusa rezervacije:

- `confirmed`
- `cancelled`
- `cancel_rejected`

Za MVP rezervacija odmah ide kao `confirmed`.

### 5.5 Pravila otkazivanja

- klijent moze da otkaze preko bezbednog linka iz emaila
- profesor moze da otkaze iz svog panela
- admin moze uvek da otkaze ili prebaci rezervaciju
- klijent i profesor mogu da otkazu samo minimum `24h` pre pocetka casa
- ako je pokusaj kasniji od definisanog roka:
  - rezervacija ostaje aktivna
  - salje se email da otkazivanje nije moguce
  - naglasava se da cas mora biti naplacen

### 5.6 Pravila notifikacija

Posle uspesne rezervacije salju se emailovi:

- adminu
- profesoru
- klijentu

Posle uspesnog otkazivanja salju se emailovi:

- adminu
- profesoru
- klijentu

Kod neuspesnog otkazivanja salje se email podnosiocu zahteva sa objasnjenjem.

## 6. Predlog tehnickog stack-a

### 6.1 Frontend

- `React`
- `Vite`
- `React Router`
- opcionalno `Tailwind CSS` ili custom CSS

### 6.2 Backend

- `FastAPI`
- `SQLAlchemy`
- `Alembic`
- `Pydantic`
- `JWT` autentikacija za admina i profesora

### 6.3 Baza i infrastruktura

- `PostgreSQL`
- lokalni razvoj preko `docker compose`
- odvojeni servisi za frontend, backend i bazu

### 6.4 Mail servis

Predlog za kasnije:

- `Resend`
- ili `Mailgun`

Za lokalni razvoj moze privremeno:

- logovanje emailova u konzolu
- ili `MailHog` / slican lokalni mail catcher

## 7. Monorepo struktura

Predlozena struktura:

```text
AI-BrainStorm/
  frontend/
  backend/
  docs/
  docker-compose.yml
  .env.example
  README.md
```

Frontend struktura:

```text
frontend/
  src/
    app/
    pages/
    components/
    services/
    hooks/
    styles/
```

Backend struktura:

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
    utils/
    main.py
  alembic/
  requirements.txt
  Dockerfile
```

## 8. Predlog entiteta baze

### 8.1 `subjects`

- `id`
- `name`
- `is_active`
- `created_at`

### 8.2 `teachers`

- `id`
- `full_name`
- `email`
- `password_hash`
- `is_active`
- `is_approved`
- `created_at`

### 8.3 `admins`

- `id`
- `full_name`
- `email`
- `password_hash`
- `is_active`
- `created_at`

### 8.4 `teacher_subjects`

- `id`
- `teacher_id`
- `subject_id`

### 8.5 `teacher_availabilities`

Profesor unosi raspolozivost kao vremenske raspone.

- `id`
- `teacher_id`
- `subject_id` opcionalno, ako raspolozivost zavisi od predmeta
- `start_time`
- `end_time`
- `is_available`
- `created_at`

### 8.6 `bookings`

- `id`
- `subject_id`
- `teacher_id`
- `client_full_name`
- `client_email`
- `client_category`
- `client_note`
- `start_time`
- `end_time`
- `duration_minutes`
- `status`
- `classroom_number`
- `cancelled_by`
- `cancellation_reason`
- `client_cancel_token`
- `created_at`

## 9. API moduli koje treba planirati

### 9.1 Javni API

- `GET /subjects`
- `GET /subjects/{id}/teachers`
- `GET /teachers/{id}/available-slots`
- `POST /bookings`
- `POST /bookings/{id}/cancel`

### 9.2 Profesor API

- `POST /auth/teacher/login`
- `GET /teacher/me`
- `GET /teacher/bookings`
- `GET /teacher/availabilities`
- `POST /teacher/availabilities`
- `DELETE /teacher/availabilities/{id}`
- `POST /teacher/bookings/{id}/cancel`

### 9.3 Admin API

- `POST /auth/admin/login`
- `GET /admin/bookings`
- `GET /admin/teachers`
- `POST /admin/teachers`
- `PATCH /admin/teachers/{id}`
- `POST /admin/teachers/{id}/approve`
- `POST /admin/subjects`
- `PATCH /admin/subjects/{id}`
- `POST /admin/bookings/{id}/cancel`
- `POST /admin/bookings/{id}/reassign`

## 10. UI smernice prema postojecem sajtu

Na osnovu dostavljene slike sajta, booking aplikacija treba da prati isti vizuelni identitet.

### 10.1 Vizuelni pravac

- tamna ljubicasa pozadina
- jaka pink / magenta akcent boja
- beli tekst za glavni sadrzaj
- minimalisticki i moderan izgled
- dosta praznog prostora
- jasan fokus na CTA i step-by-step tok

### 10.2 Osnovni UI zahtevi

- aplikacija mora biti responsive
- booking flow treba da bude jasan i linearan
- forma mora biti laka za popunjavanje na mobilnom telefonu
- admin i profesor panel mogu biti jednostavniji, ali i dalje brendirani

### 10.3 Predlog za dizajn sistem

- definisati `color tokens` rano u projektu
- koristiti iste osnovne boje kroz frontend
- definisati tipografiju, dugmad, inpute, kartice i stepper komponente

## 11. Prioritet implementacije

Preporuceni redosled:

1. dokumentacija i pravila
2. schema baze i migracije
3. backend auth i admin osnove
4. logika raspolozivosti i rezervacije
5. profesor panel
6. javni booking flow
7. email notifikacije
8. otkazivanje
9. testovi
10. lokalni docker compose polish

## 12. Tehnicke napomene za lokalni razvoj

Sve za lokalni razvoj treba da se pokrece preko `docker compose`.

Minimalni lokalni servisi:

- `frontend`
- `backend`
- `postgres`

Opcionalno:

- `mailhog`
- `pgadmin`

Bitni zahtevi:

- jedan komandni ulaz za podizanje sistema
- env promenljive definisane kroz `.env`
- backend i frontend da rade hot reload lokalno
- baza da cuva podatke kroz volume

## 13. Rizici koje treba rano resiti

- racunanje dostupnosti nad proizvoljnim vremenskim rasponima
- obrada trajanja od `60` minuta uz sistem koji takodje koristi `45` i `90`
- sprecavanje duplog bookinga pri paralelnim zahtevima
- pravilna dodela ucionice `1` pa `2`
- pravilo otkazivanja minimum `24h`
- vremenske zone i format datuma/vremena
- konzistentnost izmedju raspolozivosti profesora i aktivnih rezervacija

## 14. Sledeci korak

Prakticni sledeci korak je implementacija tiketa iz fajla `docs/mvp-tickets.md` redom, bez preskakanja booking logike i poslovnih pravila.
