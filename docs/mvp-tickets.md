# BrainStorm Booking MVP Tickets

Ovaj dokument je radni backlog za MVP. Tiketi su poredjani po preporucenom redosledu rada.

Legenda prioriteta:

- `P0` - blokira sve ostalo
- `P1` - core funkcionalnost MVP-a
- `P2` - vazno za kompletiranje MVP-a
- `P3` - polish i zavrsni koraci

## ✅ Ticket 01 - Projektni scope i poslovna pravila

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Zakljucati MVP scope, poslovna pravila i osnovne odluke pre pocetka implementacije.

### Opis

Napraviti i odrzavati centralnu dokumentaciju koja definise:

- sta ulazi u MVP
- sta ne ulazi u MVP
- trajanja casova
- pravila dostupnosti
- pravila otkazivanja
- pravila dodele ucionica
- uloge u sistemu

### Acceptance criteria

- postoji dokument sa MVP scope-om
- postoji dokument sa poslovnim pravilima
- definisana su trajanja `45`, `60`, `90`
- definisano je pravilo `24h` za otkazivanje
- definisano je pravilo max `2` casa istovremeno
- definisano je pravilo odobrenja profesora od strane admina

## ✅ Ticket 02 - Inicijalna struktura monorepo projekta

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Postaviti osnovnu strukturu repozitorijuma za frontend, backend i dokumentaciju.

### Opis

Napraviti osnovnu strukturu:

- `frontend/`
- `backend/`
- `docs/`
- `docker-compose.yml`
- `.env.example`
- `README.md`

### Acceptance criteria

- repozitorijum ima jasnu osnovnu strukturu
- dokumentacija upucuje kako se projekat pokrece lokalno
- svi naredni tiketi imaju gde da se implementiraju

## ✅ Ticket 03 - Docker Compose lokalno okruzenje

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Sve lokalno mora da se podize preko `docker compose`.

### Opis

Definisati `docker-compose.yml` za najmanje sledece servise:

- `frontend`
- `backend`
- `postgres`

Opcionalno:

- `mailhog`

Treba omoguciti:

- hot reload za frontend
- hot reload za backend
- povezivanje sa bazom
- volume za bazu

### Acceptance criteria

- `docker compose up --build` podize sve servise
- frontend je dostupan na lokalnom portu
- backend je dostupan na lokalnom portu
- backend se uspesno povezuje na Postgres
- podaci baze ostaju sacuvani kroz volume

## ✅ Ticket 04 - Backend bootstrap

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Podici FastAPI aplikaciju sa osnovnom strukturom.

### Opis

U `backend/` postaviti:

- `FastAPI`
- osnovnu app strukturu
- healthcheck endpoint
- konfiguraciju preko env promenljivih
- konekciju prema bazi

### Acceptance criteria

- backend startuje u Docker-u
- postoji `GET /health`
- konfiguracija se cita iz env promenljivih
- postoji inicijalna struktura foldera za API, modele, sheme i servise

## ✅ Ticket 05 - Frontend bootstrap

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Podici React + Vite aplikaciju sa osnovnom navigacijom i stilskim osnovama.

### Opis

Napraviti frontend aplikaciju sa:

- `React`
- `Vite`
- `React Router`
- osnovnim layout-om
- definisanim brand bojama prema glavnom sajtu

### Acceptance criteria

- frontend startuje kroz Docker
- postoji osnovni layout
- postoji routing osnova
- postoji centralno definisan set boja i osnovnih UI tokena

## ✅ Ticket 06 - Dizajn sistem i branding osnove

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Booking aplikacija treba da bude vizuelno uskladjena sa postojecim sajtom.

### Opis

Definisati:

- osnovne boje
- tipografiju
- stil dugmadi
- stil input polja
- stil kartica
- stepper / progress UI za booking flow

Predlog vizuelnog pravca:

- tamna ljubicasa pozadina
- pink / magenta akcent
- beli tekst

### Acceptance criteria

- postoji centralizovan stil ili theme
- osnovne komponente dele isti vizuelni jezik
- booking flow ne deluje kao odvojena nebrendirana aplikacija

## ✅ Ticket 07 - Model baze i ER diagram

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Definisati stabilnu bazu pre API implementacije.

### Opis

Definisati modele i relacije za:

- `subjects`
- `teachers`
- `admins`
- `teacher_subjects`
- `teacher_availabilities`
- `bookings`

Posebno obratiti paznju na:

- odobravanje profesora
- trajanje rezervacije
- status rezervacije
- dodelu ucionice
- token za otkazivanje klijenta

