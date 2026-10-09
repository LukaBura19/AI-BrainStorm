import { expect, test } from "@playwright/test";

// Backend se ne menja: stranica snimka i propusnica se presreću, pa test proverava samo plejer u pregledaču.
const LECTURE = "/mala-matura/matematika/procenti";

test("zaštićen snimak se pušta kroz DRM plejer sa propusnicom servera", async ({ page }) => {
  await page.route("**/public/prep/mala-matura/matematika/procenti", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), drm_protected: true } });
  });
  await page.route("**/public/prep/mala-matura/matematika/procenti/playback", (route) =>
    route.fulfill({ json: { src: "https://player.vdocipher.com/v2/?otp=e2e-otp&playbackInfo=e2e-info" } }));

  await page.goto(LECTURE);
  const player = page.locator(".lecture-video iframe");
  await expect(player).toHaveAttribute("src", "https://player.vdocipher.com/v2/?otp=e2e-otp&playbackInfo=e2e-info");
  await expect(player).toHaveAttribute("allow", /encrypted-media/);
  await expect(player).toHaveAttribute("allowfullscreen", "");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Procenti u svakodnevnim zadacima");
});

test("kad propusnica ne stigne, učenik vidi poruku umesto praznog plejera", async ({ page }) => {
  await page.route("**/public/prep/mala-matura/matematika/procenti", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), drm_protected: true } });
  });
  await page.route("**/public/prep/mala-matura/matematika/procenti/playback", (route) =>
    route.fulfill({ status: 503, json: { detail: "Snimak trenutno nije dostupan. Pokušaj kasnije." } }));

  await page.goto(LECTURE);
  await expect(page.getByRole("alert")).toContainText("Snimak trenutno nije dostupan");
  await expect(page.locator(".lecture-video iframe")).toHaveCount(0);
});
