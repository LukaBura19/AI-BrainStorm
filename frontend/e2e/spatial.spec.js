import { test, expect } from "@playwright/test";

const subjects = ["Srpski jezik", "Matematika", "Informatika", "Fizika", "Hemija", "Engleski jezik", "Nemački jezik", "Ruski jezik"].map((name, index) => ({ id: index + 1, name }));

for (const width of [1440, 1920, 2560]) test(`radni prostor koristi celu širinu ekrana ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/public/subjects", (route) => route.fulfill({ json: { items: subjects } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-background-video")).toBeVisible();
  for (const selector of [".app-header-inner", ".home-hero-layout"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box.width, `${selector} treba da koristi najmanje 94% širine`).toBeGreaterThanOrEqual(width * .94);
  }
  await expect(page.getByRole("link", { name: "Zakaži svoj čas" })).toBeInViewport({ ratio: 1 });
  const brand = await page.locator(".app-header-brand").boundingBox();
  const navigation = await page.locator(".app-header-nav").boundingBox();
  expect(navigation.x - brand.x - brand.width).toBeLessThan(85);
  expect((await page.locator(".app-login-trigger").boundingBox()).height).toBeGreaterThanOrEqual(44);
  // The original brain artwork stays the brand mark beside the "BrainStorm" wordmark.
  await expect(page.locator(".app-header-brand .brand-logo-icon image")).toHaveAttribute("href", "/assets/logo2.png");
  await expect(page.locator(".brand-logo-name > span")).toHaveText(["BrainStorm", "Edukativni centar"]);
  await expect(page.locator("footer")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "Zakaži svoj čas" }).click();
  await expect(page.getByRole("heading", { name: "Izaberi predmet" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const workspace = await page.locator(".booking-page").boundingBox();
  expect(workspace.width).toBeGreaterThanOrEqual(width * .94);
  const summary = await page.locator(".booking-summary").boundingBox();
  expect(width - summary.x - summary.width).toBeLessThanOrEqual(40);
  const panel = await page.locator(".booking-panel").boundingBox();
  const journey = await page.locator(".journey").boundingBox();
  // The synapse progress spans the top of the workspace, above the step panel.
  expect(journey.width).toBeGreaterThanOrEqual(width * .5);
  expect(journey.y + journey.height).toBeLessThanOrEqual(panel.y + 2);
  await expect(page.locator(".journey-node")).toHaveCount(8);
  await expect(page.locator(".booking-summary canvas")).toHaveCount(0);
  expect(summary.x).toBeGreaterThan(panel.x + panel.width);
  await expect(page.getByRole("button", { name: "Nastavi" })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const card = page.getByRole("button", { name: /Matematika/ });
  // Let the card's entrance animation settle before measuring the pointer tilt.
  await card.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  const cardBox = await card.boundingBox();
  await page.mouse.move(0, 0);
  const resting = await card.evaluate((el) => getComputedStyle(el).transform);
  // Hovering lifts the card slightly.
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).not.toBe(resting);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath(`booking-${width}.png`), fullPage: true, animations: "disabled" });
});