### Acceptance criteria

- postoji jasan ER model
- svi glavni entiteti i relacije su definisani
- nema otvorenih pitanja koja blokiraju migracije

## ✅ Ticket 08 - Alembic inicijalna migracija

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Uvesti bazu pod verzionu kontrolu kroz migracije.

### Opis

Podesiti `Alembic` i napraviti inicijalnu migraciju koja kreira sve core tabele.

### Acceptance criteria

- Alembic je konfigurisan
- postoji inicijalna migracija
- migracija prolazi na praznoj bazi
- rollback osnovnog nivoa radi

## ✅ Ticket 09 - Seed podaci i admin inicijalizacija

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Omoguciti da sistem odmah moze da se koristi lokalno.

### Opis

Napraviti inicijalni seed za:

- admin nalog
- nekoliko predmeta
- eventualno test profesora

### Acceptance criteria

- postoji nacin da se seed podaci kreiraju lokalno
- postoji pocetni admin nalog
- lokalni razvoj ne zahteva rucni unos svega u bazu

## ✅ Ticket 10 - Admin autentikacija

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Omoguciti bezbedan login za admin korisnika.

### Opis

Implementirati:

- login endpoint
- hash lozinke
- JWT token
- zastitu admin ruta

### Acceptance criteria

- admin moze da se uloguje
- neautorizovan korisnik ne moze da pristupi admin rutama
- lozinke se ne cuvaju u plain text formatu

## ✅ Ticket 11 - Profesor autentikacija i odobravanje

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Profesor moze da koristi sistem tek kada ga admin odobri.

### Opis

Implementirati:

- profesor login
- proveru `is_approved`
- JWT za profesora
- odgovarajuce poruke kada profesor nije odobren

### Acceptance criteria

- profesor moze da se uloguje samo ako je aktivan i odobren
- neodobren profesor dobija jasnu poruku
- profesorske rute su zasticene

## ✅ Ticket 12 - Admin upravljanje predmetima

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Admin mora da upravlja listom predmeta.

### Opis

Implementirati CRUD ili minimum create/update/list za predmete.

### Acceptance criteria

- admin vidi listu predmeta
- admin moze da doda predmet
- admin moze da deaktivira ili izmeni predmet
- javni deo vidi samo aktivne predmete

## ✅ Ticket 13 - Admin upravljanje profesorima

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Admin mora da dodaje i odrzava profesore.

### Opis

Implementirati:

- kreiranje profesora
- izmenu podataka profesora
- aktivaciju/deaktivaciju
- odobravanje profesora

### Acceptance criteria

- admin vidi listu profesora
- admin moze da kreira profesora
- admin moze da odobri profesora
- admin moze da deaktivira profesora

## ✅ Ticket 14 - Povezivanje profesora i predmeta

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Sistem mora da zna koje predmete svaki profesor predaje.

### Opis

Implementirati vezu `teacher_subjects` i admin UI/API za dodelu predmeta profesoru.

### Acceptance criteria

- admin moze da dodeli jedan ili vise predmeta profesoru
- javni API vraca samo profesore koji predaju trazeni predmet
- booking nije moguc za nedozvoljenu kombinaciju profesor-predmet

## ✅ Ticket 15 - Profesor panel osnovni profil i pregled predmeta

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Profesor posle logina vidi osnovne informacije o sebi i predmetima koje predaje.

### Opis

Napraviti pocetni profesor dashboard sa:

- osnovnim profil podacima
- listom predmeta
- osnovnom navigacijom

### Acceptance criteria

- profesor uspesno vidi dashboard
- profesor vidi samo svoje podatke
- profesor vidi koje predmete predaje

## ✅ Ticket 16 - Model i API za raspolozivost profesora

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Profesor mora da unosi raspolozive vremenske raspone.

### Opis

Implementirati:

- kreiranje raspolozivosti kao raspona
- pregled raspolozivosti
- brisanje ili deaktivaciju raspolozivosti

Odluka:

- profesor unosi proizvoljan vremenski raspon, na primer `09:00-13:30`

### Acceptance criteria

- profesor moze da doda raspolozivost
- profesor moze da vidi svoje raspolozivosti
- profesor moze da ukloni raspolozivost
- sistem ne dozvoljava nelogicne raspone tipa `end <= start`

## ✅ Ticket 17 - Servis za racunanje dostupnih termina

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Napraviti srce booking sistema: iz raspolozivosti profesora izracunati stvarno dostupne termine.

