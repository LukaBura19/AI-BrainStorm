import { expect, test } from "@playwright/test";

const MAILHOG_URL = process.env.MAILHOG_URL || "http://127.0.0.1:8036";
const browserProblems = new WeakMap();

test.beforeEach(async ({ page }) => {
  const problems = [];
  browserProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      problems.push(`console: ${message.text()}${source ? ` (${source})` : ""}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) || []).toEqual([]);
});

async function mailState(request) {
  const response = await request.get(`${MAILHOG_URL}/api/v2/messages`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

const recipientsOf = (message) => (message.To || []).map(({ Mailbox, Domain }) => `${Mailbox}@${Domain}`);

function decodedMessageBody(message) {
  const mimeBody = message?.Content?.Body || "";
  const encodedParts = [...mimeBody.matchAll(/Content-Transfer-Encoding:\s*base64\s+([\s\S]*?)(?=\r?\n--)/gi)];
  return encodedParts
    .map((match) => Buffer.from(match[1].replace(/\s/g, ""), "base64").toString("utf8"))
    .join("\n");
}

function decodedHeader(value = "") {
  return value.replace(/=\?utf-8\?([bq])\?([^?]+)\?=/gi, (_, encoding, payload) => {
    if (encoding.toLowerCase() === "b") return Buffer.from(payload, "base64").toString("utf8");
    const bytes = payload
      .replace(/_/g, " ")
      .replace(/=([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    return Buffer.from(bytes, "binary").toString("utf8");
  });
}

test("mobilna navigacija nema horizontalno prelivanje", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Zakaži svoj čas" })).toBeVisible();
  const viewportFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(viewportFits).toBeTruthy();
  await page.getByRole("button", { name: "Otvori meni" }).click();
  const bookingLink = page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Zakaži čas" });
  await expect(bookingLink).toBeVisible();
  await bookingLink.click();
  await expect(page.getByRole("heading", { name: "Izaberi predmet" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

test("kompletan javni tok: Luka, prilog, tri MailHog test poruke i otkazivanje", async ({ page, request }) => {
  const beforeMail = await mailState(request);
  const existingIds = new Set(beforeMail.items.map((message) => message.ID));
  await page.goto("/booking");

  await page.getByRole("button", { name: /Matematika/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await expect(page.getByRole("heading", { name: /Izaberi profesora/i })).toBeVisible();
  await page.getByRole("button", { name: /Luka Bura/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();

  await page.getByRole("button", { name: /60 minuta/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await page.getByRole("button", { name: /Online/i }).click();
  await page.getByRole("button", { name: /Individualni/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();

  await page.locator(".booking-date-card").nth(1).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await expect(page.locator(".booking-slot-card").first()).toBeVisible();
  await page.locator(".booking-slot-card").first().click();
  await page.getByRole("button", { name: /Nastavi/i }).click();

  await page.locator("#client-name").fill("E2E BrainStorm Klijent");
  await page.locator("#client-email").fill("e2e.booking@brainstorm.rs");
  await page.locator("#client-category").selectOption("srednja");
  await page.locator("#client-note").fill("Automatski E2E test kompletnog booking toka.");
  await page.locator('.booking-dropzone input[type="file"]').setInputFiles({
    name: "zadatak.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
  });
  await expect(page.getByText("zadatak.pdf")).toBeVisible();
  await page.getByRole("button", { name: /Pregledaj/i }).click();
  await expect(page.getByRole("heading", { name: /Potvrdi rezervaciju/i })).toBeVisible();
  const bookingResponse = page.waitForResponse((response) => response.url().includes("/public/bookings") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Potvrdi rezervaciju/i }).click();

  await expect(page.getByRole("heading", { name: "Vidimo se!" })).toBeVisible();
  expect((await (await bookingResponse).json()).notification_delivery).toEqual({ sent: 0, captured: 3, failed: 0, total: 3, status: "captured" });
  await expect(page.getByText(/slanje email potvrda još nije podešeno/i)).toBeVisible();
  await expect(page.getByText(/Potvrda i link za otkazivanje poslati/i)).toHaveCount(0);
  await expect.poll(async () => (await mailState(request)).total, { timeout: 15_000 }).toBeGreaterThanOrEqual(beforeMail.total + 3);
  const afterBookingMail = await mailState(request);
  const confirmationMessages = afterBookingMail.items.filter((message) => !existingIds.has(message.ID));
  const confirmationRecipients = confirmationMessages.flatMap(recipientsOf);
  expect(confirmationRecipients).toEqual(expect.arrayContaining([
    "e2e.booking@brainstorm.rs", "lukabura89@gmail.com", "admin@brainstorm.com",
  ]));
  const clientConfirmation = confirmationMessages.find((message) => recipientsOf(message).includes("e2e.booking@brainstorm.rs"));
  expect(decodedMessageBody(clientConfirmation)).toContain("/cancel/");

  await page.getByRole("link", { name: /Otvori link za otkazivanje/i }).click();
  await expect(page.getByRole("heading", { name: /Otkazivanje časa/i })).toBeVisible();
  await page.locator("#cancel-reason").fill("E2E test — termin se odmah oslobađa.");
  await page.getByRole("button", { name: /Želim da otkažem čas/i }).click();
  await page.getByRole("button", { name: /Da, otkaži/i }).click();
  await expect(page.getByRole("heading", { name: /Čas je otkazan/i })).toBeVisible();
  await expect(page.getByText(/Slanje email obaveštenja još nije podešeno/i)).toBeVisible();
  const confirmationIds = new Set(afterBookingMail.items.map((message) => message.ID));
  await expect.poll(async () => (await mailState(request)).total, { timeout: 15_000 }).toBeGreaterThanOrEqual(beforeMail.total + 6);
  const afterCancellationMail = await mailState(request);
  const cancellationMessages = afterCancellationMail.items.filter((message) => !confirmationIds.has(message.ID));
  expect(cancellationMessages.flatMap(recipientsOf)).toEqual(expect.arrayContaining([
    "e2e.booking@brainstorm.rs", "lukabura89@gmail.com", "admin@brainstorm.com",
  ]));
  expect(cancellationMessages.every((message) => decodedHeader(message.Content.Headers.Subject[0]).includes("Otkazan čas"))).toBeTruthy();
});

test("alternativni tok: grupni čas uživo od 90 minuta dobija učionicu", async ({ page }) => {
  await page.goto("/booking");

  await page.getByRole("button", { name: /Matematika/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await page.getByRole("button", { name: /Luka Bura/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await page.getByRole("button", { name: /90 minuta/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await page.getByRole("button", { name: /Uživo/i }).click();
  await page.getByRole("button", { name: /Grupni/i }).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();

  await page.locator(".booking-date-card").nth(2).click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await expect(page.locator(".booking-slot-card").first()).toBeVisible();
  await page.locator(".booking-slot-card").first().click();
  await page.getByRole("button", { name: /Nastavi/i }).click();
  await page.locator("#client-name").fill("E2E Grupni Klijent");
  await page.locator("#client-email").fill("e2e.booking@brainstorm.rs");
  await page.locator("#client-category").selectOption("faks");
  await page.getByRole("button", { name: /Pregledaj/i }).click();
  await page.getByRole("button", { name: /Potvrdi rezervaciju/i }).click();

  await expect(page.getByRole("heading", { name: "Vidimo se!" })).toBeVisible();
  await expect(page.getByText("Uživo · Grupni")).toBeVisible();
  await expect(page.getByText("Učionica 1")).toBeVisible();

  await page.getByRole("link", { name: /Otvori link za otkazivanje/i }).click();
  await page.getByRole("button", { name: /Želim da otkažem čas/i }).click();
  await page.getByRole("button", { name: /Da, otkaži/i }).click();
  await expect(page.getByRole("heading", { name: /Čas je otkazan/i })).toBeVisible();
});

test("Luka i admin mogu da pristupe svojim panelima", async ({ page }) => {
  await page.goto("/teacher/login");
  await page.locator("#email").fill("lukabura89@gmail.com");
  await page.locator("#password").fill("profesor123");
  await page.getByRole("button", { name: /Otvori moj panel/i }).click();
  await expect(page.getByRole("heading", { name: /Dobrodošli, Luka Bura/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Raspored za narednih 7 dana" })).toBeVisible();

  await page.locator(".animated-tab", { hasText: "Svi časovi" }).click();
  await page.getByRole("button", { name: "Otkazani" }).click();
  const teacherBooking = page.locator(".lesson-row").filter({ hasText: "E2E BrainStorm Klijent" }).first();
  await teacherBooking.locator(".lesson-row-head").click();
  await expect(teacherBooking).toContainText("e2e.booking@brainstorm.rs");
  const teacherDownload = page.waitForEvent("download");
  await teacherBooking.getByRole("button", { name: /zadatak\.pdf/i }).click();
  expect((await teacherDownload).suggestedFilename()).toBe("zadatak.pdf");

  await page.getByRole("button", { name: "Odjavi se" }).first().click();
  await page.goto("/admin/login");
  await page.locator("#admin-email").fill("admin@brainstorm.com");
  await page.locator("#admin-password").fill("admin123");
  await page.getByRole("button", { name: /Otvori kontrolni panel/i }).click();
  await expect(page.getByRole("heading", { name: /Dobrodošli, Admin BrainStorm/i })).toBeVisible();
  await page.locator(".animated-tab", { hasText: "Rezervacije" }).click();
  await page.getByRole("button", { name: "Otkazane" }).click();
  const adminBooking = page.locator(".lesson-row").filter({ hasText: "E2E BrainStorm Klijent" }).first();
  await adminBooking.locator(".lesson-row-head").click();
  await expect(adminBooking).toContainText("e2e.booking@brainstorm.rs");
  const adminDownload = page.waitForEvent("download");
  await adminBooking.getByRole("button", { name: /zadatak\.pdf/i }).click();
  expect((await adminDownload).suggestedFilename()).toBe("zadatak.pdf");
  await page.locator(".animated-tab", { hasText: "Profesori" }).click();
  await expect(page.locator(".item-name", { hasText: "Luka Bura" })).toBeVisible();
  await expect(page.getByText("Matematika").first()).toBeVisible();
  await page.getByRole("button", { name: /Novi profesor/i }).click();
  await expect(page.locator("#new-teacher-name")).toHaveAttribute("type", "text");
  await expect(page.locator("#new-teacher-password")).toHaveAttribute("type", "password");
});
