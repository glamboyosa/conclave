import { expect, test, type Page } from '@playwright/test';

async function useOfflineCouncil(page: Page) {
  await page.getByLabel("Model").click();
  await page.getByRole("option", { name: /Offline council/ }).click();
  await expect(page.getByLabel("Model")).toContainText("Offline council");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test('example brief becomes a complete decision memo', async ({ page }) => { await useOfflineCouncil(page); await page.getByRole('button',{name:/use an example/i}).click(); await expect(page.getByLabel('Decision brief')).toHaveValue(/12-person design studio/); await page.getByRole('button',{name:/convene council/i}).click(); await expect(page.getByText('Council in session')).toBeVisible(); await expect(page.getByText('Chair’s call')).toBeVisible({timeout:5000}); await expect(page.getByTestId('agent-optimist')).toBeVisible(); await expect(page.getByTestId('agent-analyst')).toBeVisible(); await expect(page.getByTestId('agent-skeptic')).toBeVisible(); await expect(page.getByText('Next moves')).toBeVisible(); });
test('invalid brief is rejected accessibly', async ({ page }) => { await page.getByLabel('Decision brief').fill('Too short'); await page.getByRole('button',{name:/convene council/i}).click(); await expect(page.getByRole('alert')).toContainText('at least 20 characters'); await expect(page.getByLabel('Decision brief')).toBeFocused(); });

test("BYOK providers ask for a key instead of running", async ({ page }) => {
  await page.getByLabel("Model").click();
  await page
    .getByRole("option", { name: "Claude Sonnet 4.5", exact: true })
    .click();
  await expect(page.getByLabel(/API key/)).toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should we launch this product to five customers next month?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your Anthropic API key",
  );
  await expect(page.getByLabel(/API key/)).toBeFocused();
});

test("NVIDIA models run through OpenRouter without a separate key", async ({ page }) => {
  await page.getByLabel("Model").click();
  await page
    .getByRole("option", { name: /Nemotron 3 Super 120B/ })
    .click();
  await expect(page.getByLabel(/OpenRouter API key/)).toBeVisible();
  await expect(page.getByText(/shared OpenRouter key/)).toBeVisible();
});

test("the API serves the NVIDIA catalog filtered from OpenRouter", async ({ request }) => {
  const response = await request.get("/api/models?provider=nvidia");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.models.length).toBeGreaterThan(0);
  expect(
    body.models.every((model: { id: string }) => model.id.startsWith("nvidia/")),
  ).toBe(true);
});

test("the shared key refuses paid NVIDIA models", async ({ request }) => {
  const response = await request.post("/api/run", {
    data: {
      brief: "Should we launch this product to five customers next month?",
      connection: {
        provider: "nvidia",
        model: "nvidia/nemotron-3-ultra-550b-a55b",
        baseURL: "",
        apiKey: "",
      },
    },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/OpenRouter/);
});

test("a completed memo survives reload and can be cleared", async ({ page }) => {
  await useOfflineCouncil(page);
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
  await useOfflineCouncil(page);
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

test("the API serves popular models without a key", async ({ request }) => {
  const response = await request.get("/api/models?provider=anthropic");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.models.length).toBeGreaterThan(0);
  expect(body.models.map((model: { id: string }) => model.id)).toContain(
    "claude-sonnet-4-5",
  );
});

test("settings switch models with a dropdown and never persist keys", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: /Pick a model/ }),
  ).toBeVisible();
  await page.getByLabel("Popular model").click();
  await page.getByRole("option", { name: "Claude Opus 4.5" }).click();

  const storage = await page.evaluate(() =>
    localStorage.getItem("conclave:connection"),
  );
  expect(storage).toContain("claude-opus-4-5");
  expect(storage).not.toContain("apiKey");
  await expect(page.getByText(/needs your API key/)).toBeVisible();

  await page.getByLabel("Popular model").click();
  await page
    .getByRole("option", { name: /NVIDIA Nemotron 3 Super/ })
    .first()
    .click();
  const restored = await page.evaluate(() =>
    localStorage.getItem("conclave:connection"),
  );
  expect(restored).toContain("nvidia/nemotron-3-super-120b-a12b:free");
});

test("the guide explains the council, BYOK, and privacy", async ({ page }) => {
  await page.getByRole("button", { name: "Guide" }).first().click();
  await expect(
    page.getByRole("heading", { name: /How Conclave thinks/ }),
  ).toBeVisible();
  await expect(page.getByText("Mara")).toBeVisible();
  await expect(page.getByText("Ivo")).toBeVisible();
  await expect(page.getByText("Sana")).toBeVisible();
  await expect(page.getByText(/Kimi \(Moonshot\)/)).toBeVisible();
  await expect(page.getByText(/never written to storage/)).toBeVisible();
});

test("local providers reject non-loopback endpoints", async ({ request }) => {
  const response = await request.post("/api/run", {
    data: {
      brief: "Should we launch this product to five customers next month?",
      connection: {
        provider: "ollama",
        model: "local-model",
        baseURL: "https://example.com/v1",
        apiKey: "",
      },
    },
  });

  expect(response.status()).toBe(500);
  await expect(response.json()).resolves.toEqual({
    error: "The model request failed. Check the endpoint, model, and key.",
  });
});

test("completed decisions appear in the local library and export Markdown", async ({ page }) => {
  await useOfflineCouncil(page);
  await page.getByRole("button", { name: /use an example/i }).click();
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByText("Chair’s call")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /^Library/ }).click();
  await expect(page.getByText(/Saved in this browser/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export .* as Markdown/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^conclave-.*\.md$/);
});
