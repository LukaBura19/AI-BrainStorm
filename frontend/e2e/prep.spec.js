import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:8002";

const ANSWER = "Krenimo redom.\n\n1. Nova cena je **110%** stare cene.\n2. Zato je 1,1 · x = 1320.\n3. Delimo sa 1,1: x = **1200 dinara**.";
const streamOf = (text) => [...text.match(/.{1,10}/gs).map((chunk) => ({ type: "delta", text: chunk })), { type: "done", stop_reason: "end_turn" }];

/**
 * The assistant is mocked: lecture pages report it as switched on and every question gets `reply`.
 * Returns the request bodies the page sent, so the conversation history can be checked.
 */
async function mockAssistant(page, { available = true, reply = streamOf(ANSWER) } = {}) {
  await page.route(/\/public\/prep\/[^/]+\/[^/]+\/[^/]+$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...(await response.json()), chat_available: available } });
  });
  const sent = [];
  await page.route(/\/public\/prep\/.+\/chat$/, async (route) => {
    sent.push(route.request().postDataJSON());
    const body = reply.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });
  return sent;
}

/** Seed nalog matura@brainstorm.com ima plaćene obe pripreme: tek tada snimak šalje tekst zadataka i pušta asistenta. */
async function signInAsPaidStudent(page, request) {
  const login = await request.post(`${API_URL}/auth/student/login`, { data: { email: "matura@brainstorm.com", password: "matura123" } });
  expect(login.ok()).toBeTruthy();
  const { access_token: token } = await login.json();
  await page.addInitScript((value) => { localStorage.setItem("token", value); localStorage.setItem("role", "student"); }, token);
}

