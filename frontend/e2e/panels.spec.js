import { expect, test } from "@playwright/test";

const API_URL = (process.env.E2E_API_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const MAILHOG_URL = process.env.MAILHOG_URL || "http://127.0.0.1:8036";
const LUKA = { email: "lukabura89@gmail.com", password: "profesor123" };
const browserProblems = new WeakMap();

test.beforeEach(async ({ page }) => {
  const problems = [];
  browserProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
});

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) || []).toEqual([]);
});

function decodedHeader(value = "") {
  return value.replace(/=\?utf-8\?([bq])\?([^?]+)\?=/gi, (_, encoding, payload) => {
    if (encoding.toLowerCase() === "b") return Buffer.from(payload, "base64").toString("utf8");
    const bytes = payload.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    return Buffer.from(bytes, "binary").toString("utf8");
  });
}

/** "YYYY-MM-DD" u Beogradu, `offset` dana od danas. */
function belgradeDay(offset) {
  const date = new Date(Date.now() + offset * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Prvi dan (3–13 dana unapred) na kome Luka ima bar dva slobodna online termina od 45 minuta. */
async function freeDay(request) {
  for (let offset = 3; offset <= 13; offset += 1) {
    const response = await request.get(`${API_URL}/public/available-slots`, { params: { teacher_id: 1, date: belgradeDay(offset), duration: 45, delivery_mode: "online" } });
    const data = await response.json();
    if (data.slots?.length >= 2) return data.slots;
  }
  throw new Error("Luka nema slobodnih termina; pokreni app.db.seed_luka_test_data");
}

async function teacherLogin(page) {
  await page.goto("/teacher/login");
  await page.locator("#email").fill(LUKA.email);
  await page.locator("#password").fill(LUKA.password);
  await page.getByRole("button", { name: /Otvori moj panel/i }).click();
  await expect(page.getByRole("heading", { name: /Dobrodošli, Luka Bura/ })).toBeVisible();
}

test("profesor: raspored, dostupnost za više dana i prelaz u admin panel bez nove prijave", async ({ page }) => {
  await teacherLogin(page);
  await expect(page.locator(".animated-tab", { hasText: "Raspored" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".day-group")).toHaveCount(7);
  await expect(page.locator(".day-group").first()).toContainText("Danas");

  await page.locator(".animated-tab", { hasText: "Dostupnost" }).click();
  const chips = page.locator(".date-chip");
  await expect(chips).toHaveCount(28);
  await chips.nth(26).click();
  await chips.nth(27).click();
  await expect(page.getByText("Izabrano: 2")).toBeVisible();
  await page.getByRole("button", { name: /Ceo dan/ }).click();
  await expect(page.getByText("2 dana · 08:00–20:00")).toBeVisible();
  const blocks = page.locator(".avail-block");
  const before = await blocks.count();
  await page.getByRole("button", { name: "Dodaj dostupnost" }).click();
  await expect(page.getByText("Dostupnost 08:00–20:00 je dodata za 2 dana.")).toBeVisible();
  await expect(blocks).toHaveCount(before + 2);

  // Vrati stanje: zatvori oba nova bloka (poslednja dva dana u listi).
  for (let index = 0; index < 2; index += 1) {
    const block = blocks.last();
    await expect(block).toContainText("08:00–20:00");
    await block.locator(".avail-block-close").click();
    await block.getByRole("button", { name: "Zatvori termin", exact: true }).click();
    await expect(blocks).toHaveCount(before + 1 - index);
  }

  await page.getByRole("button", { name: "Admin panel" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.locator(".dash-hero-eyebrow")).toContainText("Administrator");
  await expect(page.locator(".board-column h3")).toHaveText(["Učionica 1 (velika)", "Učionica 2 (mala)", "Online"]);
  await page.getByRole("button", { name: "Profesorski panel" }).click();
  await expect(page).toHaveURL(/\/teacher\/dashboard$/);
  await expect(page.locator(".dash-hero-eyebrow")).toContainText("Profesor");
});

test("admin: pronalazi rezervaciju, prebacuje je u drugi termin i otkazuje, uz email obaveštenja", async ({ page, request }) => {
  const email = `e2e.admin.${Date.now()}@brainstorm.rs`;
  const slots = await freeDay(request);
  const created = await request.post(`${API_URL}/public/bookings`, {
    multipart: {
      subject_id: "1", teacher_id: "1", start_time: slots[0].start_time, duration: "45",
      client_full_name: "E2E Admin Klijent", client_email: email, client_category: "srednja",
      delivery_mode: "online", session_type: "individual",
    },
  });
  expect(created.status()).toBe(201);
  const booking = await created.json();

  await page.goto("/admin/login");
  await page.locator("#admin-email").fill(LUKA.email);
  await page.locator("#admin-password").fill(LUKA.password);
  await page.getByRole("button", { name: /Otvori kontrolni panel/i }).click();
  await expect(page.getByRole("heading", { name: /Dobrodošli, Luka Bura/ })).toBeVisible();
  await expect(page.getByText(/Takođe profesor/)).toBeVisible();

  await page.locator(".animated-tab", { hasText: "Rezervacije" }).click();
  await expect(page.getByRole("button", { name: /Moji časovi/ })).toBeVisible();
  await page.locator("#bookings-search").fill(email);
  const row = page.locator(".lesson-row").filter({ hasText: "E2E Admin Klijent" });
  await expect(row).toHaveCount(1);
  await row.locator(".lesson-row-head").click();
  await expect(row).toContainText(email);

  await row.getByRole("button", { name: "Prebaci čas" }).click();
  const freeTime = row.locator(".time-pill").first();
  await expect(freeTime).toBeVisible();
  const newTime = (await freeTime.textContent()).trim();
  await freeTime.click();
  await row.getByRole("button", { name: "Sačuvaj izmenu" }).click();
  await expect(page.getByText(new RegExp(`Čas #${booking.id} je prebačen`))).toBeVisible();
  await expect(row.locator(".lesson-row-time")).toContainText(newTime);
  await expect.poll(async () => {
    const response = await request.get(`${MAILHOG_URL}/api/v2/search`, { params: { kind: "to", query: email } });
    const data = await response.json();
    return (data.items || []).map((message) => decodedHeader(message.Content.Headers.Subject[0]));
  }, { timeout: 15_000 }).toEqual(expect.arrayContaining([expect.stringContaining("Izmena termina")]));

  await row.getByRole("button", { name: "Otkaži čas" }).click();
  await row.getByPlaceholder(/Razlog/).fill("E2E: admin otkazuje posle prebacivanja");
  await row.getByRole("button", { name: "Da, otkaži" }).click();
  await expect(page.getByText(new RegExp(`Čas #${booking.id} je otkazan`))).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.getByRole("button", { name: "Otkazane" }).click();
  const cancelled = page.locator(".lesson-row").filter({ hasText: "E2E Admin Klijent" });
  await expect(cancelled).toHaveCount(1);
  await cancelled.locator(".lesson-row-head").click();
  await expect(cancelled).toContainText("admin otkazuje posle prebacivanja");
});

test("admin vidi učenički nalog sa brojem časova i može da ga deaktivira", async ({ page, request }) => {
  const email = `e2e.ucenik.admin.${Date.now()}@brainstorm.rs`;
  const registered = await request.post(`${API_URL}/auth/student/register`, { data: { full_name: "E2E Nalog Za Admina", email, password: "lozinka123", category: "osnovna" } });
  expect(registered.status()).toBe(201);

  await page.goto("/admin/login");
  await page.locator("#admin-email").fill(LUKA.email);
  await page.locator("#admin-password").fill(LUKA.password);
  await page.getByRole("button", { name: /Otvori kontrolni panel/i }).click();
  await page.locator(".animated-tab", { hasText: "Učenici" }).click();
  await page.locator("#students-search").fill(email);
  const student = page.locator(".item-row").filter({ hasText: "E2E Nalog Za Admina" });
  await expect(student).toHaveCount(1);
  await expect(student).toContainText("Osnovna škola");
  await expect(student).toContainText("Još nema časova zakazanih sa naloga");

  await student.getByRole("button", { name: "Deaktiviraj" }).click();
  await student.getByRole("button", { name: "Deaktiviraj" }).last().click();
  await expect(student).toContainText("Deaktiviran");
  const login = await request.post(`${API_URL}/auth/student/login`, { data: { email, password: "lozinka123" } });
  expect(login.status()).toBe(403);
});
