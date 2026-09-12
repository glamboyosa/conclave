import { afterEach, expect, it, vi } from "vitest";
import { createModelsDevCatalog, parseModelsDev } from "./models-dev";

const model = (id: string) => ({
  id,
  name: "Test model",
  modalities: { input: ["text", "image"], output: ["text"] },
  structured_output: true,
  reasoning: true,
  release_date: "2026-09-01",
  limit: { context: 128000 },
  cost: { input: 1, output: 5 },
});

const database = {
  openai: {
    models: {
      chat: model("test-chat"),
      image: {
        ...model("test-image"),
        modalities: { input: ["text"], output: ["image"] },
      },
      incompatible: { ...model("test-incompatible"), structured_output: false },
      malformed: { id: 123 },
    },
  },
  moonshotai: { models: { kimi: model("test-kimi") } },
  openrouter: {
    models: {
      free: { ...model("nvidia/test:free"), cost: { input: 0, output: 0 } },
      paid: model("nvidia/test"),
      other: model("openai/test"),
    },
  },
  nvidia: { models: { direct: model("test-direct-nvidia") } },
};

afterEach(() => vi.restoreAllMocks());

it("maps supported provider routes, metadata, and chat compatibility", () => {
  const catalogs = parseModelsDev(database);
  expect(catalogs.openai).toEqual([
    {
      id: "test-chat",
      name: "Test model",
      free: false,
      context: 128000,
      images: true,
      reasoning: true,
      releaseDate: "2026-09-01",
      inputCost: 1,
      outputCost: 5,
    },
  ]);
  expect(catalogs.moonshot?.[0].id).toBe("test-kimi");
  expect(catalogs.nvidia?.map((model) => [model.id, model.free])).toEqual([
    ["nvidia/test:free", true],
    ["nvidia/test", false],
  ]);
  expect(catalogs.openrouter).toHaveLength(3);
});

it("shares concurrent requests and reuses the cached public catalog without credentials", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(database)));

  const now = vi.spyOn(Date, "now").mockReturnValue(0);
  const load = createModelsDevCatalog();
  const [first, second] = await Promise.all([load(), load()]);
  expect(first).toBe(second);
  expect(await load()).toBe(first);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("https://models.dev/api.json", {
    signal: expect.any(AbortSignal),
  });
  now.mockReturnValue(5 * 60_000 + 1);
  await load();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("retries after an upstream outage", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new Error("Offline"))
    .mockImplementationOnce(async () => new Response(JSON.stringify(database)));

  const load = createModelsDevCatalog();
  await expect(load()).rejects.toThrow("Offline");
  expect((await load()).openai).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
