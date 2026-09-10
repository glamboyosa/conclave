import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test('example brief becomes a complete decision memo', async ({ page }) => { await page.getByRole('button',{name:/use an example/i}).click(); await expect(page.getByLabel('Decision brief')).toHaveValue(/12-person design studio/); await page.getByRole('button',{name:/convene council/i}).click(); await expect(page.getByText('Council in session')).toBeVisible(); await expect(page.getByText('Chair’s call')).toBeVisible({timeout:5000}); await expect(page.getByTestId('agent-optimist')).toBeVisible(); await expect(page.getByTestId('agent-analyst')).toBeVisible(); await expect(page.getByTestId('agent-skeptic')).toBeVisible(); await expect(page.getByText('Next moves')).toBeVisible(); });
test('invalid brief is rejected accessibly', async ({ page }) => { await page.getByLabel('Decision brief').fill('Too short'); await page.getByRole('button',{name:/convene council/i}).click(); await expect(page.getByRole('alert')).toContainText('at least 20 characters'); await expect(page.getByLabel('Decision brief')).toBeFocused(); });
test("a completed memo survives reload and can be cleared", async ({ page }) => {
  await page
    .getByLabel("Decision brief")
    .fill("Should our studio pilot a paid research product with five customers?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByText("Chair’s call")).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.getByText("Chair’s call")).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(
    page.getByRole("heading", { name: /bring the decision/i }),
  ).toBeVisible();
});

test("keyboard submission runs without horizontal overflow", async ({ page }) => {
  await page
    .getByLabel("Decision brief")
    .fill("Should we test this decision workflow with our leadership team?");
  await page.getByLabel("Decision brief").press("Control+Enter");
  await expect(page.getByText("Chair’s call")).toBeVisible({ timeout: 5000 });

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});

test("the API rejects an underspecified brief", async ({ request }) => {
  const response = await request.post("/api/run", { data: { brief: "tiny" } });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Brief must be 20–4,000 characters.",
  });
});

test("settings configure NVIDIA without persisting the key", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Provider").selectOption("nvidia");
  await expect(page.getByLabel("Model ID")).toHaveValue("nvidia/nemotron-3-ultra-550b-a55b");
  await page.getByLabel("API key").fill("nvapi-test-secret");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByText(/NVIDIA NIM/)).toBeVisible();

  const storage = await page.evaluate(() => localStorage.getItem("conclave:connection"));
  expect(storage).not.toContain("nvapi-test-secret");
});
