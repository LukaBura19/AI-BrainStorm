import { expect, test } from "@playwright/test";

// Presentation checks intercept every public API request. No reservations or mail are sent.
const subjects = ["Srpski jezik", "Matematika", "Informatika", "Fizika", "Hemija", "Engleski jezik", "Nemački jezik", "Ruski jezik"].map((name, index) => ({ id: index + 1, name }));
const headings = ["Izaberi predmet", "Izaberi profesora", "Koliko vremena ti treba?", "Podesi vrstu časa", "Izaberi dan", "Izaberi vreme", "Unesi svoje podatke", "Potvrdi rezervaciju"];

const go = (page, path) => page.goto(path, { waitUntil: "domcontentloaded" });
const top = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

async function fixtureAPI(page, { conflict = false, emptyTeachers = false, denseSlots = false } = {}) {
  const state = { submissions: [], availability: [], unexpected: [] };
  await page.route("**/public/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const send = (json, status = 200) => route.fulfill({ status, json });
    if (url.pathname === "/public/subjects") return send({ items: subjects });
    if (url.pathname === "/public/teachers") return send({ items: emptyTeachers ? [] : [
      { id: 41, full_name: "Luka Bura", subjects: [{ id: 2, name: "Matematika" }, { id: 3, name: "Informatika" }] }, { id: 42, full_name: "Drugi Profesor", subjects: [] },
    ] });
    if (url.pathname === "/public/available-slots") {
      state.availability.push(Object.fromEntries(url.searchParams));
      const day = url.searchParams.get("date");
      const duration = Number(url.searchParams.get("duration"));
      const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Belgrade", timeZoneName: "longOffset" })
        .formatToParts(new Date(`${day}T12:00:00Z`)).find((part) => part.type === "timeZoneName").value.replace("GMT", "");
      const closingTime = new Date(`${day}T20:00:00${offset}`);
      const slots = Array.from({ length: denseSlots ? 24 : 12 }, (_, index) => {
        const minutes = 480 + index * (denseSlots ? 30 : 60);
        const start = new Date(`${day}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00${offset}`);
        return { start_time: start.toISOString(), end_time: new Date(start.getTime() + duration * 60000).toISOString() };
      }).filter((slot) => new Date(slot.end_time) <= closingTime);
      return send({ slots });
    }
    if (url.pathname === "/public/bookings" && request.method() === "POST") {
      const form = await new Response(request.postDataBuffer(), { headers: { "Content-Type": request.headers()["content-type"] } }).formData();
      const data = Object.fromEntries(form);
      const attachments = form.getAll("attachments").map((file, index) => ({ id: index + 1, original_name: file.name }));
      state.submissions.push({ ...data, attachments });
      if (conflict) return send({ detail: "Termin je zauzet" }, 409);
      return send({ ...data, id: 2048, duration_minutes: Number(data.duration), subject_name: "Matematika", teacher_name: "Luka Bura",
        end_time: new Date(new Date(data.start_time).getTime() + Number(data.duration) * 60000).toISOString(),
        classroom_number: data.delivery_mode === "online" ? null : 1, attachments,
        client_cancel_token: "design-preview-only", notification_delivery: { status: "captured", total: 3, captured: 3, sent: 0, failed: 0 },
      });
    }
    state.unexpected.push(`${request.method()} ${url.pathname}`);
    return route.abort();
  });
  return state;
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
}
const next = (page) => page.getByRole("button", { name: "Nastavi" }).click();

