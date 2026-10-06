/**
 * Snimci predavanja za pripreme. Novi snimak se dodaje u `lectures` niz odgovarajućeg predmeta:
 *   { title: "Razlomci, 1. deo", duration: "42 min", youtubeId: "dQw4w9WgXcQ" }
 * `youtubeId` je deo YouTube linka posle "v=". Dok je niz prazan, stranica prikazuje "Uskoro".
 */
export const PREP_PAGES = {
  mala: {
    title: "Priprema za malu maturu",
    lead: "Završni ispit posle osmog razreda: srpski jezik, matematika i kombinovani test. Ovde će biti snimci predavanja po oblastima, da možeš da učiš svojim tempom i vratiš se na ono što ti nije jasno.",
    subjects: [
      { name: "Srpski jezik", topics: "Gramatika, pravopis, književnost, razumevanje teksta", lectures: [] },
      { name: "Matematika", topics: "Brojevi, jednačine, geometrija, zadaci sa testova", lectures: [] },
      { name: "Kombinovani test", topics: "Biologija, geografija, istorija, fizika i hemija", lectures: [] },
    ],
  },
  velika: {
    title: "Priprema za veliku maturu",
    lead: "Matura na kraju srednje škole i prijemni ispiti. Ovde će biti snimci predavanja i rešeni zadaci, poređani po predmetima i oblastima.",
    subjects: [
      { name: "Srpski jezik i književnost", topics: "Jezik, književni periodi, analiza teksta, pismeni sastav", lectures: [] },
      { name: "Matematika", topics: "Funkcije, trigonometrija, analiza, verovatnoća", lectures: [] },
      { name: "Izborni predmet", topics: "Informatika, fizika, hemija, strani jezici", lectures: [] },
    ],
  },
};
