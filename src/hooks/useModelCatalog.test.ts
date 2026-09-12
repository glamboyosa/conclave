import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { defaultConnection } from "../providers";
import { useModelCatalog } from "./useModelCatalog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("confirms authenticated catalog access once, including after a retry", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          models: [{ id: "test-model", name: "Test model", free: false }],
          source: "live",
        }),
      ),
  );
  const connected = vi.fn();

  const { result } = renderHook(() =>
    useModelCatalog(
      {
        ...defaultConnection,
        provider: "anthropic",
        apiKey: "fake-key",
      },
      connected,
    ),
  );

  await waitFor(() => expect(connected).toHaveBeenCalledWith("anthropic"));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.modelStatus).toBe("ready"));
  expect(connected).toHaveBeenCalledTimes(1);
});

it.each(["openrouter", "nvidia"] as const)(
  "does not validate a key through the public %s catalog",
  async (provider) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            models: [{ id: "test-model", name: "Test model", free: false }],
            source: "live",
          }),
        ),
    );
    const connected = vi.fn();

    const { result } = renderHook(() =>
      useModelCatalog(
        {
          ...defaultConnection,
          provider,
          apiKey: "fake-key",
        },
        connected,
      ),
    );

    await waitFor(() => expect(result.current.modelSource).toBe("live"));
    expect(connected).not.toHaveBeenCalled();
  },
);

it("does not confirm failed key checks that return fallback models", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          models: [{ id: "test-model", name: "Test model", free: false }],
          source: "fallback",
        }),
      ),
  );
  const connected = vi.fn();

  const { result } = renderHook(() =>
    useModelCatalog(
      {
        ...defaultConnection,
        provider: "openai",
        apiKey: "fake-key",
      },
      connected,
    ),
  );

  await waitFor(() => expect(result.current.modelStatus).toBe("ready"));
  expect(connected).not.toHaveBeenCalled();
});

it("does not confirm a rejected catalog request", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unauthorized"));
  const connected = vi.fn();

  const { result } = renderHook(() =>
    useModelCatalog(
      {
        ...defaultConnection,
        provider: "anthropic",
        apiKey: "fake-invalid-key",
      },
      connected,
    ),
  );

  await waitFor(() => expect(result.current.modelStatus).toBe("ready"));
  expect(connected).not.toHaveBeenCalled();
});
