import { expect, test } from "@playwright/test";

const subjects = ["Srpski jezik", "Matematika", "Informatika", "Fizika", "Hemija", "Engleski jezik", "Nemački jezik", "Ruski jezik"].map((name, index) => ({ id: index + 1, name }));

test("svaka kartica predmeta ima nacrtanu ikonicu i naziv, bez podnaslova", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/public/subjects", route => route.fulfill({ json: { items: subjects } }));
  await page.goto("/booking", { waitUntil: "domcontentloaded" });
  const cards = page.locator(".booking-subject-card");
  await expect(cards).toHaveCount(8);
  for (const card of await cards.all()) {
    // Icons come from the drawn icon set (SVG), not unicode glyphs.
    await expect(card.locator(".booking-subject-glyph svg")).toBeVisible();
    await expect(card.locator("strong")).not.toBeEmpty();
    await expect(card.locator(".booking-subject-tagline")).toHaveCount(0);
  }
  const math = page.getByRole("button", { name: /Matematika/ });
  // A chosen subject switches to the forest "selected" treatment with a check mark.
  await math.click();
  await expect(math).toHaveAttribute("aria-pressed", "true");
  await expect(math.locator(".booking-choice-check")).toBeVisible();
  const [selectedBg, restingBg] = await Promise.all([math, page.getByRole("button", { name: /Hemija/ })].map(card => card.evaluate(el => getComputedStyle(el).backgroundColor)));
  expect(selectedBg).not.toBe(restingBg);
  await page.screenshot({ path: testInfo.outputPath("subject-cards.png"), fullPage: true, animations: "disabled" });
});
