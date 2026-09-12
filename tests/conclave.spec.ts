import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ status: 503, json: { error: "Test catalog unavailable" } }),
  );
});

async function useOfflineCouncil(page: Page) {
  await page.getByLabel("Model").click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("option", { name: /Offline council/ }).click();
  await expect(page.getByLabel("Model")).toContainText("Offline council");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("example brief becomes a complete decision memo", async ({ page }) => {
  await useOfflineCouncil(page);
  await page.getByRole("button", { name: /use an example/i }).click();
  await expect(page.getByLabel("Decision brief")).toHaveValue(
    /12-person design studio/,
  );
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByText("Chair’s call")).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId("agent-optimist")).toBeVisible();
  await expect(page.getByTestId("agent-analyst")).toBeVisible();
  await expect(page.getByTestId("agent-skeptic")).toBeVisible();
  await expect(page.getByText("Next steps")).toBeVisible();
});
test("invalid brief is rejected accessibly", async ({ page }) => {
  await page.getByLabel("Decision brief").fill("Too short");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText("at least 20 characters");
  await expect(page.getByLabel("Decision brief")).toBeFocused();
});

test("BYOK providers ask for a key instead of running", async ({ page }) => {
  await page.getByLabel("Model").click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("option", { name: "Claude Fable 5.1", exact: true })
    .click();
  await expect(page.locator("#byok-key")).toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should we launch this product to five customers next month?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your Anthropic API key",
  );
  await expect(page.locator("#byok-key")).toBeFocused();
});

test("recent paid NVIDIA models require an OpenRouter key", async ({
  page,
}) => {
  await page.getByLabel("Model").click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search models").fill("Nemotron 3.5 Lightning");
  await page
    .getByRole("option", {
      name: "Nemotron 3.5 Lightning 30B A3B",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "API key", exact: true }).click();
  await expect(page.locator("#byok-key")).toBeVisible();
  await expect(
    page.getByText(/shared key covers free NVIDIA models only/),
  ).toBeVisible();
});

test("the API serves the NVIDIA catalog filtered from OpenRouter", async ({
  request,
}) => {
  const response = await request.get("/api/models?provider=nvidia");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.models.length).toBeGreaterThan(0);
  expect(
    body.models.every((model: { id: string }) =>
      model.id.startsWith("nvidia/"),
    ),
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

test("a completed memo survives reload and can be cleared", async ({
  page,
}) => {
  await useOfflineCouncil(page);
  await page
    .getByLabel("Decision brief")
    .fill(
      "Should our studio pilot a paid research product with five customers?",
    );
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByText("Chair’s call")).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.getByText("Chair’s call")).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(
    page.getByRole("heading", { name: "What are you deciding?" }),
  ).toBeVisible();
});

test("keyboard submission runs without horizontal overflow", async ({
  page,
}) => {
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
    "claude-fable-5-1",
  );
});

test("settings manage connections and never persist keys", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Model & connection" }),
  ).toBeVisible();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search models").fill("Claude Opus 5");
  await page
    .getByRole("option", { name: "Claude Opus 5", exact: true })
    .click();

  const storage = await page.evaluate(() =>
    localStorage.getItem("conclave:connection"),
  );
  expect(storage).toContain("claude-opus-5");
  expect(storage).not.toContain("apiKey");
  await expect(
    page.getByText(/Add your Anthropic API key before convening/),
  ).toBeVisible();

  await page.getByLabel("Model", { exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search models").fill("Nemotron 3.5 Lightning 30B A3B");
  await page
    .getByRole("option", {
      name: "Nemotron 3.5 Lightning 30B A3B",
      exact: true,
    })
    .first()
    .click();
  const restored = await page.evaluate(() =>
    localStorage.getItem("conclave:connection"),
  );
  expect(restored).toContain("nvidia/nemotron-3.5-lightning");
});

test("the guide explains the council, BYOK, and privacy", async ({ page }) => {
  await page.getByRole("button", { name: "Guide" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Guide", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Mara makes the case/)).toBeVisible();
  await expect(page.getByText(/Ivo checks the facts/)).toBeVisible();
  await expect(page.getByText(/Sana looks for failure/)).toBeVisible();
  await expect(
    page.getByText(/Every other hosted model needs your own API key/),
  ).toBeVisible();
  await expect(
    page.getByText(/Keys are never saved or exported/),
  ).toBeVisible();
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

test("completed decisions appear in the local library and export Markdown", async ({
  page,
}) => {
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
