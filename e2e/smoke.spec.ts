import { expect, test } from "@playwright/test";

interface ApexWindow {
  apex?: {
    drive: {
      input: { override: Record<string, unknown> | null };
      car: { speed: number; mesh: { position: { z: number } } };
    };
  };
}

test("Titelbildschirm lädt und die Testfahrt fährt los", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("./");
  await expect(page.locator("h1.logo")).toContainText("APEX");
  await page.locator("#start").click();
  await page.waitForFunction(() => Boolean((window as ApexWindow).apex));
  await expect(page.getByTestId("speed")).toBeVisible();

  // Vollgas geben und prüfen, dass das Auto schneller wird und vorwärts fährt.
  await page.evaluate(() => {
    (window as ApexWindow).apex!.drive.input.override = { throttle: 1 };
  });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const car = (window as ApexWindow).apex!.drive.car;
    return { speed: car.speed, z: car.mesh.position.z };
  });
  expect(state.speed).toBeGreaterThan(5);
  expect(state.z).toBeGreaterThan(-55);
  expect(errors).toEqual([]);
});