### Opis

Servis mora da:

- uzme u obzir raspolozive raspone profesora
- uzme u obzir trajanje casa `45`, `60`, `90`
- iskljuci termine koji se preklapaju sa postojecim rezervacijama profesora
- iskljuci termine kada su obe ucionice vec zauzete
- vrati samo validne dostupne termine za trazeni predmet, profesora i datum

### Acceptance criteria

- moguce je dobiti listu dostupnih termina za trazeni datum
- `45`, `60` i `90` daju korektne rezultate
- termini koji se preklapaju sa rezervacijama nisu ponudjeni
- termini nisu ponudjeni kada je globalni kapacitet popunjen

## ✅ Ticket 18 - Pravilo dodele ucionica

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Implementirati automatsku dodelu ucionice po jasnom prioritetu.

### Opis

Pri kreiranju rezervacije:

- prvo probati `ucionica 1`
- ako je zauzeta za taj period, probati `ucionica 2`
- ako su obe zauzete, odbiti rezervaciju

### Acceptance criteria

- rezervacija dobija `classroom_number`
- sistem preferira `1` pa `2`
- rezervacija se odbija ako nema slobodne ucionice

## ✅ Ticket 19 - Kreiranje rezervacije

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Omoguciti javni booking endpoint koji postuje sva pravila sistema.

### Opis

Implementirati `POST /bookings` sa proverama:

- predmet postoji i aktivan je
- profesor postoji, aktivan je i odobren
- profesor predaje dati predmet
- trazeni termin je unutar profesorove raspolozivosti
- termin se ne preklapa sa drugom rezervacijom istog profesora
- globalni kapacitet nije popunjen
- dodeljuje se odgovarajuca ucionica
- generise se token za klijentsko otkazivanje

### Acceptance criteria

- validna rezervacija se uspesno kreira
- nevalidna rezervacija vraca jasnu gresku
- rezervacija se cuva sa statusom `confirmed`
- rezervacija dobija ucionicu i cancel token

## ✅ Ticket 20 - Zastita od duplog bookinga i race conditions

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Spreciti da dve istovremene rezervacije prodju kada postoji samo jedno slobodno mesto.

### Opis

Implementirati transakcionu logiku u backend-u:

- provera dostupnosti mora da se desi u okviru transakcije
- rezervacija i dodela ucionice moraju biti atomske
- sistem mora da ostane konzistentan pod paralelnim zahtevima

### Acceptance criteria

- paralelni zahtevi ne stvaraju nekonzistentno stanje
- nije moguce dobiti vise od 2 aktivna casa u istom terminu
- nije moguce da isti profesor bude bukiran dva puta u istom preklapanju

## ✅ Ticket 21 - Admin pregled svih rezervacija

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Admin mora da vidi sve rezervacije i njihova stanja.

### Opis

Napraviti admin API i UI za pregled:

- svih rezervacija
- statusa
- profesora
- predmeta
- ucionice
- vremena odrzavanja

### Acceptance criteria

- admin vidi listu svih rezervacija
- mogu se filtrirati ili pretrazivati osnovni podaci
- jasno se vidi status i dodeljena ucionica

## ✅ Ticket 22 - Admin pomeranje ili prebacivanje rezervacije

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Admin mora moci rucno da prebaci rezervaciju drugom profesoru.

### Opis

Implementirati admin akciju za:

- promenu profesora na rezervaciji
- eventualno promenu termina ako bude potrebno u okviru istog tiketa ili kasnije

Napomena:

- prilikom prebacivanja moraju se ponovo proveriti sva pravila dostupnosti i kapaciteta

### Acceptance criteria

- admin moze da prebaci rezervaciju drugom profesoru
- sistem ne dozvoljava nevalidno prebacivanje
- svi povezani podaci ostaju konzistentni

## ✅ Ticket 23 - Profesor pregled svojih rezervacija

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Profesor mora da vidi svoje rezervacije.

### Opis

Napraviti listu rezervacija za profesora sa osnovnim detaljima:

- datum
- vreme
- predmet
- trajanje
- ime klijenta
- status

### Acceptance criteria

- profesor vidi samo svoje rezervacije
- rezervacije su sortirane smisleno
- status rezervacije je jasan

## ✅ Ticket 24 - Javni API za predmete i profesore

- `Prioritet:` `P1`
- `Status:` **DONE** (implementirano u tiketu 18/19: GET /public/subjects, GET /public/teachers)
- `Cilj:` Frontend booking flow mora da moze da ucita predmete i profesore.

