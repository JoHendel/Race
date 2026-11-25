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
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const car = (window as ApexWindow).apex!.drive!.car;
    return { speed: car.speed, z: car.mesh.position.z };
  });
  expect(state.speed).toBeGreaterThan(5);
  expect(state.z).toBeGreaterThan(-55);
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
