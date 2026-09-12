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