### Opis

Implementirati javne endpoint-e:

- lista aktivnih predmeta
- lista profesora za predmet

### Acceptance criteria

- javni frontend moze da ucita aktivne predmete
- javni frontend moze da dobije profesore za izabrani predmet
- neaktivni predmeti i nevalidni profesori nisu prikazani

## ✅ Ticket 25 - Javni API za dostupne termine

- `Prioritet:` `P1`
- `Status:` **DONE** (implementirano u tiketu 19: GET /public/available-slots)
- `Cilj:` Frontend mora da moze da dobije slobodne termine za trazenog profesora, datum i trajanje.

### Opis

Implementirati endpoint koji vraca dostupne termine za:

- predmet
- profesora
- datum
- trajanje

### Acceptance criteria

- API vraca samo validne termine
- rezultat reflektuje postojece rezervacije i kapacitet ucionica
- trajanje `45`, `60`, `90` menja dostupne rezultate

## ✅ Ticket 26 - Javni booking multi-step UI

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Napraviti glavni korisnicki tok rezervacije.

### Opis

Napraviti korake:

1. izbor predmeta
2. izbor profesora
3. izbor datuma
4. izbor termina
5. izbor trajanja
6. unos podataka
7. potvrda

### Acceptance criteria

- korisnik moze da prodje kroz ceo flow bez logina
- svaki korak ima validaciju
- korisnik jasno vidi gde se nalazi u procesu

## ✅ Ticket 27 - Booking forma i validacija

- `Prioritet:` `P1`
- `Status:` **DONE** (implementirano kao deo BookingPage Step 6)
- `Cilj:` Osigurati da forma prikuplja sve potrebne podatke.

### Opis

Forma treba da sadrzi:

- ime
- prezime
- email
- kategoriju: `faks`, `osnovna`, `srednja`, `drugo`
- komentar / gradivo

### Acceptance criteria

- obavezna polja su validirana
- email mora biti validnog formata
- korisnik dobija jasne poruke greske

## ✅ Ticket 28 - Potvrdni ekran i UX greske

- `Prioritet:` `P2`
- `Status:` **DONE** (success ekran, loading, conflict handling u BookingPage)
- `Cilj:` Poboljsati korisnicko iskustvo u uspesnim i neuspesnim scenarijima.

### Opis

Dodati:

- success ekran
- loading stanja
- poruku kada je termin upravo zauzet
- fallback poruke za greske backend-a

### Acceptance criteria

- korisnik dobija jasan odgovor nakon akcije
- greske nisu sirove ili tehnicke
- flow ostaje razumljiv i kada dodje do konflikta rezervacije

## ✅ Ticket 29 - Email servis integracija

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Nakon rezervacije i otkazivanja moraju se slati email obavestenja.

### Opis

Napraviti email servis apstrakciju koja podrzava:

- slanje emaila o potvrdi rezervacije
- slanje emaila o otkazivanju
- slanje emaila o neuspesnom pokusaju otkazivanja

### Acceptance criteria

- backend moze programski da salje email
- provider je konfigurabilan kroz env
- lokalno postoji jednostavan nacin za proveru email flow-a

## ✅ Ticket 30 - Email templejti za potvrdu rezervacije

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Poslati jasne i korisne potvrde rezervacije.

### Opis

Napraviti templejte za:

- klijenta
- profesora
- admina

Templejti treba da sadrze:

- predmet
- profesora
- datum i vreme
- trajanje
- ucionicu
- podatke klijenta
- komentar
- pravila otkazivanja
- link za otkazivanje kada je primenjivo

### Acceptance criteria

- svaki primalac dobija odgovarajuci sadrzaj
- sadrzaj je citljiv i informativan
- klijent dobija bezbedan link za otkazivanje

## ✅ Ticket 31 - Klijentsko otkazivanje preko secure linka

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Klijent mora moci da otkaze rezervaciju bez naloga.

### Opis

Implementirati:

- cancel token generisanje
- endpoint za otkazivanje preko tokena
- proveru roka `24h`

### Acceptance criteria

- validan token omogucava otkazivanje ako je rok ispostovan
- nevalidan token ne prolazi
- ako je prosao rok, korisnik dobija odgovarajucu poruku i email

## ✅ Ticket 32 - Profesorsko otkazivanje rezervacije

- `Prioritet:` `P1`
- `Status:` **DONE**
- `Cilj:` Profesor mora moci da otkaze svoj cas po pravilima.

### Opis

