import { expect, test } from "@playwright/test";

const subjects = ["Srpski jezik", "Matematika", "Informatika", "Fizika", "Hemija", "Engleski jezik", "Nemački jezik", "Ruski jezik"].map((name, index) => ({ id: index + 1, name }));

test("svaka kartica predmeta ima više relevantnih pokretnih formula", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/public/subjects", route => route.fulfill({ json: { items: subjects } }));
  await page.goto("/booking", { waitUntil: "domcontentloaded" });
  const cards = page.locator(".booking-subject-card");
  await expect(cards).toHaveCount(8);
  for (const card of await cards.all()) {
    expect(await card.locator(".science-card-formula").count()).toBeGreaterThanOrEqual(5);
  }
  // A title anchored to an edge would violate the requested dominant, centered layout.
  for (const card of await cards.all()) {
    const geometry = await card.evaluate(el => {
      const card = el.getBoundingClientRect(), title = el.querySelector("strong").getBoundingClientRect();
      return { dx: Math.abs(title.x + title.width / 2 - card.x - card.width / 2), dy: Math.abs(title.y + title.height / 2 - card.y - card.height / 2), height: card.height, fontSize: parseFloat(getComputedStyle(el.querySelector("strong")).fontSize) };
    });
    expect(geometry.dx).toBeLessThan(6);
    expect(geometry.dy).toBeLessThan(geometry.height * .15);
    expect(geometry.fontSize).toBeGreaterThanOrEqual(26);
  }
  const math = page.getByRole("button", { name: /Matematika/ });
  const chemistry = page.getByRole("button", { name: /Hemija/ });
  expect(await math.locator(".science-card-formula").allTextContents()).not.toEqual(await chemistry.locator(".science-card-formula").allTextContents());
  await math.hover();
  // Verify the decorative layers actually move, rather than merely adding text nodes.
  await expect.poll(() => math.locator(".science-card-formula").evaluateAll(elements => elements.filter(el =>
    el.getAnimations({ subtree: true }).some(animation => animation.playState === "running" && animation.effect.getComputedTiming().iterations === Infinity)
  ).length)).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: testInfo.outputPath("subject-formula-layers.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => math.locator(".science-card-formula").evaluateAll(elements => elements.every(el =>
    el.getAnimations({ subtree: true }).every(animation => animation.effect.getComputedTiming().iterations !== Infinity || animation.playState !== "running")
  ))).toBeTruthy();
});
