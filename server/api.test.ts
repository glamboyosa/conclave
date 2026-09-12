import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import productionDiscuss from "../api/discuss";
import { buildDemoRun } from "../src/engine";
import productionRun from "../api/run";
import productionCatalog from "../api/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildModel } from "./api";
import type { ProviderId } from "../src/providers";

afterEach(() => vi.unstubAllGlobals());

describe("direct provider routing", () => {
  it.each([
    [
      "openai",
      "https://api.openai.com/v1/responses",
      "authorization",
      "Bearer fake-client-key",
    ],
    [
      "anthropic",
      "https://api.anthropic.com/v1/messages",
      "x-api-key",
      "fake-client-key",
    ],
  ] as const)(
    "sends %s requests directly using the client key",
    async (provider, url, header, expectedKey) => {
      const fetchMock = vi
        .fn()
        .mockRejectedValue(new Error("Test request stopped"));

      vi.stubGlobal("fetch", fetchMock);

      const model = buildModel(
        {
          provider,
          model: "test-model",
          baseURL: "",
          apiKey: "fake-client-key",
        },
        { OPENROUTER_API_KEY: "fake-shared-key" },
      );

      await expect(
        model.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Test decision" }],
            },
          ],
        }),
      ).rejects.toThrow("Test request stopped");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [destination, options] = fetchMock.mock.calls[0];
      expect(destination).toBe(url);
      expect(new Headers(options.headers).get(header)).toBe(expectedKey);
      expect(JSON.stringify(options)).not.toContain("fake-shared-key");
    },
  );

  it.each(["openai", "anthropic"] satisfies ProviderId[])(
    "does not substitute a server key for missing %s BYOK",
    (provider) => {
      expect(() =>
        buildModel(
          { provider, model: "test-model", baseURL: "", apiKey: "" },
          { OPENROUTER_API_KEY: "fake-shared-key" },
        ),
      ).toThrow(/API key/);
    },
  );
});

describe("production API entrypoints", () => {
  it("accepts a Vercel-parsed body without waiting for a consumed request stream", async () => {
    const req = new IncomingMessage(new Socket());
    req.method = "POST";
    req.url = "/api/run";
    Object.assign(req, {
      body: {
        brief: "Should our test team pilot a new decision workflow?",
        connection: {
          provider: "demo",
          model: "offline",
          apiKey: "",
          baseURL: "",
        },
      },
    });
    const res = new ServerResponse(req);
    const end = vi.spyOn(res, "end").mockReturnValue(res);
    await productionRun(req, res);
    expect(res.statusCode).toBe(200);
    const result = JSON.parse(String(end.mock.calls[0][0]));
    expect(result.mode).toBe("local");
    expect(result.agents).toHaveLength(3);
  });

  it("serves the Models.dev catalog through the production entrypoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              openai: {
                models: {
                  "test-model": {
                    id: "test-model",
                    name: "Test model",
                    modalities: { input: ["text"], output: ["text"] },
                    release_date: "2026-09-01",
                  },
                },
              },
            }),
          ),
        ),
    );
    const req = new IncomingMessage(new Socket());
    req.method = "GET";
    req.url = "/api/catalog";
    const res = new ServerResponse(req);
    const end = vi.spyOn(res, "end").mockReturnValue(res);
    await productionCatalog(req, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(String(end.mock.calls[0][0])).catalogs.openai[0].id).toBe(
      "test-model",
    );
  });
});

it("serves a discussion reply through the production endpoint using the client connection", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "test-response",
        object: "chat.completion",
        created: 1,
        model: "test-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Cut the scope to fit £5,000.",
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );

  vi.stubGlobal("fetch", fetch);
  const req = new IncomingMessage(new Socket());
  req.method = "POST";
  req.url = "/api/discuss";
  const brief = "Should our test team pilot a new decision workflow?";
  Object.assign(req, {
    body: {
      brief,
      memo: buildDemoRun(brief),
      messages: [{ role: "user", content: "We only have £5,000." }],
      connection: {
        provider: "custom",
        model: "test-model",
        baseURL: "https://test.invalid/v1",
        apiKey: "fake-client-key",
      },
    },
  });
  const res = new ServerResponse(req);
  const end = vi.spyOn(res, "end").mockReturnValue(res);
  await productionDiscuss(req, res);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(String(end.mock.calls[0][0])).text).toContain("£5,000");
  expect(String(fetch.mock.calls[0][0])).toBe(
    "https://test.invalid/v1/chat/completions",
  );
  expect(JSON.stringify(fetch.mock.calls[0][1].body)).toContain(
    "We only have £5,000.",
  );
});

it.each([
  { role: "assistant", content: "A reply cannot start a new request." },
  { role: "user", content: "x".repeat(4001) },
])(
  "rejects invalid discussion input before calling a provider",
  async (message) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const req = new IncomingMessage(new Socket());
    req.method = "POST";
    req.url = "/api/discuss";
    Object.assign(req, {
      body: {
        brief: "Should our test team pilot a new decision workflow?",
        memo: buildDemoRun("Test decision"),
        messages: [message],
        connection: {
          provider: "openai",
          model: "test-model",
          baseURL: "",
          apiKey: "fake-client-key",
        },
      },
    });
    const res = new ServerResponse(req);
    vi.spyOn(res, "end").mockReturnValue(res);
    await productionDiscuss(req, res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);