Implementirati profesorski tok otkazivanja uz proveru:

- da rezervacija pripada profesoru
- da nije istekao rok od `24h`

### Acceptance criteria

- profesor moze da otkaze svoju rezervaciju na vreme
- ne moze da otkaze tudju rezervaciju
- kasno otkazivanje ne prolazi

## ✅ Ticket 33 - Admin otkazivanje rezervacije

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Admin mora moci da intervenise u svakom trenutku.

### Opis

Implementirati admin endpoint/UI za otkazivanje rezervacije bez ogranicenja od `24h`.

### Acceptance criteria

- admin moze da otkaze bilo koju rezervaciju
- status rezervacije se korektno menja
- salju se prateca obavestenja

## ✅ Ticket 34 - Pregled zauzeca ucionica

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Admin mora da vidi kako su ucionice zauzete.

### Opis

Napraviti prikaz rezervacija po terminu i ucionici.

### Acceptance criteria

- admin vidi koja rezervacija je u kojoj ucionici
- jasno se vidi popunjenost za odabrani dan

## ✅ Ticket 35 - Frontend responsiveness i finalni UI polish

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Aplikacija mora raditi dobro na desktop i mobilnim uredjajima.

### Opis

Doraditi:

- responsive layout
- spacing
- tipografiju
- dugmad i forme
- stepper UX

### Acceptance criteria

- booking flow radi na mobilnom telefonu
- dashboardi su upotrebljivi na manjim ekranima
- UI ostaje u skladu sa branding-om

## ✅ Ticket 36 - Testovi za booking logiku

- `Prioritet:` `P0`
- `Status:` **DONE**
- `Cilj:` Pokriti najrizicniji deo sistema automatizovanim testovima.

### Opis

Napraviti testove za:

- rezervaciju unutar raspolozivosti
- konflikt istog profesora
- max `2` casa istovremeno
- dodelu `ucionica 1` pa `2`
- odbijanje kada nema slobodne ucionice
- trajanja `45`, `60`, `90`
- proveru `24h` pravila otkazivanja

### Acceptance criteria

- testovi prolaze lokalno
- core pravila sistema imaju automatizovanu zastitu
- kriticne regresije su pokrivene

## ✅ Ticket 37 - Integracioni testovi API-ja

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Proveriti da API radi kao celina, ne samo na nivou funkcija.

### Opis

Napraviti integracione testove za:

- login
- kreiranje rezervacije
- pregled dostupnih termina
- otkazivanje

### Acceptance criteria

- glavni API tokovi prolaze u test okruzenju
- osnovni happy path i kljucni error path su pokriveni

## ✅ Ticket 38 - README i developer onboarding

- `Prioritet:` `P2`
- `Status:` **DONE**
- `Cilj:` Projekat mora biti lak za ponovno pokretanje i odrzavanje.

### Opis

Napraviti jasan `README.md` sa:

- opisom projekta
- pokretanjem preko Docker Compose-a
- listom env promenljivih
- lokalnim razvojnim tokom

### Acceptance criteria

- novi developer moze da pokrene projekat po README-u
- dokumentacija je azurna u odnosu na realno stanje projekta

## ✅ Ticket 39 - Logging i osnovno pracenje gresaka

- `Prioritet:` `P3`
- `Status:` **DONE**
- `Cilj:` Olaksati debug i pracenje problema tokom razvoja.

### Opis

Dodati:

- strukturisan backend logging
- osnovni error handling
- razumljive poruke u logovima za rezervacije i otkazivanja

### Acceptance criteria

- greske se jasno vide u logovima
- booking flow ima korisne sistemske logove

## ✅ Ticket 40 - MVP finalni checklist

- `Prioritet:` `P3`
- `Status:` **DONE**
- `Cilj:` Zatvoriti MVP pre deploy faze.

### Opis

Pre produkcije proveriti:

- da svi glavni tokovi rade lokalno kroz Docker Compose
- da su emailovi testirani
- da su dokumentacija i env primeri azurni
- da su kriticni testovi zeleni

### Acceptance criteria

- postoji jasan checklist pre deploy-a
- sistem je spreman za sledecu fazu rada

### MVP Finalni Checklist — Verifikacija (2026-03-20)

#### ✅ Infrastruktura
- [x] Docker Compose pokreće sve 4 servisa (postgres, backend, frontend, mailhog)
- [x] Svi servisi odgovaraju na health check / HTTP 200
- [x] Backend auto-reload radi pri izmeni koda
- [x] Frontend HMR radi pri izmeni koda
- [x] PostgreSQL healthcheck prolazi