test("mala matura: srpski i matematika po nivoima, snimak sa asistentom", async ({ page, request }) => {
  const sent = await mockAssistant(page);
  await page.goto("/mala-matura");
  await expect(page.getByRole("heading", { level: 1, name: "Mala matura" })).toBeVisible();
  await expect(page.getByText("Pripreme za prijemni za srednju školu")).toBeVisible();
  await expect(page.getByText(/rešenih zadataka .* iz prethodnih godina/)).toBeVisible();
  await expect(page.getByText(/kombinovan/i)).toHaveCount(0);
  for (const level of ["Osnovni nivo", "Srednji nivo", "Napredni nivo"]) {
    await expect(page.getByRole("heading", { name: level })).toBeVisible();
  }

  await page.getByRole("button", { name: "Srpski jezik" }).click();
  await expect(page).toHaveURL(/predmet=srpski-jezik/);
  await expect(page.getByRole("link", { name: /Padeži/ })).toBeVisible();
  await page.getByRole("button", { name: "Matematika" }).click();

  await page.getByRole("link", { name: /Procenti u svakodnevnim zadacima/ }).click();
  await expect(page).toHaveURL(/\/mala-matura\/matematika\/procenti$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procenti u svakodnevnim zadacima");
  await expect(page.getByText("Snimak stiže uskoro")).toBeVisible();

  // Bez uplate: broj zadataka bez teksta, asistent zaključan.
  await expect(page.locator(".lecture-tasks--locked li")).toHaveCount(3);
  await expect(page.locator(".lecture-tasks li p")).toHaveCount(0);
  await expect(page.getByText(/Asistent je deo plaćenog pristupa/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tvoje pitanje" })).toBeDisabled();

  await signInAsPaidStudent(page, request);
  await page.reload();
  await expect(page.locator(".lecture-tasks li p")).toHaveCount(3);

  // "Pitaj" puts the question into the chat; the answer is streamed in and rendered as a list.
  await page.getByRole("button", { name: "Pitaj asistenta o 3. zadatku" }).click();
  const input = page.getByRole("textbox", { name: "Tvoje pitanje" });
  await expect(input).toHaveValue("Objasni mi 3. zadatak.");
  await input.press("Enter");
  const log = page.getByRole("log", { name: "Razgovor sa asistentom" });
  await expect(log.locator(".chat-msg--assistant ol li")).toHaveCount(3);
  await expect(log.locator(".chat-msg--assistant strong").last()).toHaveText("1200 dinara");
  expect(sent[0].messages).toEqual([{ role: "user", content: "Objasni mi 3. zadatak." }]);

  // Follow-up questions carry the earlier conversation.
  await input.fill("A zašto baš 1,1?");
  await page.getByRole("button", { name: "Pošalji pitanje" }).click();
  await expect(log.locator(".chat-msg--assistant")).toHaveCount(2);
  expect(sent[1].messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
  expect(sent[1].messages[1].content).toBe(ANSWER);

  // The conversation survives a reload of the same lecture, and "Novi razgovor" clears it.
  await page.reload();
  await expect(log.getByText("A zašto baš 1,1?")).toBeVisible();
  await page.getByRole("button", { name: "Novi razgovor" }).click();
  await expect(log.getByText(/Pitaj me o zadacima sa ovog snimka/)).toBeVisible();

  await page.getByRole("link", { name: /Sledeći snimak/ }).click();
  await expect(page).toHaveURL(/\/mala-matura\/matematika\/linearne-jednacine$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Linearne jednačine i nejednačine");
});

test("velika matura: matematika po oblastima", async ({ page, request }) => {
  await page.goto("/velika-matura");
  await expect(page.getByRole("heading", { level: 1, name: "Velika matura" })).toBeVisible();
  await expect(page.getByText("Pripreme za prijemni za fakultet")).toBeVisible();
  await expect(page.getByText("PMF, ETF, FON, Mašinski, Građevinski, Ekonomski")).toBeVisible();
  for (const topic of ["Algebra", "Trigonometrija", "Logaritmi"]) {
    await expect(page.getByRole("heading", { name: topic, exact: true })).toBeVisible();
  }
  await expect(page.locator(".prep-tabs")).toHaveCount(0);
  await page.getByRole("link", { name: /Logaritmi i logaritamske jednačine/ }).click();
  await expect(page).toHaveURL(/\/velika-matura\/matematika\/logaritamske-jednacine$/);
  await expect(page.locator(".lecture-tasks--locked")).toBeVisible();
  await expect(page.locator(".lecture-tasks")).not.toContainText("log₃ (x − 1) = 2");
  await signInAsPaidStudent(page, request);
  await page.reload();
  await expect(page.locator(".lecture-tasks")).toContainText("log₃ (x − 1) = 2");
});

test("asistent: isključen bez ključa, greške i odbijen odgovor", async ({ page, request }) => {
  await signInAsPaidStudent(page, request);
  await mockAssistant(page, { available: false });
  await page.goto("/velika-matura/matematika/kvadratna-jednacina");
  await expect(page.getByText("Asistent još nije uključen. Do tada zadatke možeš da prođeš sa profesorom na času.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tvoje pitanje" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Pitaj asistenta o/ })).toHaveCount(0);

  await page.unrouteAll({ behavior: "wait" });
  await mockAssistant(page, { reply: [{ type: "error", message: "Asistent je trenutno zauzet. Pokušaj ponovo za minut." }] });
  await page.reload();
  const input = page.getByRole("textbox", { name: "Tvoje pitanje" });
  await input.fill("Kako se računa diskriminanta?");
  await input.press("Enter");
  await expect(page.locator(".chat-msg--user.is-failed")).toContainText("Asistent je trenutno zauzet.");
  await expect(page.getByRole("button", { name: "Pošalji ponovo" })).toBeVisible();

  await page.unrouteAll({ behavior: "wait" });
  await mockAssistant(page, { reply: [{ type: "delta", text: "Ovo" }, { type: "refusal", message: "Na ovo pitanje asistent ne može da odgovori. Pitaj nešto o zadacima sa snimka." }] });
  await page.getByRole("button", { name: "Pošalji ponovo" }).click();
  await expect(page.locator(".chat-msg--assistant .chat-bubble.is-muted")).toHaveText(/Pitaj nešto o zadacima sa snimka/);
  await expect(page.locator(".chat-msg--user.is-failed")).toHaveCount(0);
});
