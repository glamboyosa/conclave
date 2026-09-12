import { expect, test } from "@playwright/test";
import { buildDemoRun } from "../src/engine";

const brief = "Should our test team pilot a new decision workflow?";
const original = {
  id: "original-test-decision",
  createdAt: "2026-09-12T12:00:00.000Z",
  brief,
  result: { ...buildDemoRun(brief), mode: "live" as const },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ status: 503, json: { error: "Test catalog unavailable" } }),
  );
  await page.route("**/api/availability", (route) =>
    route.fulfill({ json: { sharedOpenRouter: true } }),
  );
  await page.route("**/api/models?**", (route) =>
    route.fulfill({ json: { source: "fallback", models: [] } }),
  );
  await page.addInitScript(
    ({ original }) => {
      if (localStorage.getItem("conclave:library")) return;
      localStorage.setItem("conclave:library", JSON.stringify([original]));
      localStorage.setItem(
        "conclave:lastRun",
        JSON.stringify({
          brief: original.brief,
          result: original.result,
          recordId: original.id,
        }),
      );
      localStorage.setItem(
        "conclave:connection",
        JSON.stringify({
          provider: "custom",
          model: "test-model",
          baseURL: "https://test.invalid/v1",
        }),
      );
    },
    { original },
  );
});

test("discussion survives reload and a revision preserves the original memo and conversation", async ({
  page,
}) => {
  let replies = 0;
  let revisions = 0;
  await page.route("**/api/discuss", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.brief).toBe(brief);
    expect(body.memo.verdict).toBe(original.result.verdict);
    expect(body.messages.at(-1).content).toBe("Our budget is now £5,000.");
    replies++;
    await route.fulfill(
      replies === 1
        ? {
            status: 502,
            json: { error: "Provider credits exhausted. Run ID: test-reply" },
          }
        : { json: { text: "That budget calls for a smaller pilot." } },
    );
  });
  await page.route("**/api/run", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.revision.memo.verdict).toBe(original.result.verdict);
    expect(body.revision.messages).toHaveLength(2);
    expect(body.revision.messages[0].content).toBe("Our budget is now £5,000.");
    revisions++;
    await route.fulfill(
      revisions === 1
        ? { status: 502, json: { error: "Test revision failed" } }
        : {
            json: {
              ...original.result,
              title: "A smaller pilot",
              verdict: "Reduce scope to fit £5,000.",
            },
          },
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Discuss this decision", exact: true })
    .click();
  const input = page.getByLabel("Your follow-up");
  await input.fill("Our budget is now £5,000.");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Provider credits exhausted",
  );
  await expect(input).toHaveValue("Our budget is now £5,000.");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(
    page.getByText("That budget calls for a smaller pilot.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Our budget is now £5,000.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revise decision", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Test revision failed");
  await expect(
    page.getByText(original.result.verdict, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("That budget calls for a smaller pilot.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revise decision", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A smaller pilot", exact: true }),
  ).toBeVisible();
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conclave:library") ?? "[]"),
  );
  expect(records).toHaveLength(2);
  expect(records[0].parentId).toBe(original.id);
  expect(records[1].result.verdict).toBe(original.result.verdict);
  expect(records[1].discussion).toHaveLength(2);
  await page.getByRole("button", { name: "View previous memo" }).click();
  await expect(
    page.getByText("That budget calls for a smaller pilot.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("pending replies cycle downward without shifting layout and respect reduced motion", async ({
  page,
}) => {
  let complete: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    complete = resolve;
  });
  await page.route("**/api/discuss", async (route) => {
    await waiting;
    await route.fulfill({ json: { text: "Here is the reply." } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Discuss this decision", exact: true })
    .click();
  await page
    .getByLabel("Your follow-up")
    .fill("What would change your recommendation?");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  const pending = page.locator(".discussion-pending");
  await pending.scrollIntoViewIfNeeded();
  await expect(pending).toHaveAttribute("data-paused", "false");
  await expect(
    pending.getByText("Waiting for the Chair’s reply.", { exact: true }),
  ).toBeAttached();
  const frame = async (time: number) =>
    pending.evaluate((element, time) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = time;
      }
      const messages = Array.from(
        element.querySelectorAll(".discussion-pending-message"),
      );
      return {
        height: element.getBoundingClientRect().height,
        messages: messages.map((message) => {
          const style = getComputedStyle(message);
          return {
            opacity: Number(style.opacity),
            y: new DOMMatrixReadOnly(style.transform).m42,
          };
        }),
      };
    }, time);
  const entering = await frame(100);
  const leaving = await frame(2850);
  const next = await frame(3300);
  expect(entering.messages[0].y).toBeLessThan(0);
  expect(leaving.messages[0].y).toBeGreaterThan(0);
  expect(next.messages[0].opacity).toBe(0);
  expect(next.messages[1].opacity).toBe(1);
  expect(next.height).toBe(entering.height);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await pending.evaluate((element) => ({
    animations: element.getAnimations({ subtree: true }).length,
    first: getComputedStyle(
      element.querySelectorAll(".discussion-pending-message")[0],
    ).opacity,
  }));
  expect(reduced).toEqual({ animations: 0, first: "1" });
  complete();
  await expect(
    page.getByText("Here is the reply.", { exact: true }),
  ).toBeVisible();
  await expect(pending).toHaveCount(0);
});

test("Markdown replies stay readable and navigation controls preserve the reader's position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const markdown = [
    "## Contractor plan",
    "**Reserve named capacity.**",
    "1. Confirm availability\n2. Agree a spending cap",
    "| Option | Cost |\n| --- | --- |\n| Contractor | £5,000 |",
    `\`\`\`text\n${"bounded ".repeat(90)}\n\`\`\``,
    ...Array.from(
      { length: 20 },
      (_, index) =>
        `Consideration ${index + 1}: Keep the initial engagement small enough to stop if delivery or demand does not justify extending it.`,
    ),
  ].join("\n\n");
  let complete: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let calls = 0;
  await page.route("**/api/discuss", async (route) => {
    calls++;
    if (calls === 1) await waiting;
    await route.fulfill({
      json: {
        text:
          calls === 1
            ? markdown
            : `${markdown}\n\nThe lower budget changes the scope.`,
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Discuss this decision", exact: true })
    .click();
  const atLatest = () =>
    page.evaluate(() => {
      const bottom = document
        .getElementById("discussion-latest")!
        .getBoundingClientRect().bottom;
      return bottom >= 0 && bottom <= innerHeight + 1;
    });
  await expect.poll(atLatest).toBe(true);
  await page
    .getByLabel("Your follow-up")
    .fill("Compare contractor engagement options.");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(page.locator(".discussion-pending")).toBeVisible();
  await expect.poll(atLatest).toBe(true);
  await page.getByRole("button", { name: "Back to decision" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getElementById("decision-memo")!.getBoundingClientRect().top,
      ),
    )
    .toBeGreaterThanOrEqual(0);
  await expect(page.locator("#decision-memo")).toBeFocused();
  complete();
  await expect(
    page.getByRole("heading", { name: "Contractor plan" }),
  ).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBeLessThan(150);
  await expect(page.getByRole("cell", { name: "£5,000" })).toBeVisible();
  await page.getByRole("button", { name: "Latest reply" }).click();
  await expect.poll(atLatest).toBe(true);
  await page
    .getByLabel("Your follow-up")
    .fill("What changes with a lower budget?");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(
    page.getByText("The lower budget changes the scope.", { exact: true }),
  ).toBeVisible();
  await expect.poll(atLatest).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const code = page.locator(".discussion-markdown pre").first();
  expect(
    await code.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Contractor plan" }).first(),
  ).toBeVisible();
});
