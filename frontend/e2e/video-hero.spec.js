import { test, expect } from "@playwright/test";

const ready = async page => {
  const video = page.locator(".home-background-video");
  await expect.poll(() => video.evaluate(el => el.readyState)).toBeGreaterThanOrEqual(2);
  return video;
};

test("početni video miruje i prati horizontalni pokret miša", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = page.locator(".home-background-video");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(el => el.readyState)).toBeGreaterThanOrEqual(2);
  const initial = await video.evaluate(el => ({ time: el.currentTime, paused: el.paused, autoplay: el.autoplay, duration: el.duration }));
  expect(initial.paused).toBeTruthy();
  expect(initial.autoplay).toBeFalsy();
  expect(initial.duration).toBeGreaterThan(3);
  await page.mouse.move(100, 350);
  await page.mouse.move(1050, 350, { steps: 8 });
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(initial.time + 0.5);
  await page.mouse.move(200, 350, { steps: 8 });
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeLessThan(1);
  expect(await video.evaluate(el => el.paused)).toBeTruthy();
  await expect(page.getByRole("link", { name: "Zakaži svoj čas", exact: true })).toBeVisible();
});

test("brzi pokreti ne preklapaju seek zahteve i kadar ostaje u granicama videa", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
    window.overlappingSeeks = 0;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      ...descriptor,
      set(value) { if (this.seeking) window.overlappingSeeks++; return descriptor.set.call(this, value); },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = await ready(page);
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 0 }));
    for (let i = 0; i < 60; i++) window.dispatchEvent(new MouseEvent("mousemove", { clientX: i % 2 ? innerWidth : 0 }));
  });
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("mousemove", { clientX: innerWidth * 4 })));
  await expect.poll(() => video.evaluate(el => el.duration - el.currentTime)).toBeLessThan(.05);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("mousemove", { clientX: -innerWidth * 4 })));
  await expect.poll(() => video.evaluate(el => el.currentTime)).toBeLessThan(.02);
  expect(await page.evaluate(() => window.overlappingSeeks)).toBe(0);
  expect(await video.evaluate(el => el.paused)).toBeTruthy();
});

test("zakazivanje je dostupno dok se poruka još ispisuje i tekst ne pomera dugmad", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const cta = page.getByRole("link", { name: "Zakaži svoj čas", exact: true });
  await expect(cta).toBeVisible();
  await expect(page.locator(".home-typewriter")).toHaveAttribute("data-typing", "typing");
  // Finish the short reveal transition before comparing the reserved text space.
  await expect.poll(() => cta.evaluate(el => getComputedStyle(el.parentElement).opacity)).toBe("1");
  const before = await cta.boundingBox();
  await expect(page.locator(".home-typewriter")).toHaveAttribute("data-typing", "done");
  const after = await cta.boundingBox();
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  await page.route("**/public/**", route => route.fulfill({ json: { items: [] } }));
  await cta.click();
  await expect(page).toHaveURL(/\/booking$/);
  await expect(page.locator(".home-background-video")).toHaveCount(0);
});

test("smanjeno kretanje čuva miran kadar bez vidljive video kontrole", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const video = await ready(page);
  await expect(page.locator(".home-typewriter")).toHaveAttribute("data-typing", "done");
  await page.mouse.move(100, 300);
  await page.mouse.move(1100, 300, { steps: 6 });
  expect(await video.evaluate(el => el.currentTime)).toBe(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByText("Pokreni pogled.")).toHaveCount(0);
  expect(await video.evaluate(el => el.paused)).toBeTruthy();
});

test("naslovna slika i zakazivanje ostaju dostupni kada video ne može da se učita", async ({ page }) => {
  await page.route("**/assets/brainstorm-interface.mp4", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-video-backdrop")).toHaveAttribute("data-media-state", "error");
  await expect(page.locator(".home-video-poster")).toBeVisible();
  expect(await page.locator(".home-video-poster").evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Zakaži svoj čas", exact: true })).toBeVisible();
});

test("početna ističe veliki tekst i samo jedno dugme za zakazivanje", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const copy = page.locator(".home-hero-copy");
  await expect(copy.locator("a")).toHaveCount(1);
  await expect(copy.locator("button")).toHaveCount(0);
  await expect(page.locator(".home-blurred-intro")).toHaveCount(0);
  const bounds = await copy.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(60);
  expect(bounds.width).toBeGreaterThanOrEqual(560);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(820);
  expect(await page.locator(".home-typewriter").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(40);
  const cta = copy.getByRole("link", { name: "Zakaži svoj čas" });
  expect((await cta.boundingBox()).height).toBeGreaterThanOrEqual(64);
  await expect(cta).toHaveAttribute("href", "/booking");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Dobro došli u Edukativni centar BrainStorm!");
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
});

test("mobilni meni čuva navigaciju i pristup profesorskoj prijavi", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Otvori meni" }).click();
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  await expect(nav).toBeVisible();
  await page.getByRole("button", { name: "Prijava", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Profesor/ })).toHaveAttribute("href", "/teacher/login");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Otvori meni" })).toBeVisible();
  await page.getByRole("button", { name: "Otvori meni" }).click();
  await nav.getByRole("link", { name: "Cenovnik", exact: true }).click();
  await expect(page).toHaveURL(/\/cenovnik$/);
  await expect(page.getByRole("button", { name: "Otvori meni" })).toHaveAttribute("aria-expanded", "false");
});

test("horizontalni dodir menja kadar a vertikalni pomera stranicu", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const video = await ready(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 70, y: 170 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 240, y: 172 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(.3);
    // Without the removed footer, a tall phone fits the whole landing page.
    // Exercise native scrolling on a short screen that actually needs it.
    await page.setViewportSize({ width: 375, height: 540 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(0);
    const before = await page.evaluate(() => scrollY);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 280, y: 300 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 280, y: 120 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  } finally { await context.close(); }
});

test("mobilni prikaz dozvoljava uvećavanje štipanjem", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    const before = await page.evaluate(() => visualViewport.scale);
    const cdp = await context.newCDPSession(page);
    // Native two-finger input: synthesizePinchGesture is a no-op even on an
    // unrestricted control page in this headless Chrome configuration.
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 145, y: 220 }, { id: 2, x: 235, y: 220 }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: 145 - step * 5, y: 220 }, { id: 2, x: 235 + step * 5, y: 220 }] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBeGreaterThan(before + .2);
  } finally { await context.close(); }
});

test("niski ekran zadržava vrh menija dostupnim posle otvaranja prijave", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Otvori meni" }).click();
  await page.getByRole("button", { name: "Prijava", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Administrator/ })).toBeVisible();
  await page.locator("#main-navigation").evaluate(el => el.scrollTop = 0);
  const topLink = page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Početna", exact: true });
  await expect(topLink).toBeInViewport({ ratio: 1 });
  const menuButton = await page.getByRole("button", { name: "Zatvori meni" }).boundingBox();
  expect((await topLink.boundingBox()).y).toBeGreaterThanOrEqual(menuButton.y + menuButton.height);
  await page.getByRole("menuitem", { name: /Administrator/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("menuitem", { name: /Administrator/ })).toBeInViewport({ ratio: 1 });
});
