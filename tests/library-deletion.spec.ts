import { expect, test } from "@playwright/test";
import { buildDemoRun } from "../src/engine";

const brief = "Should our test team run a bounded pilot?";
const original = {
  id: "fake-original",
  createdAt: "2026-09-13T12:00:00.000Z",
  brief,
  result: { ...buildDemoRun(brief), title: "Original test decision" },
  discussion: [{ role: "user", content: "A test objection." }],
};
const revision = {
  ...original,
  id: "fake-revision",
  parentId: original.id,
  result: { ...original.result, title: "Revised test decision" },
};

test("deletion can be undone, preserves revisions, and clears the active memo on reload", async ({ page }) => {
  await page.route("**/api/catalog", (route) => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.route("**/api/availability", (route) => route.fulfill({ json: { sharedOpenRouter: true } }));
  await page.route("**/api/models?**", (route) => route.fulfill({ json: { models: [], source: "fallback" } }));
  await page.addInitScript(({ original, revision }) => {
    if (localStorage.getItem("conclave:library")) return;
    localStorage.setItem("conclave:library", JSON.stringify([revision, original]));
    localStorage.setItem("conclave:lastRun", JSON.stringify({ brief: original.brief, result: original.result, recordId: original.id }));
  }, { original, revision });
  await page.goto("/");
  await page.getByRole("button", { name: /^Library/ }).click();
  const remove = page.getByRole("button", { name: "Delete Original test decision", exact: true });
  await remove.click();
  await expect(remove).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(remove).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("conclave:library")!).length)).toBe(2);
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Revised test decision", exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("conclave:library")!));
  expect(saved).toHaveLength(1);
  expect(saved[0].parentId).toBeUndefined();
  expect(saved[0].discussion).toEqual(revision.discussion);
  expect(await page.evaluate(() => localStorage.getItem("conclave:lastRun"))).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Decision brief")).toHaveValue("");
  await expect(page.getByText("Chair’s call", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Library/ }).click();
  await page.getByLabel("Search decisions").fill("Revised");
  await page.getByRole("button", { name: "Delete Revised test decision", exact: true }).click();
  await expect(page.getByText("No saved decisions yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a decision" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("conclave:library")!))).toEqual([]);
});

test("multiple deletion toasts stack and keep each Undo action accessible", async ({ page, isMobile }) => {
  const records = [original, revision, { ...original, id: "fake-third", result: { ...original.result, title: "Third test decision" } }];
  await page.route("**/api/catalog", (route) => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.route("**/api/availability", (route) => route.fulfill({ json: { sharedOpenRouter: true } }));
  await page.route("**/api/models?**", (route) => route.fulfill({ json: { models: [], source: "fallback" } }));
  await page.addInitScript((records) => localStorage.setItem("conclave:library", JSON.stringify(records)), records);
  await page.goto("/");
  await page.getByRole("button", { name: /^Library/ }).click();
  for (const record of records)
    await page.getByRole("button", { name: `Delete ${record.result.title}`, exact: true }).click();
  const toasts = page.locator(".connection-toast");
  await expect(toasts).toHaveCount(3);
  const viewport = page.locator(".toast-viewport");
  if (isMobile) await toasts.first().tap();
  else await viewport.hover();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(3);
  const oldest = toasts.filter({ has: page.locator(".toast-description", { hasText: "Original test decision" }) });
  await oldest.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete Original test decision", exact: true })).toBeVisible();
  await expect(toasts).toHaveCount(2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("conclave:library")!));
  expect(stored.map((record: { id: string }) => record.id)).toEqual([original.id]);
  expect(stored[0].discussion).toEqual(original.discussion);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await toasts.first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});
