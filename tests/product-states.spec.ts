import { expect, test } from "@playwright/test";
import { buildDemoRun } from "../src/engine";
import { popularModels } from "../src/providers";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ status: 503, json: { error: "Test catalog unavailable" } }),
  );
});

test("catalog loading, failure, key verification, and unavailable selection", async ({
  page,
}) => {
  await page.route("**/api/models?**", async (route) => {
    const provider = new URL(route.request().url()).searchParams.get(
      "provider",
    );
    await new Promise((resolve) => setTimeout(resolve, 650));
    const hasKey = Boolean(route.request().headers()["x-conclave-key"]);
    await route.fulfill({
      json: {
        source: hasKey ? "live" : "fallback",
        models: hasKey
          ? [
              {
                id: "test-model",
                name: "Test model with a deliberately long descriptive name for wrapping",
                free: false,
              },
            ]
          : popularModels(
              provider === "anthropic" ? "anthropic" : "openrouter",
            ),
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("Loading models…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Connection failed or catalog unavailable/),
  ).toBeVisible();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Claude Sonnet 4.5");
  await page
    .getByRole("option", { name: "Claude Sonnet 4.5", exact: true })
    .click();
  const key = page.locator("#byok-key");
  await expect(key).toHaveAttribute("type", "password");
  await key.fill("fake-browser-session-key");
  await page.getByRole("button", { name: "Reveal API key" }).click();
  await expect(key).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide API key" }).click();
  await expect(
    page.getByText("Live catalog loaded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Anthropic catalog connected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(
    page.getByText("Anthropic catalog connected", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByText(/Model unavailable in the live catalog/),
  ).toBeVisible();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Test model");
  await page.getByLabel("Search models").press("Enter");
  await expect(page.getByLabel("Model", { exact: true })).toContainText(
    "Test model",
  );
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored).not.toContain("fake-browser-session-key");
  await page.reload();
  await expect(page.locator("#byok-key")).toHaveValue("");
});

test("live stage events culminate in a safe, readable memo", async ({
  page,
}) => {
  const result = {
    ...buildDemoRun("Should our test team pilot a new decision process?"),
    mode: "live",
    verdict: "Run a bounded pilot. ".repeat(25),
    agents: buildDemoRun(
      "Should our test team pilot a new decision process?",
    ).agents.map((finding) => ({
      ...finding,
      detail:
        "Specific evidence and constraints should determine the next step. ".repeat(
          15,
        ),
    })),
  };
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: { source: "fallback", models: popularModels("openrouter") },
    }),
  );
  await page.addInitScript((memo) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (input !== "/api/run") return originalFetch(input, init);
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              const send = (event: object) =>
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(event) + "\n"),
                );
              send({ type: "stage", stage: "perspectives" });
              setTimeout(() => {
                ["optimist", "analyst", "skeptic"].forEach((id) =>
                  send({ type: "perspective", id }),
                );
                send({ type: "stage", stage: "chair" });
              }, 800);
              setTimeout(() => {
                send({ type: "result", result: memo });
                controller.close();
              }, 1800);
            },
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        ),
      );
    };
  }, result);
  await page.goto("/");
  await page
    .getByLabel("Decision brief")
    .fill(
      "Should our test team pilot a new decision process? Include measurable outcomes and a time limit.",
    );
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(
    page.getByRole("heading", {
      name: "Reviewing your decision…",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Writing recommendation…" }),
  ).toBeVisible();
  await expect(page.getByText("Chair’s call", { exact: true })).toBeVisible();
  await expect(page.getByTestId("agent-analyst")).toContainText(
    "Specific evidence",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: /^Library/ })
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel("Search decisions")).toBeVisible();
  await page.locator(".library-list article > button").first().click();
  await expect(page.getByText("Chair’s call", { exact: true })).toBeVisible();
});