test("naslovi koraka se ispisuju bez pomeranja kartica i čitaju se u celosti", async ({ page }) => {
  await fixtureAPI(page);
  await go(page, "/booking");
  const title = page.getByRole("heading", { name: "Izaberi predmet", exact: true });
  await expect(title).toBeVisible();
  const typed = title.locator(".typewriter-text");
  await expect(typed).toHaveAttribute("data-typing", "typing");
  const card = page.locator(".booking-subject-card").first();
  await expect(card).toBeVisible();
  // Wait for the step's separate entrance, then measure the typing layout.
  await expect.poll(() => page.locator(".booking-step").evaluate(el => getComputedStyle(el).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
  // Cards rise in with their own entrance animation; measure layout once it has settled.
  await card.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  const before = await card.boundingBox();
  await expect(typed).toHaveAttribute("data-typing", "done");
  expect(Math.abs((await card.boundingBox()).y - before.y)).toBeLessThan(2);
  await page.getByRole("button", { name: /Matematika/ }).click();
  await next(page);
  const professor = page.getByRole("heading", { name: "Izaberi profesora", exact: true });
  await expect(professor.locator(".typewriter-text")).toHaveAttribute("data-typing", "typing");
  await expect(professor.locator(".typewriter-text")).toHaveAttribute("data-typing", "done");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /Luka Bura/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Koliko vremena ti treba?" }).locator(".typewriter-text")).toHaveAttribute("data-typing", "done");
});

async function toClient(page, capture = async () => {}, { expectedSlots = 12 } = {}) {
  await go(page, "/booking");
  await capture(1);
  await expect(page.getByRole("button", { name: "Nastavi" })).toBeDisabled();
  await page.getByRole("button", { name: /Matematika/ }).click();
  if (page.viewportSize().width <= 820) await expect(page.locator(".booking-summary-toggle")).toContainText("Matematika");
  await next(page);
  await expect(page.locator(".booking-teacher-card:not([data-preview])")).toHaveCount(1);
  await expect(page.locator(".booking-teacher-preview")).toHaveCount(5);
  for (const preview of await page.locator(".booking-teacher-preview").all()) await expect(preview).toBeDisabled();
  await expect(page.getByRole("button", { name: /Drugi Profesor/ })).toHaveCount(0);
  await expect(page.locator(".booking-teacher-card:not([data-preview]) .booking-teacher-subjects")).toHaveText("InformatikaMatematika");
  for (const card of await page.locator(".booking-teacher-card").all()) await expect(card.locator(".booking-teacher-subjects > span")).toHaveCount(2);
  await page.getByRole("button", { name: /Luka Bura/ }).click();
  await capture(2);
  await next(page);
  await capture(3);
  const duration = page.getByRole("button", { name: /60 minuta/ });
  await duration.hover();
  // Hovering fills the duration ring all the way to its share of 90 minutes.
  await expect.poll(() => duration.locator(".duration-ring-fill").evaluate((ring) => Number(getComputedStyle(ring).strokeDashoffset.match(/[\d.]+/)?.[0]))).toBeLessThan(60);
  await duration.click();
  await next(page);
  await page.getByRole("button", { name: /Online/ }).click();
  await capture(4);
  const formatPanels = page.locator(".booking-format-panel");
  await expect(formatPanels).toHaveCount(2);
  if (page.viewportSize().width >= 1440) {
    const boxes = await formatPanels.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
    expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(2);
    expect(boxes[1].left).toBeGreaterThanOrEqual(boxes[0].right);
  }
  for (const panel of await formatPanels.all()) expect(await panel.evaluate(el => {
    const panel = el.getBoundingClientRect(), art = el.querySelector(".booking-format-visual svg").getBoundingClientRect();
    return art.left >= panel.left && art.right <= panel.right && art.top >= panel.top && art.bottom <= panel.bottom;
  })).toBeTruthy();
  await page.getByRole("button", { name: "Grupni", exact: true }).click();
  await expect(page.locator('.booking-format-visual[data-mode="group"]')).toBeVisible();
  await expect(page.locator('.booking-format-visual[data-mode="group"] [data-session-person]')).toHaveCount(3);
  await page.getByRole("button", { name: "Individualni", exact: true }).click();
  await expect(page.locator('.booking-format-visual[data-mode="individual"]')).toBeVisible();
  await expect(page.locator('.booking-format-visual[data-mode="individual"] [data-session-person]')).toHaveCount(1);
  // Oversized transforms must not move the actual type icon outside its card.
  for (const card of await page.locator(".booking-option-card").all()) {
    await card.hover();
    expect(await card.evaluate(el => new Promise(resolve => {
      const start = performance.now();
      const sample = () => {
        const card = el.getBoundingClientRect(), icon = el.querySelector(".booking-option-icon").getBoundingClientRect();
        if (icon.left < card.left + 2 || icon.right > card.right - 2 || icon.top < card.top + 2 || icon.bottom > card.bottom - 2) return resolve(false);
        if (performance.now() - start >= 450) return resolve(true);
        requestAnimationFrame(sample);
      };
      sample();
    }))).toBeTruthy();
    await card.focus();
    expect(await card.evaluate(el => {
      const card = el.getBoundingClientRect(), icon = el.querySelector(".booking-option-icon").getBoundingClientRect();
      return icon.left >= card.left && icon.right <= card.right && icon.top >= card.top && icon.bottom <= card.bottom;
    })).toBeTruthy();
  }
  await next(page);
  await expect(page.locator(".booking-date-card")).toHaveCount(14);
  expect(await page.locator(".booking-date-card strong").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(page.viewportSize().width <= 640 ? 20 : 28);
  expect(await page.locator(".booking-date-card small").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10);
  // Days no longer carry slot counts.
  await expect(page.locator(".booking-date-card .booking-date-availability")).toHaveCount(0);
  await page.locator(".booking-date-card").nth(1).click();
  await capture(5);
  await next(page);
  await expect(page.locator(".booking-slot-card")).toHaveCount(expectedSlots);
  await expect(page.locator(".booking-slot-card").first().locator(".booking-slot-start")).toHaveText("Početak časa08:00");
  await expect(page.locator(".booking-slot-card").first().locator(".booking-slot-end")).toHaveText("Završetak09:00");
  await page.locator(".booking-slot-card").first().click();
  await capture(6);
  await next(page);
  await expect(page.locator(".booking-form-panel")).toHaveCount(3);
  await expect(page.locator(".booking-details-section-head h3")).toHaveText(["Kontakt", "O času", "Materijali"]);
  // Panels animate in; poll until they have settled inside the main card.
  await expect.poll(() => page.locator(".booking-panel").evaluate(parent => {
    const bounds = parent.getBoundingClientRect();
    return [...parent.querySelectorAll(".booking-form-panel")].every(panel => {
      const rect = panel.getBoundingClientRect();
      return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
    });
  })).toBeTruthy();
  await capture(7);
}
async function clientDetails(page) {
  await page.getByLabel("Ime i prezime").fill("Ana Jovanović");
  await page.getByLabel("Email adresa").fill("ana@example.test");
  await page.getByLabel("Nivo obrazovanja").selectOption("srednja");
  await page.getByLabel("Šta želiš da radite?").fill("Kvadratne jednačine i priprema za kontrolni.");
  await page.locator('input[type="file"]').setInputFiles({ name: "zadatak.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 320, height: 812 }]) {
  test(`svih osam koraka i puna potvrda na ${viewport.width}px`, async ({ page }, testInfo) => {
    // Eight full-page captures plus hover sampling need a larger overall budget;
    // individual readiness and interaction expectations retain their normal limits.
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    const api = await fixtureAPI(page);
    const capture = async (step) => {
      await expect(page.getByRole("heading", { name: headings[step - 1], exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: headings[step - 1], exact: true })).toBeInViewport();
      await expect(page.locator(".booking-step-heading .typewriter-text")).toHaveAttribute("data-typing", "done");
      await expect(page.locator(".booking-page")).not.toContainText(/Prava podrška za svako tvoje pitanje|Ako nisi siguran|Izaberi gde se održava čas|Termini se prikazuju prema|vreme Beograd|Slobodni termini u realnom vremenu|Bez registracije|Izbor možeš da promeniš povratkom|AHA/);
      await expect(page.locator("footer")).toHaveCount(0);
      await fits(page);
      await top(page);
      await page.screenshot({ path: testInfo.outputPath(`step-${step}.png`), fullPage: true, animations: "disabled" });
    };
    await toClient(page, capture);
    await page.getByRole("button", { name: "Pregledaj" }).click();
    await expect(page.getByText("Unesite email adresu.", { exact: true })).toBeVisible();
    expect(api.submissions).toHaveLength(0);
    await clientDetails(page);
    await expect(page.getByText("zadatak.pdf", { exact: true })).toBeVisible();
    // The running summary is checked on the details step; the review step shows everything itself.
    const summary = page.getByRole("complementary", { name: "Pregled izbora" });
    if (viewport.width < 821) {
      const toggle = summary.getByRole("button", { name: /Tvoj izbor/ });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(summary).toContainText("Luka Bura");
      await page.screenshot({ path: testInfo.outputPath("summary-expanded.png"), fullPage: true, animations: "disabled" });
      await toggle.click();
    } else {
      const panelBox = await page.locator(".booking-panel").boundingBox();
      const summaryBox = await summary.boundingBox();
      expect(summaryBox.x).toBeGreaterThan(panelBox.x + panelBox.width);
      await expect(summary).toContainText("Luka Bura");
    }
    await page.getByRole("button", { name: "Pregledaj" }).click();
    await capture(8);
    await expect(summary).toHaveCount(0);
    await expect(page.locator(".booking-review")).toContainText("Luka Bura");
    await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();
    await expect(page.getByRole("dialog")).toContainText("Hvala vam što ste zakazali čas");
    await page.getByRole("button", { name: "Pogledaj detalje časa" }).click();
    await expect(page.getByRole("heading", { name: "Vidimo se na času!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vidimo se na času!" })).toBeInViewport();
    await expect(page.locator(".booking-success-contact")).toContainText("Ana Jovanović");
    await expect(page.locator(".booking-success-contact")).toContainText("zadatak.pdf");
    await expect(page.locator(".booking-success-ticket")).toContainText("60 minuta");
    await expect(page.locator(".booking-success-ticket")).toContainText("Srednja škola");
    await expect(page.getByText(/slanje email potvrda još nije podešeno/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Otvori link za otkazivanje" })).toHaveAttribute("href", "/cancel/design-preview-only");
    await fits(page);
    await top(page);
    await expect(page.locator("#success-title .typewriter-text")).toHaveAttribute("data-typing", "done");
    await page.screenshot({ path: testInfo.outputPath("success.png"), fullPage: true, animations: "disabled" });
    expect(api.submissions).toHaveLength(1);
    expect(api.submissions[0]).toMatchObject({ teacher_id: "41", subject_id: "2", duration: "60", delivery_mode: "online", session_type: "individual", client_email: "ana@example.test", attachments: [{ id: 1, original_name: "zadatak.pdf" }] });
    expect(api.availability.at(-1)).toMatchObject({ teacher_id: "41", duration: "60", delivery_mode: "online" });
    expect(api.unexpected).toEqual([]);
    expect(problems).toEqual([]);
    await page.getByRole("button", { name: "Zakaži još jedan čas" }).click();
    await expect(page.getByRole("heading", { name: "Izaberi predmet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nastavi" })).toBeDisabled();
  });
}

for (const width of [320, 375, 768, 1024, 1888]) test(`smanjeno kretanje i navigacija na ${width}px`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtureAPI(page);
  await page.setViewportSize({ width, height: 900 });
  await go(page, "/");
  await expect(page.locator(".home-background-video")).toBeVisible();
  await expect(page.getByRole("link", { name: "Zakaži svoj čas" })).toBeVisible();
  if (width > 760) expect((await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Zakaži čas" }).boundingBox()).height).toBeLessThan(60);
  await fits(page);
  const video = page.locator(".home-background-video");
  await expect.poll(() => video.evaluate(el => el.readyState)).toBeGreaterThanOrEqual(2);
  const still = await video.evaluate(el => el.currentTime);
  await page.mouse.move(40, 300);
  await page.mouse.move(Math.min(width - 20, 500), 300, { steps: 5 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 160)));
  expect(await video.evaluate(el => el.currentTime)).toBe(still);
  expect(await video.evaluate(el => el.paused)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
  await go(page, "/booking");
  await expect(page.locator(".booking-subject-card")).toHaveCount(8);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath(`subjects-${width}.png`), fullPage: true });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.getByRole("button", { name: "Otvori meni" }).click();
  await page.getByRole("navigation", { name: "Glavna navigacija" }).getByRole("link", { name: "Cenovnik" }).click();
  await expect(page).toHaveURL(/\/cenovnik$/);
  await fits(page);
});

test("zauzet termin vraća izbor vremena bez gubitka podataka", async ({ page }) => {
  const api = await fixtureAPI(page, { conflict: true });
  await toClient(page);
  await clientDetails(page);
  await page.getByRole("button", { name: "Pregledaj" }).click();
  await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();
  await expect(page.getByRole("heading", { name: "Izaberi vreme" })).toBeVisible();
  await expect(page.getByText(/Taj termin je upravo zauzet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Nastavi" })).toBeDisabled();
  await page.locator(".booking-slot-card").nth(1).click();
  await next(page);
  await expect(page.getByLabel("Ime i prezime")).toHaveValue("Ana Jovanović");
  await expect(page.getByText("zadatak.pdf", { exact: true })).toBeVisible();
  expect(api.submissions).toHaveLength(1);
});

test("predmet bez profesora nudi povratak i ne može da nastavi", async ({ page }) => {
  await fixtureAPI(page, { emptyTeachers: true });
  await go(page, "/booking");
  await page.getByRole("button", { name: /Matematika/ }).click();
  await next(page);
  await expect(page.getByText("Trenutno nema aktivnog profesora za ovaj predmet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nastavi" })).toBeDisabled();
  await page.getByRole("button", { name: "Izaberi drugi predmet" }).click();
  await expect(page.getByRole("heading", { name: "Izaberi predmet" })).toBeVisible();
});

test("tri dela forme ostaju unutar glavne kartice pri promeni raspoložive širine", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixtureAPI(page);
  await toClient(page);
  await clientDetails(page);
  await page.getByLabel("Ime i prezime").fill("Ana Marija Jovanović Petrović");
  const remove = page.getByRole("button", { name: "Ukloni zadatak.pdf" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".booking-file-list li")).toHaveCount(0);
  const choose = page.getByRole("button", { name: "izaberi sa uređaja" });
  await choose.focus();
  const fileChooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await fileChooser).setFiles({ name: "priprema-za-kontrolni-iz-matematike-kvadratne-jednacine.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(page.locator(".booking-file-list li")).toHaveCount(1);
  const positions = await page.locator(".booking-form-panel").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top));
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  for (const width of [1920, 1366, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await fits(page);
    expect(await page.locator(".booking-details").evaluate(parent => {
      const bounds = parent.getBoundingClientRect();
      return [...parent.querySelectorAll(".booking-form-panel, .input, .select, .textarea, .booking-file-list li, .booking-file-list button")].every(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right && rect.bottom <= bounds.bottom;
      });
    })).toBeTruthy();
    await top(page);
    await page.screenshot({ path: testInfo.outputPath(`form-${width}.png`), fullPage: true, animations: "disabled" });
  }
});


test("23 termina ostaju čitljiva i dostupna u rasporedu nalik kalendaru", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fixtureAPI(page, { denseSlots: true });
  await toClient(page, async step => {
    if (step !== 6) return;
    const cards = page.locator(".booking-slot-card");
    await expect(cards.last()).toContainText("19:00");
    await expect(cards.last().locator(".booking-slot-end strong")).toHaveText("20:00");
    for (const width of [1920, 375]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.mouse.move(0, 0);
      await fits(page);
      for (const card of await cards.all()) {
        expect(await card.evaluate(el => {
          // Each start time stays readable inside its tile; the end time appears once a slot is chosen.
          const tile = el.getBoundingClientRect();
          const start = el.querySelector(".booking-slot-start strong").getBoundingClientRect();
          return start.width > 0 && start.left >= tile.left && start.right <= tile.right && start.top >= tile.top && start.bottom <= tile.bottom;
        })).toBeTruthy();
      }
      await top(page);
      await page.screenshot({ path: testInfo.outputPath(`dense-times-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }, { expectedSlots: 23 });
});
