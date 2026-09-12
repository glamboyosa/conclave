import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  popularModels,
  type CatalogModel,
  type ModelConnection,
  type ProviderId,
  pickerProviders,
} from "../providers";

const catalogResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      free: z.boolean(),
      releaseDate: z.iso.date().optional(),
    }),
  ),
  source: z.enum(["live", "fallback"]).catch("fallback"),
});

export const useModelCatalog = (
  connection: ModelConnection,
  onKeyConnected?: (provider: ProviderId) => void,
) => {
  const [revision, setRevision] = useState(0);

  const [catalogs, setCatalogs] = useState<
    Partial<Record<ProviderId, CatalogModel[]>>
  >({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");

        const data = z
          .object({
            catalogs: z.record(
              z.string(),
              z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  free: z.boolean(),
                  context: z.number().optional(),
                  images: z.boolean().optional(),
                  reasoning: z.boolean().optional(),
                  releaseDate: z.iso.date().optional(),
                  inputCost: z.number().optional(),
                  outputCost: z.number().optional(),
                }),
              ),
            ),
          })
          .parse(await response.json());

        if (!controller.signal.aborted)
          setCatalogs(
            Object.fromEntries(
              pickerProviders.flatMap((provider) =>
                data.catalogs[provider]?.length
                  ? [[provider, data.catalogs[provider]]]
                  : [],
              ),
            ),
          );
      })
      .catch(() => {
        /* The picker retains its curated models when Models.dev is unavailable. */
      });

    return () => controller.abort();
  }, [revision]);
  const checkedKeys = useRef(new Map<ProviderId, string>());
  const [sharedAvailable, setSharedAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/availability", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Availability check failed");

        return z
          .object({ sharedOpenRouter: z.boolean() })
          .parse(await response.json());
      })
      .then((value) => {
        if (!controller.signal.aborted)
          setSharedAvailable(value.sharedOpenRouter);
      })
      .catch(() => {
        /* An unknown server configuration must not be presented as a verified connection. */
      });

    return () => controller.abort();
  }, []);

  const [models, setModels] = useState<CatalogModel[]>(() =>
    popularModels(connection.provider),
  );

  const [modelSource, setModelSource] = useState<"live" | "fallback">(
    "fallback",
  );

  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready">(
    connection.provider === "demo" ? "idle" : "loading",
  );

  const [debouncedKey, setDebouncedKey] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedKey(connection.apiKey.trim()),
      500,
    );

    return () => clearTimeout(timer);
  }, [connection.apiKey]);

  useEffect(() => {
    if (!connection.apiKey.trim())
      checkedKeys.current.delete(connection.provider);

    if (
      connection.provider === "demo" ||
      ["ollama", "lmstudio", "custom"].includes(connection.provider)
    )
      return;

    if (debouncedKey !== connection.apiKey.trim()) return;

    const controller = new AbortController();
    let stale = false;

    fetch(`/api/models?provider=${connection.provider}`, {
      signal: controller.signal,
      headers: debouncedKey ? { "x-conclave-key": debouncedKey } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");

        return catalogResponseSchema.parse(await response.json());
      })
      .then(({ models: nextModels, source }) => {
        // A switch that happened while this fetch was in flight must not overwrite the new provider's list.
        if (stale) return;

        const live = nextModels.length
          ? nextModels
          : popularModels(connection.provider);

        setModels(live);
        setModelSource(nextModels.length ? source : "fallback");
        setModelStatus("ready");

        // OpenRouter and NVIDIA catalogs are public and cannot validate a key.
        if (
          debouncedKey &&
          source === "live" &&
          nextModels.length > 0 &&
          connection.provider !== "openrouter" &&
          connection.provider !== "nvidia" &&
          checkedKeys.current.get(connection.provider) !== debouncedKey
        ) {
          checkedKeys.current.set(connection.provider, debouncedKey);
          onKeyConnected?.(connection.provider);
        }
      })
      .catch((cause: unknown) => {
        if (stale) return;

        if (cause instanceof DOMException && cause.name === "AbortError")
          return;

        setModels(popularModels(connection.provider));
        setModelSource("fallback");
        setModelStatus("ready");
      });

    return () => {
      stale = true;
      controller.abort();
    };
  }, [
    connection.provider,
    connection.apiKey,
    debouncedKey,
    revision,
    onKeyConnected,
  ]);

  const refresh = () => {
    setModelStatus("loading");
    setRevision((value) => value + 1);
  };

  return {
    catalogs,
    sharedAvailable,
    refresh,
    models,
    modelSource,
    modelStatus,
    setModels,
    setModelSource,
    setModelStatus,
    setDebouncedKey,
  };
};
