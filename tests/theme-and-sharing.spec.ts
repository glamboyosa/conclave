import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: {} }));
});

test("automatic theme follows local time without saving a preference", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 14, 18, 59, 30) });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.clock.fastForward(60_000);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Use light theme" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("conclave:theme"))).toBeNull();
  await page.clock.setSystemTime(new Date(2026, 8, 15, 7, 0));
  await page.clock.fastForward(60_000);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("explicit theme choice survives reload and time changes", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 14, 22, 0) });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Use light theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.clock.fastForward(60_000);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#ffffff");
});

test("share metadata and creator link are available", async ({ page, request }) => {
  const response = await request.get("/");
  expect(await response.text()).toContain('property="og:image" content="https://conclave.click/social-card.png"');
  await page.goto("/");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const image = await request.get("/social-card.png");
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/png");
  const credit = page.getByRole("link", { name: "Osa Ogbemudia" });
  await credit.scrollIntoViewIfNeeded();
  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute("href", "https://glamboyosa.xyz");
});

test("the empty decision room fits without trailing scroll space", async ({ page }) => {
  await page.goto("/");
  const pageHeight = await page.evaluate(() => ({
    viewport: window.innerHeight,
    document: document.documentElement.scrollHeight,
  }));

  expect(pageHeight.document).toBeLessThanOrEqual(pageHeight.viewport);
  await expect(page.getByRole("link", { name: "Osa Ogbemudia" })).toBeVisible();
});
