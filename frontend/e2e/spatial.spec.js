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
  expect((await page.locator(".app-login-trigger").boundingBox()).height).toBeGreaterThanOrEqual(58);
  const brandType = await page.locator(".brand-logo-name > span").evaluateAll(nodes => nodes.map(el => ({ color: getComputedStyle(el).color, size: getComputedStyle(el).fontSize })));
  expect(brandType[0]).toEqual(brandType[1]);
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
  const railWorkspace = await page.locator(".booking-workspace").boundingBox();
  const steps = await page.locator(".stepper").boundingBox();
  const content = await page.locator(".booking-step").boundingBox();
  expect(steps.x).toBeGreaterThanOrEqual(railWorkspace.x);
  expect(steps.width).toBeGreaterThanOrEqual(Math.min(360, Math.max(220, width * .15)) - 1);
  await expect(page.locator(".booking-summary-logo .brand-logo-icon image")).toHaveAttribute("href", "/assets/logo2.png");
  await expect(page.locator(".booking-summary canvas")).toHaveCount(0);
  expect(summary.x).toBeGreaterThan(panel.x + panel.width);
  expect(content.x).toBeGreaterThan(steps.x + steps.width - 2);
  await expect(page.getByRole("button", { name: "Nastavi" })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const card = page.getByRole("button", { name: /Matematika/ });
  const cardBox = await card.boundingBox();
  await page.mouse.move(cardBox.x + 10, cardBox.y + 10);
  const firstTilt = await card.evaluate((el) => getComputedStyle(el).transform);
  await page.mouse.move(cardBox.x + cardBox.width - 10, cardBox.y + cardBox.height - 10);
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).not.toBe(firstTilt);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath(`booking-${width}.png`), fullPage: true, animations: "disabled" });
});

