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
  await expect(page.getByRole("button", { name: "It quadruples" })).toHaveClass(/selected/);
  await page.getByRole("button", { name: /continue/i }).click();
  const radius = page.getByRole("slider", { name: /Radius/ });
  await radius.focus();
  await radius.press("ArrowRight");
  await expect(radius).toHaveValue("3.5");
  await page.getByRole("button", { name: "6 cm" }).click();
  await expect(page.getByText("4.00×")).toBeVisible();
});

test("assessment setup distinguishes live and prepared modes", async ({ page }) => {
  await page.goto("/assessments/new");
  await expect(page.getByRole("button", { name: "Analyse with GPT-5.6" })).toBeVisible();
  const preparedButton = page.locator(".live-actions").getByRole("button", { name: "Open prepared demonstration" });
  await expect(preparedButton).toBeVisible();
  await preparedButton.click();
  await expect(page).toHaveURL(/\/analyses\/demo$/);
  await expect(page.getByText("Prepared demonstration · deterministic data").first()).toBeVisible();
});

test("assessment image input accepts supported work and rejects unsafe files", async ({ page }) => {
  await page.goto("/assessments/new");
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({ name: "synthetic-work.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(page.getByText("0 typed · 1 images · 12 maximum")).toBeVisible();
  await expect(page.getByText("synthetic-work.png", { exact: true })).toBeVisible();

  await upload.setInputFiles({ name: "student.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await expect(page.getByText("Student-work images must be PNG, JPEG, or WebP.")).toBeVisible();

  await upload.setInputFiles({ name: "oversized.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByText("Each image must be 5 MB or smaller.")).toBeVisible();
  await expect(page.getByText(/use synthetic or de-identified student work/i)).toBeVisible();
});

test("core routes remain usable at the configured viewport", async ({ page }) => {
  const routes = ["/", "/assessments/new", "/analyses/demo", "/analyses/demo/clusters/linear-scaling", "/interventions/demo", "/learn/demo", "/analyses/demo/outcomes"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    const viewport = page.viewportSize();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const overflow = await page.evaluate(() => [...document.querySelectorAll<Element>("html, body, body *")]
      .map((element) => ({ tag: element.tagName, className: element.getAttribute("class") ?? "", right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }))
      .filter((element) => element.right > window.innerWidth + 1 || element.width > window.innerWidth + 1)
      .slice(0, 8));
    expect(documentWidth, `${route}: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(viewport?.width ?? documentWidth);
  }
});

test("analysis provenance stays readable without overflowing its card", async ({ page }) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/analyses/demo");
    const card = page.locator(".provenance-card");
    await expect(card).toBeVisible();
    await expect(card.getByText("Mode", { exact: true })).toBeVisible();
    await expect(card.getByText("Created", { exact: true })).toBeVisible();
    await expect(card.getByText("Teacher review", { exact: true })).toBeVisible();

    const overflow = await card.evaluate((element) => {
      const cardRect = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>(".provenance-card-header, dl > div, dt, dd, button")]
        .map((item) => {
          const rect = item.getBoundingClientRect();
          const style = getComputedStyle(item);
          const clipsOverflow = style.overflowX === "hidden" || style.overflowX === "clip";
          return { tag: item.tagName, text: item.textContent?.trim().slice(0, 40), left: rect.left, right: rect.right, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth, clipsOverflow };
        })
        .filter((item) => item.left < cardRect.left - 1 || item.right > cardRect.right + 1 || (!item.clipsOverflow && item.scrollWidth > item.clientWidth + 1));
    });
    expect(overflow, `${width}px: ${JSON.stringify(overflow)}`).toEqual([]);
  }

  const runId = page.locator(".provenance-run-id");
  await expect(runId).toHaveAttribute("title", /.+/);
});