#### ✅ Backend API
- [x] `/health` vraća `{"status":"ok","database":"ok"}`
- [x] Swagger UI dostupan na `/docs`
- [x] Auth: admin i teacher login rade
- [x] CRUD predmeta (admin)
- [x] CRUD profesora + approve (admin)
- [x] Teacher-Subject veza (admin)
- [x] Teacher availability CRUD (profesor)
- [x] Available slots endpoint vraća tačne termine
- [x] Booking kreiranje sa svim validacijama
- [x] Concurrency control (advisory lock + FOR UPDATE)
- [x] Classroom auto-assign (prioritet 1→2)
- [x] Klijentsko otkazivanje (secure token + 24h pravilo)
- [x] Profesorsko otkazivanje (24h pravilo)
- [x] Admin otkazivanje (bez 24h ograničenja)
- [x] Admin reassign booking
- [x] Admin classroom schedule pregled
- [x] Strukturisan logging za sve booking operacije
- [x] Globalni error handler za 500 grešaka

#### ✅ Frontend
- [x] HomePage sa CTA
- [x] Multi-step booking flow (7 koraka)
- [x] Validacija forme
- [x] Success / error ekrani
- [x] Teacher login + dashboard
- [x] Admin login
- [x] Responsive dizajn (mobile / tablet / desktop)
- [x] Hamburger meni na mobilnom
- [x] Touch-friendly elementi (min 44px)
- [x] Branding usklađen sa sajtom (boje, font, layout)

#### ✅ Email
- [x] MailHog prima emailove lokalno
- [x] Potvrda rezervacije → klijent, profesor, admin
- [x] Otkazivanje → klijent, profesor, admin
- [x] Kasno otkazivanje → klijent (obaveštenje o naplati)
- [x] Emailovi sadrže BrainStorm branding i srpski tekst

#### ✅ Testovi
- [x] 32 testa prolaze (`pytest tests/ -v`)
- [x] availability_service: 14 testova
- [x] classroom_service: 7 testova
- [x] booking API: 11 testova (kreiranje, konflikti, cancel)
- [x] Test baza (`brainstorm_test`) sa automatskim rollback-om

#### ✅ Dokumentacija
- [x] README.md sa kompletnim onboarding-om
- [x] .env.example sa svim varijablama
- [x] docs/mvp-plan.md — poslovna pravila i arhitektura
- [x] docs/mvp-tickets.md — svi tiketi sa statusom

#### Pre deploy-a obavezno uraditi:
- [ ] Promeniti `SECRET_KEY` na produkcijski random string
- [ ] Podesiti pravi SMTP server (Resend / Mailgun / SendGrid)
- [ ] Podesiti `FRONTEND_URL` i `BACKEND_CORS_ORIGINS` za produkcijski domen
- [ ] Promeniti `ADMIN_PASSWORD` na jak password
- [ ] Omogućiti HTTPS
- [ ] Razmotriti rate limiting za public endpointe

## Preporuceni redosled implementacije

Ako zelis da radis strogo redom, idi ovako:

1. Ticket 02
2. Ticket 03
3. Ticket 04
4. Ticket 05
5. Ticket 06
6. Ticket 07
7. Ticket 08
8. Ticket 09
9. Ticket 10
10. Ticket 11
11. Ticket 12
12. Ticket 13
13. Ticket 14
14. Ticket 16
15. Ticket 17
16. Ticket 18
17. Ticket 19
18. Ticket 20
19. Ticket 21
20. Ticket 23
21. Ticket 24
22. Ticket 25
23. Ticket 26
24. Ticket 27
25. Ticket 28
26. Ticket 29
27. Ticket 30
28. Ticket 31
29. Ticket 32
30. Ticket 33
31. Ticket 34
32. Ticket 35
33. Ticket 36
34. Ticket 37
35. Ticket 38
36. Ticket 39
37. Ticket 40

## Predlog prvog radnog sprinta

Ako hoces da krenemo odmah bez lutanja, prvi sprint neka bude:

1. Ticket 02 - Inicijalna struktura monorepo projekta
2. Ticket 03 - Docker Compose lokalno okruzenje
3. Ticket 04 - Backend bootstrap
4. Ticket 05 - Frontend bootstrap
5. Ticket 07 - Model baze i ER diagram
6. Ticket 08 - Alembic inicijalna migracija

To je najbolji prvi paket jer posle njega dobijas stabilnu osnovu za sve ostalo.
