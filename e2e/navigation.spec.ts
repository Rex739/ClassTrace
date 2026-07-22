import { expect, test } from "@playwright/test";
import { createPreparedAnalysisRun } from "../lib/ai/prepared";
import { createAssessmentFingerprint } from "../lib/client-store";

const storedLiveRun = (() => {
  const prepared = createPreparedAnalysisRun();
  return {
    ...prepared,
    metadata: { ...prepared.metadata, runId: "saved-live-e2e", mode: "live" as const, model: "gpt-5.6" as const },
  };
})();

function savedSnapshot(fingerprint: string | null = null) {
  const clusterId = storedLiveRun.classAnalysis.clusters[0]!.id;
  return {
    version: 1,
    fingerprint,
    run: storedLiveRun,
    teacherEdits: {
      approvedResponseIds: [storedLiveRun.individualAnalyses[0]!.responseId],
      reviewResponseIds: [],
      clusterRenames: [{ clusterId, title: "Teacher-confirmed scaling pattern" }],
      responseMoves: [],
      clusterMerges: [],
      updatedAt: new Date().toISOString(),
    },
    approvedIntervention: {
      type: "teacher_review",
      title: "Check the explanation",
      targetMisconception: "Scaling",
      reason: "Confirm the learner's explanation.",
      suggestedTeacherQuestion: "What is squared in the area formula?",
    },
    transferEvaluation: {
      status: "partially_resolved",
      demonstratedConcepts: ["Uses a squared scale factor"],
      remainingDifficulty: "Needs to connect both radius factors.",
      evidenceExcerpt: null,
      feedbackForStudent: "Explain why the scale factor is squared.",
      recommendationForTeacher: "Ask for a symbolic explanation.",
      confidence: .82,
      requiresTeacherReview: false,
    },
    savedAt: new Date().toISOString(),
  };
}

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

