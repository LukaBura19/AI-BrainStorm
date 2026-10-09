import { expect, test } from "@playwright/test";

test("učenik pravi nalog, zakazuje čas i vidi ga u svom panelu", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", { name: /Prijava/ }).click();
  await page.getByRole("menuitem", { name: /Učenik/ }).click();
  await expect(page).toHaveURL(/\/ucenik\/prijava$/);

  // The green cover slides across and reveals the sign-up form.
  await page.locator(".student-auth-cover-text--login").getByRole("button", { name: "Napravi nalog" }).click();
  await expect(page.locator(".student-auth")).toHaveAttribute("data-mode", "register");
  const email = `e2e.ucenik.${Date.now()}@brainstorm.rs`;
  await page.locator("#student-name").fill("E2E Učenik");
  await page.locator("#student-email").fill(email);
  await page.locator("#student-password").fill("lozinka123");
  await page.locator("#student-category").selectOption("srednja");
  await page.getByRole("button", { name: "Napravi nalog" }).click();
  await expect(page.getByRole("heading", { name: /Zdravo, E2E/ })).toBeVisible();
  await expect(page.getByText("Još nemaš zakazanih časova.")).toBeVisible();

  await page.goto("/booking");
  await page.getByRole("button", { name: /Matematika/i }).click();
  await page.getByRole("button", { name: "Nastavi" }).click();
  await page.getByRole("button", { name: /Luka Bura/i }).click();
  await page.getByRole("button", { name: "Nastavi" }).click();
  await page.getByRole("button", { name: /45 minuta/i }).click();
  await page.getByRole("button", { name: "Nastavi" }).click();
  await page.getByRole("button", { name: /Online/ }).click();
  await page.getByRole("button", { name: "Nastavi" }).click();
  await page.locator(".booking-date-card:not(.is-full)").last().click();
  await page.getByRole("button", { name: "Nastavi" }).click();
  await page.locator(".booking-slot-card").nth(3).click();
  await page.getByRole("button", { name: "Nastavi" }).click();

  // Details come from the student account.
  await expect(page.locator("#client-name")).toHaveValue("E2E Učenik");
  await expect(page.locator("#client-email")).toHaveValue(email);
  await expect(page.getByText(/Zakazuješ sa naloga/)).toBeVisible();
  await page.getByRole("button", { name: "Pregledaj" }).click();
  await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();
  await expect(page.getByRole("heading", { name: "Vidimo se na času!" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Moji časovi" }).click();
  await expect(page).toHaveURL(/\/ucenik\/panel$/);
  const lesson = page.locator(".student-lesson");
  await expect(lesson).toHaveCount(1);
  await expect(lesson).toContainText("Matematika");
  await expect(lesson).toContainText("Tvoj sledeći čas");
  await expect(lesson).toContainText("Besplatno otkazivanje do");

  // Otkazivanje iz panela: potvrda u kartici, razlog, pa čas prelazi u "Otkazani".
  await lesson.getByRole("button", { name: "Otkaži čas" }).click();
  await lesson.getByPlaceholder(/Razlog/).fill("E2E: otkazujem iz panela");
  await lesson.getByRole("button", { name: "Da, otkaži" }).click();
  await expect(page.getByText(/Čas je otkazan\./)).toBeVisible();
  await expect(page.getByText("Još nemaš zakazanih časova.")).toBeVisible();
  await page.locator(".animated-tab", { hasText: "Otkazani" }).click();
  await expect(page.locator(".student-lesson")).toContainText("Otkazano na tvoj zahtev");
  await expect(page.locator(".student-lesson")).toContainText("E2E: otkazujem iz panela");

  await page.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL(/\/ucenik\/prijava$/);
  await page.locator("#student-login-email").fill(email);
  await page.locator("#student-login-password").fill("pogresna");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page.getByText("Pogrešan email ili lozinka.")).toBeVisible();
});

test("cenovnik ima sekcije za školu i fakultet, a meni stranice za maturu", async ({ page }) => {
  await page.goto("/cenovnik");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cenovnik");
  await expect(page.getByText("Jasno, bez sitnih slova")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Osnovna i srednja škola" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fakultet" })).toBeVisible();
  await expect(page.locator(".pricing-main--skola .pricing-card")).toHaveCount(3);
  await expect(page.locator(".pricing-main--fakultet .pricing-card")).toHaveCount(1);

  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  await nav.getByRole("link", { name: "Mala matura" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mala matura" })).toBeVisible();
  await nav.getByRole("link", { name: "Velika matura" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Velika matura" })).toBeVisible();
});
