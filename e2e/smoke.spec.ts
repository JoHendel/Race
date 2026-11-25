import { expect, test } from "@playwright/test";

test("Titelbildschirm lädt ohne Konsolenfehler", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("./");
  await expect(page.locator("h1.logo")).toContainText("APEX");
  await expect(page.locator("#scene")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