test("learner activity logos link back to the home page", async ({ page }) => {
  for (const route of ["/learn/demo", "/learn/live"]) {
    await page.goto(route);
    const logo = page.getByRole("link", { name: "ClassTrace home" });
    await expect(logo).toHaveAttribute("href", "/");
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
  }
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

test("assessment drafts and completed live work survive navigation and refresh without API calls", async ({ page }) => {
  await page.goto("/assessments/new");
  await page.getByRole("textbox", { name: "Question", exact: true }).fill("A circle has a radius of 3 cm. What happens to its area when the radius is doubled?");
  await page.getByLabel("Reasoning guide or rubric").fill("Use area equals pi times radius squared and explain why the scale factor is squared.");
  await page.getByLabel("Typed responses").fill("It becomes four times as large because two squared is four.");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Question", exact: true })).toHaveValue(/radius of 3 cm/);
  await expect(page.getByLabel("Reasoning guide or rubric")).toHaveValue(/scale factor is squared/);
  await expect(page.getByLabel("Typed responses")).toHaveValue(/four times as large/);

  await page.evaluate((snapshot) => localStorage.setItem("classtrace:v1:latest-analysis", JSON.stringify(snapshot)), savedSnapshot());
  let analysisRequests = 0;
  page.on("request", (request) => { if (request.url().includes("/api/analyses")) analysisRequests += 1; });
  await page.goto("/analyses/live");
  await expect(page.getByRole("heading", { name: "Class reasoning analysis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Teacher-confirmed scaling pattern" })).toBeVisible();
  await expect(page.getByText("Live analysis · GPT-5.6").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Teacher-confirmed scaling pattern" })).toBeVisible();
  await page.goto("/assessments/new");
  await page.getByRole("button", { name: "Resume latest analysis" }).click();
  await expect(page).toHaveURL(/\/analyses\/live$/);
  expect(analysisRequests).toBe(0);
});

test("duplicate-cost confirmation blocks automatic requests and deliberate rerun starts only one", async ({ page }) => {
  const question = "A circle has a radius of 3 cm. What happens to its area when the radius is doubled?";
  const expectedReasoning = "Use area equals pi times radius squared and explain why the scale factor is squared.";
  const typedResponse = "It becomes four times as large because two squared is four.";
  const fingerprint = await createAssessmentFingerprint({ question, expectedReasoning, typedResponses: [typedResponse], imageDescriptors: [] });
  await page.goto("/assessments/new");
  await page.evaluate((snapshot) => localStorage.setItem("classtrace:v1:latest-analysis", JSON.stringify(snapshot)), savedSnapshot(fingerprint));
  await page.reload();
  await page.getByRole("textbox", { name: "Question", exact: true }).fill(question);
  await page.getByLabel("Reasoning guide or rubric").fill(expectedReasoning);
  await page.getByLabel("Typed responses").fill(typedResponse);

  let analysisRequests = 0;
  await page.route("**/api/analyses", async (route) => {
    analysisRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ type: "result", data: storedLiveRun })}\n` });
  });

  await page.getByRole("button", { name: "Analyse with GPT-5.6" }).click();
  await expect(page.getByText("This assessment has already been analysed.")).toBeVisible();
  expect(analysisRequests).toBe(0);
  await page.getByRole("button", { name: "Run a new analysis anyway" }).dblclick();
  await expect(page).toHaveURL(/\/analyses\/live$/);
  expect(analysisRequests).toBe(1);
});

test("deleting a saved analysis requires explicit confirmation", async ({ page }) => {
  await page.goto("/assessments/new");
  await page.evaluate((snapshot) => localStorage.setItem("classtrace:v1:latest-analysis", JSON.stringify(snapshot)), savedSnapshot());
  await page.reload();
  await page.getByRole("button", { name: "Delete saved analysis" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete saved analysis" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("classtrace:v1:latest-analysis"))).not.toBeNull();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await page.evaluate(() => localStorage.getItem("classtrace:v1:latest-analysis"))).not.toBeNull();
  await page.getByRole("button", { name: "Delete saved analysis" }).click();
  await page.getByRole("alertdialog", { name: "Delete saved analysis" }).getByRole("button", { name: "Delete saved analysis" }).click();
  expect(await page.evaluate(() => localStorage.getItem("classtrace:v1:latest-analysis"))).toBeNull();
});

test("demo and live navigation states remain exclusive after direct navigation and refresh", async ({ page }) => {
  const navs = ["Primary navigation", "Mobile navigation"];
  await page.goto("/analyses/demo");
  for (const navName of navs) {
    const nav = page.getByRole("navigation", { name: navName, includeHidden: true });
    await expect(nav.getByRole("link", { name: "Demo analysis", includeHidden: true })).toHaveAttribute("aria-current", "page");
  }

  await page.goto("/");
  await page.evaluate((snapshot) => localStorage.setItem("classtrace:v1:latest-analysis", JSON.stringify(snapshot)), savedSnapshot());
  await page.goto("/analyses/live/outcomes");
  await page.reload();
  for (const navName of navs) {
    const nav = page.getByRole("navigation", { name: navName, includeHidden: true });
    await expect(nav.getByRole("link", { name: "Resume analysis", includeHidden: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Demo analysis", includeHidden: true })).not.toHaveAttribute("aria-current", "page");
  }
});

test("assessment setup contains long saved-analysis content at common widths", async ({ page }) => {
  const snapshot = savedSnapshot();
  snapshot.run.assessment.question = `A deliberately long saved assessment question ${"with-an-unbroken-reasoning-title-".repeat(18)} asks learners to explain the relationship.`;
  await page.goto("/assessments/new");
  await page.evaluate((stored) => localStorage.setItem("classtrace:v1:latest-analysis", JSON.stringify(stored)), snapshot);

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Resume latest analysis" })).toBeVisible();
    const layout = await page.locator(".form-layout").evaluate((element) => {
      const main = element.querySelector<HTMLElement>(".form-main")!;
      const sidebar = element.querySelector<HTMLElement>(".form-sidebar")!;
      const containers = [...element.querySelectorAll<HTMLElement>(".form-main, .form-sidebar, .resume-analysis-card, .resume-actions, .form-actions")];
      const overflow = containers.flatMap((container) => {
        const bounds = container.getBoundingClientRect();
        return [...container.querySelectorAll<HTMLElement>(":scope > *, p, small, h2, button")]
          .map((item) => {
            const rect = item.getBoundingClientRect();
            return { tag: item.tagName, text: item.textContent?.trim().slice(0, 50), left: rect.left, right: rect.right };
          })
          .filter((item) => item.left < bounds.left - 1 || item.right > bounds.right + 1);
      });
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        mainTop: Math.round(main.getBoundingClientRect().top),
        mainBottom: Math.round(main.getBoundingClientRect().bottom),
        sidebarTop: Math.round(sidebar.getBoundingClientRect().top),
        overflow,
      };
    });
    expect(layout.documentWidth, `${width}px document overflow`).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.overflow, `${width}px escaped items`).toEqual([]);
    if (width < 1100) expect(layout.sidebarTop).toBeGreaterThanOrEqual(layout.mainBottom - 1);
    else expect(Math.abs(layout.sidebarTop - layout.mainTop)).toBeLessThanOrEqual(1);
  }
});
