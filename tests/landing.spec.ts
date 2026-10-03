import { expect, test } from "@playwright/test";

test("first visit introduces Conclave, then returns to the decision room", async ({ page }) => {
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/conclave-product-demo.mp4")) videoRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/landing$/);
  await expect(page.getByRole("heading", { name: /recommendation you can argue with/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /change models without losing the thread/i })).toBeVisible();
  await expect(page.getByLabel("Conclave product walkthrough")).toHaveAttribute("preload", "none");
  expect(videoRequests).toEqual([]);
  await page.getByLabel("Conclave product walkthrough").evaluate(async (video: HTMLVideoElement) => {
    video.load();
    await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
  });
  await expect.poll(() => page.getByLabel("Conclave product walkthrough").evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(2);
  await page.getByRole("button", { name: /Playback speed 2×/ }).click();
  await expect.poll(() => page.getByLabel("Conclave product walkthrough").evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(1);

  await page.getByRole("button", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Continue with another model" })).toBeVisible();

  await page.getByRole("button", { name: "About Conclave" }).last().click();
  await expect(page).toHaveURL(/\/landing$/);
  await page.getByRole("button", { name: "Try Conclave" }).click();
  await expect(page.getByRole("heading", { name: "What are you deciding?" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "What are you deciding?" })).toBeVisible();
  await page.goto("/landing");
  await expect(page.getByRole("button", { name: "Try Conclave" })).toBeVisible();
});

test("landing page stays within a narrow viewport", async ({ page }) => {
  await page.goto("/landing");
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBe(widths.viewport);
  await expect(page.getByRole("button", { name: "Open app" })).toBeVisible();
});

test("existing decision libraries open the app without onboarding", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("conclave:library", "[]"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "What are you deciding?" })).toBeVisible();
});

test("landing theme choice carries into the decision room and survives reload", async ({ page }) => {
  await page.goto("/landing");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: initialTheme === "dark" ? "Use light theme" : "Use dark theme" }).click();
  const chosenTheme = initialTheme === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", chosenTheme);
  await page.getByRole("button", { name: "Try Conclave" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", chosenTheme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", chosenTheme);
});
