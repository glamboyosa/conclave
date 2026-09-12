import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, it, vi } from "vitest";
import { runModelCouncil } from "./council";
import { buildDemoRun, type CouncilEvent } from "./engine";

it("runs perspectives concurrently and starts the Chair only after all three complete", async () => {
  const releases: Array<() => void> = [];
  const events: CouncilEvent[] = [];
  const brief = "Should our test team pilot a new decision workflow?";
  let calls = 0;

  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const index = calls++;

      if (index < 3)
        await new Promise<void>((resolve) => releases.push(resolve));

      const output =
        index < 3
          ? {
              thesis: "Run a bounded test",
              detail: "Measure observed behavior before committing.",
              signal: "Test first",
              score: 70,
            }
          : buildDemoRun(brief);

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });

  const pending = runModelCouncil(model, brief, (event) => events.push(event));
  await vi.waitFor(() => expect(releases).toHaveLength(3));
  expect(calls).toBe(3);
  expect(events).toEqual([{ type: "stage", stage: "perspectives" }]);
  releases[0]();
  await vi.waitFor(() => expect(events).toHaveLength(2));
  expect(calls).toBe(3);
  releases[1]();
  releases[2]();
  const result = await pending;
  expect(calls).toBe(4);
  expect(events.slice(1, 4).map((event) => event.type)).toEqual([
    "perspective",
    "perspective",
    "perspective",
  ]);
  expect(events[4]).toEqual({ type: "stage", stage: "chair" });
  expect(result.agents).toHaveLength(3);
  expect(result.mode).toBe("live");
});

it("retries upstream overloads carried inside HTTP 200 and completes the council", async () => {
  vi.useFakeTimers();
  let calls = 0;
  const brief = "Should our test team pilot a new decision workflow?";

  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const index = calls++;

      if (index === 0)
        throw new APICallError({
          message: "Service temporarily overloaded",
          url: "https://test.invalid",
          requestBodyValues: {},
          statusCode: 200,
          isRetryable: false,
        });

      const output =
        index < 4
          ? {
              thesis: "Run a test",
              detail: "Measure results first.",
              signal: "Test",
              score: 70,
            }
          : buildDemoRun(brief);

      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });

  try {
    const pending = runModelCouncil(model, brief);
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.mode).toBe("live");
    expect(calls).toBe(5);
  } finally {
    vi.useRealTimers();
  }
});

it("does not retry rejected credentials", async () => {
  let calls = 0;

  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      calls += 1;
      throw new APICallError({
        message: "Invalid API key",
        url: "https://test.invalid",
        requestBodyValues: {},
        statusCode: 401,
        isRetryable: false,
      });
    },
  });

  await expect(
    runModelCouncil(
      model,
      "Should our test team pilot a new decision workflow?",
    ),
  ).rejects.toThrow("Invalid API key");
  expect(calls).toBe(3);
});
