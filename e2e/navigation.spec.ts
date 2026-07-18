import { expect, test } from "@playwright/test";

test("the prepared demo journey is navigable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /analyse a sample class/i }).click();
  await expect(page).toHaveURL(/\/analyses\/demo$/);
  await expect(page.getByRole("heading", { name: "Trace Map" })).toBeVisible();
  await page.getByRole("link", { name: /linear scaling/i }).first().click();
  await expect(page.getByRole("heading", { name: /area scales linearly/i })).toBeVisible();
});

test("circle explorer responds to radius input", async ({ page }) => {
  await page.goto("/learn/demo");
  await page.getByRole("button", { name: "It quadruples" }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: "6 cm" }).click();
  await expect(page.getByText("4.00×")).toBeVisible();
});
