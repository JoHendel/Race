import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

interface ApexWindow {
  apex?: {
    drive?: {
      input: { override: Record<string, unknown> | null };
      car: { speed: number; mesh: { position: { z: number } } };
    };
    race?: { phase: string; playerPlace: number };
  };
}

test("Testgelände: das Auto fährt los", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await expect(page.locator("h1.logo")).toContainText("APEX");
  await page.locator("#start").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex?.drive));
  await expect(page.getByTestId("speed")).toBeVisible();

  await page.evaluate(() => {
    (window as ApexWindow).apex!.drive!.input.override = { throttle: 1 };
  });
  // Auf langsamen CI-Rechnern läuft die Physik langsamer: warten, bis das Auto Tempo hat.
  await page.waitForFunction(() => (window as ApexWindow).apex!.drive!.car.speed > 5, undefined, { timeout: 60_000 });
  await page.waitForFunction(() => (window as ApexWindow).apex!.drive!.car.mesh.position.z > -55, undefined, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("Rennen: Countdown, eine Runde, Ergebnistabelle", async ({ page }) => {
  test.setTimeout(400_000);
  const errors = collectErrors(page);
  await page.goto("./?laps=1&bots=3&autopilot");
  await page.locator("#race").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex?.race));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("place")).toBeVisible();
  await page.waitForFunction(() => (window as ApexWindow).apex!.race!.phase === "racing", undefined, { timeout: 20_000 });
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 360_000 });
  await expect(page.getByTestId("results").locator("tbody tr")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("Online: Host und Client fahren gemeinsam (lokaler Vermittler)", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  const client = await ctx.newPage();
  const hostErrors = collectErrors(host);
  const clientErrors = collectErrors(client);

  await host.goto("./?net=local&autopilot");
  await host.getByTestId("online").click();
  await host.getByTestId("host").click();
  const code = (await host.getByTestId("room-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  await client.goto(`./?room=${code}&net=local&autopilot`);
  await client.getByTestId("ready").click();
  await expect(host.getByTestId("players").locator("li")).toHaveCount(2);
  await expect(host.getByTestId("start-race")).toBeEnabled();
  await host.getByTestId("start-race").click();

  await host.waitForFunction(() => (window as ApexWindow).apex?.race?.phase === "racing", undefined, { timeout: 60_000 });
  await client.waitForFunction(() => (window as ApexWindow).apex?.race?.phase === "racing", undefined, { timeout: 60_000 });
  // Beide Seiten sehen 10 Autos, und das jeweils andere menschliche Auto bewegt sich.
  const view = (page: Page) =>
    page.evaluate(() => {
      type R = { human: boolean; car: { mesh: { position: { x: number; z: number } } } };
      const race = (window as unknown as { apex: { race: { racers: R[]; player: R } } }).apex.race;
      const other = race.racers.find((r) => r.human && r !== race.player)!;
      return { count: race.racers.length, x: other.car.mesh.position.x, z: other.car.mesh.position.z };
    });
  const h0 = await view(host);
  const c0 = await view(client);
  await host.waitForTimeout(5000);
  const h = await view(host);
  const c = await view(client);
  expect(h.count).toBe(10);
  expect(c.count).toBe(10);
  expect(Math.hypot(h.x - h0.x, h.z - h0.z)).toBeGreaterThan(3);
  expect(Math.hypot(c.x - c0.x, c.z - c0.z)).toBeGreaterThan(3);
  expect([...hostErrors, ...clientErrors]).toEqual([]);
  await ctx.close();
});
