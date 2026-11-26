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

test("Language toggle switches the UI between German and English", async ({ page }) => {
  await page.goto("./?lang=de");
  await expect(page.locator("#race")).toHaveText("Rennen gegen Bots");
  await page.getByTestId("lang").click();
  await expect(page.locator("#race")).toHaveText("Race vs. bots");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // the choice is remembered
  await page.goto("./");
  await expect(page.locator("#race")).toHaveText("Race vs. bots");
  await page.getByTestId("lang").click();
  await expect(page.locator("#race")).toHaveText("Rennen gegen Bots");
});

test("Track selection cycles through all tracks and is remembered", async ({ page }) => {
  await page.goto("./?track=neon-harbor");
  const name = page.locator("[data-field=track-name]");
  await expect(name).toHaveText("Neon Harbor");
  await page.getByTestId("track-next").click();
  await expect(name).not.toHaveText("Neon Harbor");
  const picked = await name.textContent();
  await page.goto("./");
  await expect(name).toHaveText(picked!);
});

test("Grand Prix plays the cup of the selected track", async ({ page }) => {
  await page.goto("./?track=jungle-ruins&laps=1&bots=1");
  await expect(page.locator("[data-field=track-cup]")).toHaveText("Turbo Cup");
  await page.getByTestId("grand-prix").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex?.race));
  const track = await page.evaluate(() => (window as unknown as { apex: { race: { track: { def: { id: string; cup: string } } } } }).apex.race.track.def);
  expect(track.cup).toBe("turbo");
  expect(track.id).toBe("grand-circuit");
});

test("Weather choice is used for the race and remembered", async ({ page }) => {
  await page.goto("./?laps=1&bots=1");
  await page.getByTestId("weather-fog").click();
  await expect(page.getByTestId("weather-fog")).toHaveClass(/on/);
  await page.goto("./?laps=1&bots=1");
  await expect(page.getByTestId("weather-fog")).toHaveClass(/on/);
  await page.locator("#race").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex?.race));
  expect(await page.evaluate(() => (window as unknown as { apex: { race: { weather: string } } }).apex.race.weather)).toBe("fog");
});

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
  await expect(page.getByTestId("results").locator("tbody tr")).toHaveCount(5);
  // replay with photo export, then the highlight clip
  await page.getByTestId("open-replay").click();
  await expect(page.getByTestId("replay")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByTestId("screenshot").click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("results")).toBeVisible();
  await page.getByTestId("open-highlights").click();
  await expect(page.getByTestId("highlights")).toBeVisible();
  await page.keyboard.press("Escape"); // skip
  await expect(page.getByTestId("results")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Time trial saves a ghost; drift challenge shows its score", async ({ page }) => {
  test.setTimeout(400_000);
  const errors = collectErrors(page);
  await page.goto("./?laps=1&autopilot&track=grand-circuit");
  await page.getByTestId("timetrial").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex?.race));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("solo-result")).toContainText("Ghost", { timeout: 360_000 });
  await expect(page.getByTestId("results").locator("tbody tr")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("apexrush.ghost.grand-circuit")?.length ?? 0)).toBeGreaterThan(100);
  await page.locator("[data-action=menu]").click();
  await page.getByTestId("drift").click();
  await page.waitForFunction(() => (window as ApexWindow).apex?.race?.phase !== "results");
  await expect(page.getByTestId("drift-score")).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("Online: Host und Client fahren gemeinsam (lokaler Vermittler)", async ({ browser }) => {
  test.setTimeout(420_000);
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
  // Skip the intro camera flight (slow on CI runners with software rendering).
  await host.waitForFunction(() => Boolean((window as ApexWindow).apex?.race), undefined, { timeout: 120_000 });
  await host.keyboard.press("Enter");

  await host.waitForFunction(() => (window as ApexWindow).apex?.race?.phase === "racing", undefined, { timeout: 150_000 });
  await client.waitForFunction(() => (window as ApexWindow).apex?.race?.phase === "racing", undefined, { timeout: 150_000 });
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
  expect(h0.count).toBe(10);
  expect(c0.count).toBe(10);
  // Slow CI runners (software rendering) need longer, so poll instead of a fixed wait.
  const moved = async (page: Page, start: { x: number; z: number }) => {
    const v = await view(page);
    return Math.hypot(v.x - start.x, v.z - start.z);
  };
  await expect.poll(() => moved(host, h0), { timeout: 90_000, intervals: [1000] }).toBeGreaterThan(3);
  await expect.poll(() => moved(client, c0), { timeout: 90_000, intervals: [1000] }).toBeGreaterThan(3);
  expect([...hostErrors, ...clientErrors]).toEqual([]);
  await ctx.close();
});

test("Online track vote: both players vote, the race starts on the chosen track", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  const client = await ctx.newPage();
  const hostErrors = collectErrors(host);
  const clientErrors = collectErrors(client);
  await host.goto("./?net=local&autopilot&laps=1");
  await host.getByTestId("online").click();
  await host.getByTestId("host").click();
  const code = (await host.getByTestId("room-code").textContent())!.trim();
  await client.goto(`./?room=${code}&net=local&autopilot&laps=1`);
  await client.getByTestId("ready").click();
  await expect(host.getByTestId("players").locator("li")).toHaveCount(2);
  await host.getByTestId("lobby-vote").check();
  await host.getByTestId("lobby-chaos").check();
  await expect(host.getByTestId("start-race")).toBeEnabled();
  await host.getByTestId("start-race").click();

  // both see the same three candidates
  const cards = (page: Page) => page.locator(".vote-card");
  await expect(cards(host)).toHaveCount(3);
  await expect(cards(client)).toHaveCount(3);
  const ids = await cards(host).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.track!));
  expect(await cards(client).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.track!))).toEqual(ids);
  const choice = ids[1]!;
  await client.getByTestId(`vote-${choice}`).click();
  await host.getByTestId(`vote-${choice}`).click();
  await expect(host.locator(".vote-card.winner")).toHaveAttribute("data-track", choice);

  const trackOf = (page: Page) =>
    page.waitForFunction(() => (window as unknown as { apex?: { race?: { track: { def: { id: string } } } } }).apex?.race?.track.def.id, undefined, { timeout: 120_000 }).then((h) => h.jsonValue());
  expect(await trackOf(host)).toBe(choice);
  expect(await trackOf(client)).toBe(choice);
  // chaos mode reached the client: item slot in the HUD and chaos state in the snapshots
  await expect(client.getByTestId("item-slot")).toBeVisible();
  await client.waitForFunction(() => Boolean((window as unknown as { apex: { race: { chaos: { net: unknown } } } }).apex.race.chaos?.net), undefined, { timeout: 120_000 });
  expect([...hostErrors, ...clientErrors]).toEqual([]);
  await ctx.close();
});