test("local setup, picker keyboard navigation, and paid routing guidance", async ({
  page,
}) => {
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: { source: "fallback", models: popularModels("openrouter") },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page
    .getByRole("button", { name: "Local / advanced", exact: true })
    .click();
  await page.getByLabel("Search models").fill("Ollama");
  await page.getByLabel("Search models").press("ArrowDown");
  await page.getByLabel("Search models").press("Enter");
  await expect(page.locator("#api-endpoint")).toHaveValue(
    "http://localhost:11434/v1",
  );
  await page.locator("#local-model").fill("test-model");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search models").fill("Anthropic Claude Sonnet");
  await page
    .getByRole("option", { name: "Anthropic Claude Sonnet 4.5", exact: true })
    .click();
  await expect(page.getByText("Requires key", { exact: true })).toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should we test this product with five test customers?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your OpenRouter API key",
  );
});

test("invalid API requests remain rejected without reflecting secrets", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/run", {
        data: Buffer.from("{"),
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/run", { data: { brief: "x".repeat(17000) } })
    ).status(),
  ).toBe(413);
  expect((await request.get("/api/run")).status()).toBe(405);
  const response = await request.post("/api/run", {
    data: {
      brief: "Should our test team pilot this process?",
      connection: {
        provider: "custom",
        model: "test-model",
        baseURL: "https://example.com/v1?key=fake-test-secret",
        apiKey: "",
      },
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).not.toContain("fake-test-secret");
});

test("unconfigured shared access asks for a key before running", async ({
  page,
}) => {
  await page.route("**/api/availability", (route) =>
    route.fulfill({ json: { sharedOpenRouter: false } }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: { source: "fallback", models: popularModels("openrouter") },
    }),
  );
  await page.goto("/");
  await expect(page.getByText(/Shared access is not configured/)).toBeVisible();
  await expect(page.locator("#byok-key")).toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should our test team try this decision workflow?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your OpenRouter API key",
  );
});

test("failed council preserves the brief and allows another attempt", async ({
  page,
}) => {
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: { source: "fallback", models: popularModels("openrouter") },
    }),
  );
  await page.route("**/api/run", (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: "The model request failed. Check the endpoint, model, and key.",
      },
    }),
  );
  await page.goto("/");
  const brief =
    "Should our test team try this decision workflow with a four-week pilot?";
  await page.getByLabel("Decision brief").fill(brief);
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The model request failed",
  );
  await expect(page.getByLabel("Decision brief")).toHaveValue(brief);
  await expect(
    page.getByRole("button", { name: /convene council/i }),
  ).toBeEnabled();
});

