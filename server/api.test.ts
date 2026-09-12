import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
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
