import { expect, test } from "@playwright/test";

// Plaćen pristup snimcima za malu i veliku maturu, preko pravog backenda (lažna naplata test karticama).
// Očekuje seed (`python -m app.db.seed`) zbog naloga matura@brainstorm.com sa obe plaćene pripreme.
const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:8002";
const MAILHOG_URL = process.env.MAILHOG_URL || "http://127.0.0.1:8036";
const VIDEO_ID = "dQw4w9WgXcQ";
const uniqueEmail = (tag) => `e2e.${tag}.${Date.now()}@brainstorm.rs`;

/**
 * Katalog u repou još nema videe. Ova zamena kaže da svaki snimak ima video, a YouTube ID dodaje
 * samo kad backend javi da je pristup plaćen; tako se vide zaključano i otključano stanje.
 */
async function pretendVideosExist(page) {
  await page.route(/\/public\/prep\/(mala|velika)-matura(\/[^/]+\/[^/]+)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const json = await response.json();
    const withVideo = (lecture) => ({ ...lecture, has_video: true, youtube_id: json.access.purchased ? VIDEO_ID : null });
    if (json.subjects) json.subjects.forEach((subject) => subject.groups.forEach((group) => { group.lectures = group.lectures.map(withVideo); }));
    else Object.assign(json, withVideo(json));
    return route.fulfill({ response, json });
  });
}

async function fillCard(page, number = "4242 4242 4242 4242") {
  await page.getByLabel("Broj kartice").fill(number);
  await page.getByLabel("Ime na kartici").fill("ANA PROBA");
  await page.getByLabel("Važi do").fill("1230");
  await page.getByLabel("CVC").fill("123");
}