test("other free OpenRouter models require BYOK while NVIDIA is shared", async ({
  page,
  request,
}) => {
  await page.route("**/api/availability", (route) =>
    route.fulfill({ json: { sharedOpenRouter: true } }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: {
        source: "live",
        models: [
          ...popularModels("openrouter"),
          {
            id: "test-provider/test-model:free",
            name: "Test free model",
            free: true,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Free · Shared", { exact: true })).toBeVisible();
  await expect(page.locator("#byok-key")).not.toBeVisible();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByRole("button", { name: "Ready to use", exact: true }).click();
  await page.getByLabel("Search models").fill("Test free model");
  await expect(page.getByText(/No matching models/)).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText("Free · BYOK", { exact: true })).toBeVisible();
  await page
    .getByRole("option", { name: "Test free model · Free", exact: true })
    .click();
  await expect(page.getByText("Requires key", { exact: true })).toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should our test team pilot this decision process?");
  let runs = 0;
  page.on("request", (event) => {
    if (event.url().endsWith("/api/run")) runs += 1;
  });
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your OpenRouter API key",
  );
  expect(runs).toBe(0);
  const response = await request.post("/api/run", {
    data: {
      brief: "Should our test team pilot this decision process?",
      connection: {
        provider: "openrouter",
        model: "test-provider/test-model:free",
        baseURL: "",
        apiKey: "",
      },
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain(
    "requires your own OpenRouter API key",
  );
});

test("theme preference survives reload and the model menu returns focus", async ({
  page,
}) => {
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: { source: "fallback", models: popularModels("openrouter") },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What are you deciding?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").press("Escape");
  await expect(page.getByLabel("Model", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("desktop sidebar can collapse and reopen a recent decision", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Recent decisions use Library on phones.");
  await page.goto("/");
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByRole("option", { name: /Offline council/ }).click();
  await page
    .getByRole("button", { name: "Use an example", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Convene council", exact: true })
    .click();
  await expect(page.getByText("Chair’s call", { exact: true })).toBeVisible();
  const recent = page.locator(".recent-decisions button").first();
  await expect(recent).toBeVisible();
  const title = await recent.getAttribute("title");
  await page.getByRole("button", { name: "Start over" }).click();
  await recent.click();
  await expect(
    page.getByRole("heading", { name: title ?? "", exact: true }),
  ).toBeVisible();
});

test("320px navigation, BYOK controls, and memo fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page
    .getByRole("option", { name: "Claude Sonnet 4.5", exact: true })
    .click();
  await expect(page.locator("#byok-key")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Offline");
  await page.getByRole("option", { name: /Offline council/ }).click();
  await page
    .getByRole("button", { name: "Use an example", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Convene council", exact: true })
    .click();
  await expect(page.getByText("Chair’s call", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("large catalogs stay bounded, keyboard selection works, and placement stays above", async ({
  page,
}) => {
  await page.route("**/api/models?**", (route) =>
    route.fulfill({
      json: {
        source: "live",
        models: [
          ...popularModels("openrouter"),
          ...Array.from({ length: 500 }, (_, index) => ({
            id: `test/model-${index}`,
            name: `Test model ${index}`,
            free: false,
          })),
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await expect(page.locator(".picker-positioner")).toHaveAttribute(
    "data-side",
    "top",
  );
  await page.getByLabel("Search models").fill("Test model");
  expect(await page.getByRole("option").count()).toBeLessThan(20);
  await page.getByLabel("Search models").press("End");
  await expect(page.getByLabel("Search models")).toHaveAttribute(
    "aria-activedescendant",
    "model-option-499",
  );
  await expect(page.locator("#model-option-499")).toBeVisible();
  await page.getByLabel("Search models").press("Enter");
  await expect(page.getByLabel("Model", { exact: true })).toContainText(
    "Test model 499",
  );
  await page.getByLabel("Model", { exact: true }).click();
  await expect(page.locator(".picker-positioner")).toHaveAttribute(
    "data-side",
    "top",
  );
  await page.getByLabel("Search models").fill("Test model 1");
  await expect(page.locator(".picker-positioner")).toHaveAttribute(
    "data-side",
    "top",
  );
  await page.getByLabel("Search models").press("Home");
  await page.getByLabel("Search models").press("Enter");
  await expect(page.getByLabel("Model", { exact: true })).toContainText(
    "Test model 1",
  );
  await page.getByLabel("Model", { exact: true }).click();
  await expect(page.locator(".picker-positioner")).toHaveAttribute(
    "data-side",
    "top",
  );
});

test("direct OpenAI and Anthropic catalogs use separate client keys", async ({
  page,
}) => {
  const keys: Record<string, string> = {};
  await page.route("**/api/models?**", async (route) => {
    const provider =
      new URL(route.request().url()).searchParams.get("provider") ?? "";
    const key = route.request().headers()["x-conclave-key"];
    if (key) keys[provider] = key;
    await route.fulfill({
      json: {
        source: "fallback",
        models: popularModels(
          provider === "openai"
            ? "openai"
            : provider === "anthropic"
              ? "anthropic"
              : "openrouter",
        ),
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("OpenAI");
  const openai = page
    .getByRole("option")
    .filter({ hasText: "OpenAI · Direct" })
    .first();
  await openai.click();
  await expect(page.locator("#byok-key")).toHaveValue("");
  await page.locator("#byok-key").fill("fake-openai-key");
  await expect.poll(() => keys.openai).toBe("fake-openai-key");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Claude Sonnet");
  await page
    .getByRole("option")
    .filter({ hasText: "Anthropic · Direct" })
    .click();
  await expect(page.locator("#byok-key")).toHaveValue("");
  await page.locator("#byok-key").fill("fake-anthropic-key");
  await expect.poll(() => keys.anthropic).toBe("fake-anthropic-key");
  expect(keys.openrouter).toBeUndefined();
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("OpenAI");
  await page
    .getByRole("option")
    .filter({ hasText: "OpenAI · Direct" })
    .first()
    .click();
  await expect(page.locator("#byok-key")).toHaveValue("fake-openai-key");
});

test("Models.dev lists direct provider models before a key is added, with local logos", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      json: {
        catalogs: {
          openai: [
            {
              id: "test-new-openai",
              name: "Test newest OpenAI",
              free: false,
              context: 128000,
              images: true,
            },
          ],
          anthropic: [
            {
              id: "test-new-anthropic",
              name: "Test newest Anthropic",
              free: false,
            },
          ],
          nvidia: [
            { id: "nvidia/test:free", name: "Test shared NVIDIA", free: true },
          ],
        },
        source: "models.dev",
      },
    }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({ json: { models: [], source: "fallback" } }),
  );
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Test newest OpenAI");
  const option = page.getByRole("option", {
    name: "Test newest OpenAI",
    exact: true,
  });
  await expect(option).toContainText("OpenAI · Direct · 128k context · Images");
  expect(
    await option
      .locator("img")
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await option.click();
  await expect(page.getByLabel("Model", { exact: true })).toContainText(
    "Test newest OpenAI",
  );
  await expect(page.getByText(/Models.dev catalog · add a key/)).toBeVisible();
  await expect(
    page.getByText(/catalog connected/, { exact: false }),
  ).not.toBeVisible();
  await page
    .getByLabel("Decision brief")
    .fill("Should our test team pilot a new decision process?");
  await page.getByRole("button", { name: /convene council/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Add your OpenAI API key",
  );
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("Test newest Anthropic");
  await expect(
    page.getByRole("option", { name: "Test newest Anthropic", exact: true }),
  ).toBeVisible();
});

test("model release dates rank newer releases above older latest aliases", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      json: {
        catalogs: {
          openai: [
            {
              id: "test-old",
              name: "Test older latest alias",
              free: false,
              releaseDate: "2025-01-01",
            },
            { id: "test-undated", name: "Test undated", free: false },
            {
              id: "test-new",
              name: "Test newest release",
              free: false,
              releaseDate: "2026-09-04",
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({ json: { models: [], source: "fallback" } }),
  );
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page.getByLabel("Search models").fill("test-");
  await expect(page.getByRole("option")).toHaveCount(3);
  await expect(page.getByRole("option").nth(0)).toHaveAttribute(
    "aria-label",
    "Test newest release",
  );
  await expect(page.getByRole("option").nth(1)).toHaveAttribute(
    "aria-label",
    "Test older latest alias",
  );
  await expect(page.getByRole("option").nth(2)).toHaveAttribute(
    "aria-label",
    "Test undated",
  );
  await expect(
    page.getByRole("option").nth(0).getByText("Newest", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search models").fill("Test older");
  await expect(page.getByText("Newest", { exact: true })).not.toBeVisible();
});

test("Your provider groups OpenAI before Anthropic and orders releases within each provider", async ({
  page,
}) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      json: {
        catalogs: {
          openai: [
            {
              id: "test-old-openai",
              name: "Test old OpenAI",
              free: false,
              releaseDate: "2025-01-01",
            },
            {
              id: "test-new-openai",
              name: "Test new OpenAI",
              free: false,
              releaseDate: "2026-01-01",
            },
          ],
          anthropic: [
            {
              id: "test-new-anthropic",
              name: "Test new Anthropic",
              free: false,
              releaseDate: "2026-09-01",
            },
          ],
          google: [
            {
              id: "test-new-google",
              name: "Test new Google",
              free: false,
              releaseDate: "2026-09-04",
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({ json: { models: [], source: "fallback" } }),
  );
  await page.goto("/");
  await page.getByLabel("Model", { exact: true }).click();
  await page
    .getByRole("button", { name: "Your provider", exact: true })
    .click();
  await page.getByLabel("Search models").fill("test-");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(4);
  for (const [index, name] of [
    "Test new OpenAI",
    "Test old OpenAI",
    "Test new Anthropic",
    "Test new Google",
  ].entries())
    await expect(options.nth(index)).toHaveAttribute("aria-label", name);
  await expect(options.nth(0).locator(".provider-group-label")).toHaveText(
    "OpenAI",
  );
  await expect(options.nth(2).locator(".provider-group-label")).toHaveText(
    "Anthropic",
  );
  await page.getByLabel("Search models").press("ArrowDown");
  await page.getByLabel("Search models").press("Enter");
  await expect(page.getByLabel("Model", { exact: true })).toContainText(
    "Test old OpenAI",
  );
});
