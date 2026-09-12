import { z } from "zod";
import type { CatalogModel, ProviderId } from "../src/providers.js";

const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  modalities: z.object({
    input: z.array(z.string()),
    output: z.array(z.string()),
  }),
  structured_output: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  release_date: z.iso.date().optional().catch(undefined),
  limit: z.object({ context: z.number().nonnegative() }).optional(),
  cost: z
    .object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
    })
    .optional(),
});

const databaseSchema = z.record(
  z.string(),
  z.object({ models: z.record(z.string(), z.unknown()) }),
);

const providerIds: Partial<Record<ProviderId, string>> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  moonshot: "moonshotai",
  deepseek: "deepseek",
  xai: "xai",
  groq: "groq",
  mistral: "mistral",
  openrouter: "openrouter",
  nvidia: "openrouter",
};

export const parseModelsDev = (
  database: z.infer<typeof databaseSchema>,
): Partial<Record<ProviderId, CatalogModel[]>> => {
  return Object.fromEntries(
    Object.entries(providerIds).map(([provider, id]) => {
      const models = Object.values(database[id]?.models ?? {}).flatMap(
        (value) => {
          const parsed = modelSchema.safeParse(value);

          if (!parsed.success) return [];
          const model = parsed.data;

          if (
            !model.modalities.input.includes("text") ||
            !model.modalities.output.includes("text") ||
            model.structured_output === false
          )
            return [];

          if (provider === "nvidia" && !model.id.startsWith("nvidia/"))
            return [];

          return [
            {
              id: model.id,
              name: model.name,
              free: Boolean(
                model.cost && model.cost.input === 0 && model.cost.output === 0,
              ),
              context: model.limit?.context,
              images: model.modalities.input.includes("image"),
              reasoning: model.reasoning,
              releaseDate: model.release_date,
              inputCost: model.cost?.input,
              outputCost: model.cost?.output,
            },
          ];
        },
      );

      return [provider, models];
    }),
  );
};

export const createModelsDevCatalog = () => {
  let cached:
    | {
        expiresAt: number;
        catalogs: Partial<Record<ProviderId, CatalogModel[]>>;
      }
    | undefined;

  let pending: Promise<Partial<Record<ProviderId, CatalogModel[]>>> | undefined;

  return async () => {
    if (cached && cached.expiresAt > Date.now()) return cached.catalogs;

    if (pending) return pending;
    pending = (async () => {
      const response = await fetch("https://models.dev/api.json", {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) throw new Error("Models.dev catalog unavailable");

      const catalogs = parseModelsDev(
        databaseSchema.parse(await response.json()),
      );

      if (!Object.values(catalogs).some((models) => models.length))
        throw new Error("Models.dev catalog empty");
      cached = { catalogs, expiresAt: Date.now() + 5 * 60_000 };

      return catalogs;
    })();

    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
};