test("gost plaća malu maturu: nalog se pravi sam, snimci se otključavaju samo za malu maturu", async ({ page, request }) => {
  test.setTimeout(90_000);
  await pretendVideosExist(page);
  const email = uniqueEmail("kupovina");

  await page.goto("/mala-matura");
  const offer = page.getByRole("complementary", { name: "Otključaj sve snimke" });
  await expect(offer).toContainText("50 €");
  await expect(offer).toContainText("jednokratno, bez pretplate");
  await expect(page.locator(".prep-card").first()).toContainText("Uz plaćen pristup");
  await expect(page.locator(".prep-card img")).toHaveCount(0);

  await offer.getByRole("link", { name: /Kupi pristup/ }).click();
  await expect(page).toHaveURL(/\/mala-matura\/kupovina$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Otključaj sve snimke");

  // Podaci se proveravaju pre plaćanja.
  await page.getByRole("button", { name: "Nastavi na plaćanje" }).click();
  await expect(page.getByText("Unesi ime i prezime.")).toBeVisible();
  await expect(page.getByLabel("Ime i prezime")).toBeFocused();
  await page.getByLabel("Ime i prezime").fill("Ana Proba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Lozinka za nalog").fill("lozinka123");
  await page.getByRole("button", { name: "Nastavi na plaćanje" }).click();
  await expect(page.getByRole("heading", { name: "Platna kartica" })).toBeVisible();
  await expect(page.getByLabel("Broj kartice")).toBeFocused();

  // Kartica se popunjava dok se kuca, a fokus na CVC je okreće.
  await page.getByLabel("Broj kartice").fill("5555555555554444");
  await expect(page.getByLabel("Broj kartice")).toHaveValue("5555 5555 5555 4444");
  await expect(page.locator(".checkout-card3d-front")).toHaveAttribute("data-brand", "Mastercard");
  await page.getByLabel("CVC").focus();
  await expect(page.locator(".checkout-card3d")).toHaveClass(/is-flipped/);

  // Odbijena kartica: poruka, a nalog se ne pravi.
  await fillCard(page, "4000 0000 0000 0002");
  await expect(page.getByLabel("Važi do")).toHaveValue("12/30");
  await page.getByRole("button", { name: "Plati 50 €" }).click();
  await expect(page.getByRole("alert")).toContainText("Banka je odbila karticu");
  const noAccount = await request.post(`${API_URL}/auth/student/login`, { data: { email, password: "lozinka123" } });
  expect(noAccount.status()).toBe(401);

  await page.getByRole("button", { name: "Popuni test karticu" }).click();
  await expect(page.getByLabel("Broj kartice")).toHaveValue("4242 4242 4242 4242");
  await expect(page.getByRole("button", { name: "Plati 50 €" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Hvala na uplati" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Snimci su otključani");
  await expect(page.getByText("Napravili smo ti učenički nalog.")).toBeVisible();
  const receipt = page.locator(".checkout-receipt");
  await expect(receipt).toContainText(/BS-\d{6}/);
  await expect(receipt).toContainText("Visa •••• 4242");
  await expect(receipt).toContainText("50 €");
  await expect(page.locator(".checkout-summary")).toContainText("Plaćeno");
  expect(await page.evaluate(() => localStorage.getItem("role"))).toBe("student");
  await expect(page.getByRole("button", { name: /Moj panel/ })).toBeVisible();

  const receiptNumber = (await receipt.locator("dd").first().textContent()).trim();
  await expect.poll(async () => {
    const response = await request.get(`${MAILHOG_URL}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
    return response.ok() ? (await response.json()).items.map((item) => item.Content.Headers.Subject[0]).join(" | ") : "";
  }, { timeout: 10_000 }).toContain(receiptNumber);

  // Mala matura je otključana, velika nije.
  await page.getByRole("link", { name: "Otvori snimke" }).click();
  await expect(page).toHaveURL(/\/mala-matura$/);
  await expect(page.getByText("Pristup aktivan")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Otključaj sve snimke" })).toHaveCount(0);
  await expect(page.locator(".prep-card img").first()).toHaveAttribute("src", new RegExp(VIDEO_ID));
  await page.getByRole("link", { name: /Procenti u svakodnevnim zadacima/ }).click();
  await expect(page.locator(".lecture-video iframe")).toHaveAttribute("src", new RegExp(`youtube-nocookie\\.com/embed/${VIDEO_ID}`));

  await page.goto("/velika-matura");
  await expect(page.getByRole("complementary", { name: "Otključaj sve snimke" })).toBeVisible();
  await page.goto("/ucenik/panel");
  const preps = page.locator(".student-prep");
  await expect(preps).toHaveCount(2);
  await expect(preps.nth(0)).toContainText("Pristup aktivan");
  await expect(preps.nth(0)).toContainText(receiptNumber);
  await expect(preps.nth(1).getByRole("link", { name: /Kupi pristup/ })).toHaveAttribute("href", "/velika-matura/kupovina");
});

test("zaključan snimak nudi kupovinu i prijavu koja vraća na isti snimak", async ({ page }) => {
  await pretendVideosExist(page);
  await page.goto("/velika-matura/matematika/logaritamske-jednacine");
  const locked = page.getByRole("region", { name: "Zaključan snimak" });
  await expect(locked).toContainText("Snimak je zaključan");
  await expect(locked).toContainText("50 €");
  await expect(page.locator(".lecture-video iframe")).toHaveCount(0);
  await expect(locked.getByRole("link", { name: /Kupi pristup/ })).toHaveAttribute("href", "/velika-matura/kupovina");
  await locked.getByRole("link", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/dalje=\/velika-matura\/matematika\/logaritamske-jednacine/);

  // Test nalog iz seed-a ima obe pripreme: posle prijave je snimak otključan.
  await page.locator("#student-login-email").fill("matura@brainstorm.com");
  await page.locator("#student-login-password").fill("matura123");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/\/velika-matura\/matematika\/logaritamske-jednacine$/);
  await expect(page.locator(".lecture-video iframe")).toHaveAttribute("src", new RegExp(VIDEO_ID));
});

test("postojeći email vodi na prijavu, a plaćen nalog ne plaća ponovo", async ({ page }) => {
  await page.goto("/mala-matura/kupovina");
  await page.getByLabel("Ime i prezime").fill("Neko Drugi");
  await page.getByLabel("Email").fill("matura@brainstorm.com");
  await page.getByLabel("Lozinka za nalog").fill("lozinka123");
  await page.getByRole("button", { name: "Nastavi na plaćanje" }).click();
  await page.getByRole("button", { name: "Popuni test karticu" }).click();
  await page.getByRole("button", { name: "Plati 50 €" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Nalog sa ovom email adresom već postoji");

  // „Promeni email“ vraća na prvi korak sa porukom uz polje.
  await alert.getByRole("button", { name: "Promeni email" }).click();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByText("Na ovu adresu već postoji nalog.")).toBeVisible();
  await page.getByRole("button", { name: "Nastavi na plaćanje" }).click();
  await page.getByRole("button", { name: "Popuni test karticu" }).click();
  await page.getByRole("button", { name: "Plati 50 €" }).click();
  await page.getByRole("alert").getByRole("link", { name: /Prijavi se/ }).click();
  await expect(page).toHaveURL(/\/ucenik\/prijava\?dalje=\/mala-matura\/kupovina$/);

  await page.locator("#student-login-email").fill("matura@brainstorm.com");
  await page.locator("#student-login-password").fill("matura123");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/\/mala-matura\/kupovina$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Snimci su već tvoji");
  await expect(page.getByText("matura@brainstorm.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /Plati/ })).toHaveCount(0);
});

test("prijavljen učenik plaća samo karticom, a odjava sa kupovine vraća formu za podatke", async ({ page }) => {
  const email = uniqueEmail("nalog");
  await page.goto("/ucenik/prijava?nalog=novi&dalje=/velika-matura/kupovina");
  await page.locator("#student-name").fill("Marko Nalog");
  await page.locator("#student-email").fill(email);
  await page.locator("#student-password").fill("lozinka123");
  await page.getByRole("button", { name: "Napravi nalog" }).click();
  await expect(page).toHaveURL(/\/velika-matura\/kupovina$/);
  await expect(page.getByRole("heading", { name: "Kupuješ sa naloga" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Nastavi na plaćanje" }).click();
  await fillCard(page);
  await page.getByRole("button", { name: "Plati 50 €" }).click();
  await expect(page.getByRole("heading", { name: "Hvala na uplati" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Napravili smo ti učenički nalog.")).toHaveCount(0);
  await expect(page.locator(".checkout-receipt")).toContainText("Velika matura");

  // Druga priprema: „Nisi ti? Odjavi se“ briše prijavu i vraća formu za novog učenika.
  await page.goto("/mala-matura/kupovina");
  await expect(page.getByRole("heading", { name: "Kupuješ sa naloga" })).toBeVisible();
  await page.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page.getByRole("heading", { name: "Tvoji podaci" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Prijava/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});

test("cenovnik ima pripreme za maturu sa linkovima na kupovinu", async ({ page }) => {
  await page.goto("/cenovnik");
  const section = page.locator(".pricing-main--matura");
  await expect(section.getByRole("heading", { name: "Pripreme za maturu" })).toBeVisible();
  await expect(section.locator(".pricing-card")).toHaveCount(2);
  await expect(section.getByRole("link", { name: /Kupi pristup/ }).nth(0)).toHaveAttribute("href", "/mala-matura/kupovina");
  await expect(section.getByRole("link", { name: /Kupi pristup/ }).nth(1)).toHaveAttribute("href", "/velika-matura/kupovina");
});
