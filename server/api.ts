import { randomUUID } from "node:crypto";
import { describeRunError, redactSecrets } from "./run-error.js";
import { createModelsDevCatalog } from "./models-dev.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { discussDecision, runModelCouncil } from "../src/council.js";
import { buildDemoRun, type CouncilEvent, type DiscussionEvent } from "../src/engine.js";
import {
  providerMeta,
  usesSharedNvidiaRoute,
  parseProvider,
  popularModels,
  type CatalogModel,
  type ProviderId,
} from "../src/providers.js";

import {
  resultSchema,
  discussionMessageSchema,
  revisionContextSchema,
} from "../src/schemas.js";

const connectionSchema = z.object({
  provider: z.enum([
    "demo",
    "openrouter",
    "anthropic",
    "openai",
    "google",
    "moonshot",
    "deepseek",
    "xai",
    "groq",
    "mistral",
    "nvidia",
    "ollama",
    "lmstudio",
    "custom",
  ]),
  model: z.string().max(200),
  baseURL: z.string().max(500),
  apiKey: z.string().max(1000),
});

const requestSchema = z.object({
  brief: z.string().trim().min(20).max(4000),
  connection: connectionSchema.optional(),
  revision: revisionContextSchema.optional(),
});

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      pricing: z
        .object({
          prompt: z.string().optional(),
          completion: z.string().optional(),
        })
        .optional(),
      supported_parameters: z.array(z.string()).optional(),
      architecture: z
        .object({ output_modalities: z.array(z.string()).optional() })
        .optional(),
    }),
  ),
});

const openAIStyleCatalogSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

const anthropicCatalogSchema = z.object({
  data: z.array(
    z.object({ id: z.string(), display_name: z.string().optional() }),
  ),
});

const googleCatalogSchema = z.object({
  models: z.array(
    z.object({
      name: z.string(),
      displayName: z.string().optional(),
      supportedGenerationMethods: z.array(z.string()).optional(),
    }),
  ),
});

/** Models that cannot hold a council conversation. */
const nonChatPattern =
  /embed|whisper|tts|audio|realtime|image|moderation|ocr|transcri|rerank|davinci|babbage|guard/i;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: string,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(body);
}

function compatibleBaseURL(provider: string, requestedURL: string) {
  const url = new URL(requestedURL);

  if (url.username || url.password || url.search || url.hash) {
    throw new ApiError(
      400,
      "Use an endpoint without credentials, query parameters, or a fragment. Put credentials in the API key field.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(400, "API endpoints must use HTTP or HTTPS.");
  }

  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";

  if (provider === "ollama" || provider === "lmstudio") {
    if (!loopback)
      throw new Error("Local providers must use a loopback address.");
  } else if (url.protocol !== "https:" && !loopback) {
    throw new Error("Custom endpoints must use HTTPS.");
  }

  return requestedURL.replace(/\/$/, "");
}

function requireKey(apiKey: string, providerName: string) {
  const key = apiKey.trim();

  if (!key) {
    throw new ApiError(
      400,
      `Add your ${providerName} API key in the model picker.`,
    );
  }

  return key;
}

async function fetchOpenRouterModels(): Promise<CatalogModel[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error("OpenRouter catalog request failed");

  const catalog = catalogSchema.parse(await response.json());

  return catalog.data
    .filter(
      (model) =>
        model.architecture?.output_modalities?.includes("text") &&
        model.supported_parameters?.includes("structured_outputs"),
    )
    .map((model) => ({
      id: model.id,
      name: model.name || model.id,
      free: model.pricing?.prompt === "0" && model.pricing?.completion === "0",
    }))
    .sort(
      (a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name),
    );
}

async function fetchOpenAIStyleModels(
  baseURL: string,
  key: string,
): Promise<CatalogModel[]> {
  const response = await fetch(`${baseURL}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error("Model catalog request failed");

  const catalog = openAIStyleCatalogSchema.parse(await response.json());

  return catalog.data
    .map((model) => model.id)
    .filter((id) => !nonChatPattern.test(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, name: id, free: false }));
}

async function fetchAnthropicModels(key: string): Promise<CatalogModel[]> {
  const response = await fetch(
    "https://api.anthropic.com/v1/models?limit=1000",
    {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) throw new Error("Anthropic catalog request failed");

  const catalog = anthropicCatalogSchema.parse(await response.json());

  return catalog.data
    .map((model) => ({
      id: model.id,
      name: model.display_name || model.id,
      free: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchGoogleModels(key: string): Promise<CatalogModel[]> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000) },
  );

  if (!response.ok) throw new Error("Google catalog request failed");

  const catalog = googleCatalogSchema.parse(await response.json());

  return catalog.models
    .filter(
      (model) =>
        model.name.startsWith("models/gemini") &&
        model.supportedGenerationMethods?.includes("generateContent"),
    )
    .map((model) => ({
      id: model.name.replace(/^models\//, ""),
      name: model.displayName || model.name.replace(/^models\//, ""),
      free: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const openAIStyleEndpoints: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  moonshot: "https://api.moonshot.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
  xai: "https://api.x.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
};

async function fetchProviderModels(
  provider: ProviderId,
  key: string,
): Promise<CatalogModel[]> {
  if (provider === "openrouter") return fetchOpenRouterModels();

  if (provider === "nvidia") {
    const models = await fetchOpenRouterModels();

    return models.filter((model) => model.id.startsWith("nvidia/"));
  }

  if (provider === "anthropic") return fetchAnthropicModels(key);

  if (provider === "google") return fetchGoogleModels(key);

  const baseURL = openAIStyleEndpoints[provider];

  if (!baseURL || !key) throw new Error("No live catalog for this provider.");

  return fetchOpenAIStyleModels(baseURL, key);
}

export function buildModel(
  connection: z.infer<typeof connectionSchema>,
  env: Record<string, string | undefined>,
): Exclude<LanguageModel, string> {
  switch (connection.provider) {
    case "openrouter":
    case "nvidia": {
      // The environment key is reserved for free NVIDIA routes.
      const userKey = connection.apiKey.trim();
      const sharedKey = env.OPENROUTER_API_KEY?.trim() ?? "";

      const sharedRoute = usesSharedNvidiaRoute(
        connection.provider,
        connection.model,
      );

      const apiKey = userKey || (sharedRoute ? sharedKey : "");

      if (!apiKey) {
        throw new ApiError(
          400,
          sharedRoute
            ? "Shared NVIDIA access is not configured. Add your OpenRouter API key or choose Offline."
            : "This model requires your own OpenRouter API key. The shared key covers free NVIDIA models only.",
        );
      }

      if (
        connection.provider === "nvidia" &&
        !connection.model.startsWith("nvidia/")
      ) {
        throw new ApiError(
          400,
          "NVIDIA runs use nvidia/* models on OpenRouter.",
        );
      }

      return createOpenRouter({
        apiKey,
        compatibility: "strict",
        extraBody: {
          reasoning: { effort: "low", exclude: true },
        },
        headers: {
          "HTTP-Referer": env.CONCLAVE_SITE_URL || "http://localhost:4173",
          "X-Title": "Conclave",
        },
      })(connection.model);
    }

    case "anthropic":
      return createAnthropic({
        apiKey: requireKey(connection.apiKey, "Anthropic"),
      })(connection.model);
    case "openai":
      return createOpenAI({ apiKey: requireKey(connection.apiKey, "OpenAI") })(
        connection.model,
      );
    case "google":
      return createGoogleGenerativeAI({
        apiKey: requireKey(connection.apiKey, "Google"),
      })(connection.model);
    case "moonshot":
      return createMoonshotAI({
        apiKey: requireKey(connection.apiKey, "Kimi (Moonshot)"),
      })(connection.model);
    case "deepseek":
      return createDeepSeek({
        apiKey: requireKey(connection.apiKey, "DeepSeek"),
      })(connection.model);
    case "xai":
      return createXai({ apiKey: requireKey(connection.apiKey, "xAI") })(
        connection.model,
      );
    case "groq":
      return createGroq({ apiKey: requireKey(connection.apiKey, "Groq") })(
        connection.model,
      );
    case "mistral":
      return createMistral({
        apiKey: requireKey(connection.apiKey, "Mistral"),
      })(connection.model);
    case "ollama":
    case "lmstudio":
    case "custom":
      return createOpenAICompatible({
        name: connection.provider,
        baseURL: compatibleBaseURL(connection.provider, connection.baseURL),
        apiKey: connection.apiKey || undefined,
        supportsStructuredOutputs: true,
      }).chatModel(connection.model);
    default:
      throw new ApiError(400, "Choose a model provider in the model picker.");
  }
}

type ApiRequest = IncomingMessage & { body?: unknown };

type ApiHandler = (
  req: ApiRequest,
  res: ServerResponse,
) => void | Promise<void>;

const readRequestBody = async (req: ApiRequest, res: ServerResponse) => {
  let body = "";

  if (req.body !== undefined) {
    const rawBody = z.string().safeParse(req.body);
    body = rawBody.success ? rawBody.data : JSON.stringify(req.body);
  } else {
    for await (const chunk of req) {
      if (body.length <= 131_072) body += chunk;
    }
  }

  if (body.length > 131_072) {
    json(res, 413, JSON.stringify({ error: "Request is too large." }));

    return null;
  }

  return body;
};

export const createApiHandler = (
  getEnv: () => Record<string, string | undefined> = () => process.env,
) => {
  const loadCatalog = createModelsDevCatalog();
  let modelCatalog: { expiresAt: number; models: CatalogModel[] } | null = null;

  const routes = new Map<string, ApiHandler>();

  const register = (path: string, handler: ApiHandler) =>
    routes.set(path, handler);

  register("/api/availability", (req, res) => {
    if (req.method !== "GET")
      return json(res, 405, JSON.stringify({ error: "Method not allowed." }));
    const env = getEnv();

    return json(
      res,
      200,
      JSON.stringify({
        sharedOpenRouter: Boolean(env.OPENROUTER_API_KEY?.trim()),
      }),
    );
  });

  register("/api/catalog", async (req, res) => {
    if (req.method !== "GET")
      return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

    try {
      const catalogs = await loadCatalog();

      return json(res, 200, JSON.stringify({ catalogs, source: "models.dev" }));
    } catch {
      return json(
        res,
        503,
        JSON.stringify({
          error: "Models.dev catalog unavailable. Try again shortly.",
        }),
      );
    }
  });

  register("/api/models", async (req, res) => {
    if (req.method !== "GET")
      return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      const providerId = url.searchParams.get("provider") ?? "openrouter";

      if (!Object.prototype.hasOwnProperty.call(providerMeta, providerId))
        return json(res, 400, JSON.stringify({ error: "Unknown provider." }));
      const provider = parseProvider(providerId);

      const keyHeader = req.headers["x-conclave-key"];

      const key =
        (Array.isArray(keyHeader) ? keyHeader[0] : keyHeader)?.trim() ?? "";

      if (
        (provider === "openrouter" || provider === "nvidia") &&
        !key &&
        modelCatalog &&
        modelCatalog.expiresAt > Date.now()
      ) {
        const cached =
          provider === "nvidia"
            ? modelCatalog.models.filter((model) =>
                model.id.startsWith("nvidia/"),
              )
            : modelCatalog.models;

        if (cached.length) {
          return json(
            res,
            200,
            JSON.stringify({ models: cached, source: "live" }),
          );
        }
      }

      try {
        const models = await fetchProviderModels(provider, key);

        if (!models.length) throw new Error("Empty catalog");

        if (provider === "openrouter" && !key) {
          modelCatalog = { expiresAt: Date.now() + 5 * 60_000, models };
        }

        return json(res, 200, JSON.stringify({ models, source: "live" }));
      } catch {
        return json(
          res,
          200,
          JSON.stringify({
            models: popularModels(provider),
            source: "fallback",
          }),
        );
      }
    } catch {
      return json(res, 400, JSON.stringify({ error: "Unknown provider." }));
    }
  });

  register("/api/discuss", async (req, res) => {
    if (req.method !== "POST")
      return json(res, 405, JSON.stringify({ error: "Method not allowed." }));
    const body = await readRequestBody(req, res);

    if (body === null) return;
    const runId = randomUUID();
    res.setHeader("X-Conclave-Run-ID", runId);
    let secrets: string[] = [];

    try {
      const parsed = z
        .object({
          brief: z.string().max(4000),
          memo: resultSchema,
          messages: z.array(discussionMessageSchema).min(1).max(40),
          connection: connectionSchema,
        })
        .safeParse(JSON.parse(body));

      if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user")
        return json(
          res,
          400,
          JSON.stringify({
            error:
              "Add a message of up to 4,000 characters to discuss this decision.",
          }),
        );
      const { brief, memo, messages, connection } = parsed.data;

      if (connection.provider === "demo")
        return json(
          res,
          400,
          JSON.stringify({
            error:
              "Choose a live model for replies. Offline previews support notes only.",
          }),
        );
      const env = getEnv();
      secrets = [connection.apiKey, env.OPENROUTER_API_KEY ?? ""];
      const model = buildModel(connection, env);

      if (req.headers.accept?.includes("application/x-ndjson")) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        res.on("close", abort);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");

        const send = (event: DiscussionEvent) => {
          if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
        };

        try {
          await discussDecision(
            model, brief, memo, messages,
            (text) => send({ type: "delta", text }),
            controller.signal,
          );
          send({ type: "done" });
        } catch (cause) {
          if (!controller.signal.aborted) {
            const reason = describeRunError(cause, secrets);
            console.error("[Conclave discussion failed]", { runId, reason });
            send({ type: "error", error: `${reason} Run ID: ${runId}` });
          }
        } finally {
          res.off("close", abort);
          res.end();
        }

        return;
      }

      const text = await discussDecision(model, brief, memo, messages);

      return json(res, 200, JSON.stringify({ text }));
    } catch (cause) {
      if (cause instanceof SyntaxError)
        return json(
          res,
          400,
          JSON.stringify({ error: "The request was not valid JSON." }),
        );

      if (cause instanceof ApiError)
        return json(
          res,
          cause.status,
          JSON.stringify({ error: cause.message }),
        );
      const reason = describeRunError(cause, secrets);
      console.error("[Conclave discussion failed]", { runId, reason });

      return json(
        res,
        502,
        JSON.stringify({ error: `${reason} Run ID: ${runId}` }),
      );
    }
  });

  register("/api/run", async (req, res) => {
    if (req.method !== "POST")
      return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

    const body = await readRequestBody(req, res);

    if (body === null) return;

    try {
      const parsed = requestSchema.safeParse(JSON.parse(body));

      if (body.length > 16_384 && (!parsed.success || !parsed.data.revision))
        return json(
          res,
          413,
          JSON.stringify({ error: "Request is too large." }),
        );

      if (!parsed.success) {
        return json(
          res,
          400,
          JSON.stringify({ error: "Brief must be 20–4,000 characters." }),
        );
      }

      const { brief, connection, revision } = parsed.data;

      if (!connection || connection.provider === "demo") {
        return json(
          res,
          200,
          JSON.stringify({ ...buildDemoRun(brief), mode: "local" }),
        );
      }

      if (!connection.model.trim()) {
        return json(
          res,
          400,
          JSON.stringify({ error: "Choose a model in the model picker." }),
        );
      }

      if (
        (connection.provider === "ollama" ||
          connection.provider === "lmstudio" ||
          connection.provider === "custom") &&
        !connection.baseURL.trim()
      ) {
        return json(
          res,
          400,
          JSON.stringify({ error: "A local API endpoint is required." }),
        );
      }

      const env = getEnv();
      const model = buildModel(connection, env);
      const runId = randomUUID();
      res.setHeader("X-Conclave-Run-ID", runId);
      const secrets = [connection.apiKey, env.OPENROUTER_API_KEY ?? ""];
      const safeModel = redactSecrets(connection.model, secrets);
      let stage = "perspectives";

      const failureMessage = (cause: unknown) => {
        const reason = describeRunError(cause, secrets);

        const message = `${providerMeta[connection.provider].name} / ${safeModel} failed during ${stage === "chair" ? "Chair synthesis" : "assessments"}: ${reason} Run ID: ${runId}`;
        console.error("[Conclave run failed]", {
          runId,
          provider: connection.provider,
          model: safeModel,
          stage,
          reason,
          errorType: cause instanceof Error ? cause.name : "UnknownError",
        });

        return message;
      };

      if (req.headers.accept?.includes("application/x-ndjson")) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");

        const send = (event: CouncilEvent) => {
          if (event.type === "stage") stage = event.stage;

          if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
        };

        try {
          const council = await runModelCouncil(model, brief, send, revision);
          send({ type: "result", result: council });
        } catch (cause) {
          send({ type: "error", error: failureMessage(cause) });
        }

        res.end();

        return;
      }

      let council;

      try {
        council = await runModelCouncil(
          model,
          brief,
          (event) => {
            if (event.type === "stage") stage = event.stage;
          },
          revision,
        );
      } catch (cause) {
        return json(res, 502, JSON.stringify({ error: failureMessage(cause) }));
      }

      return json(res, 200, JSON.stringify(council));
    } catch (cause) {
      if (cause instanceof ApiError) {
        return json(
          res,
          cause.status,
          JSON.stringify({ error: cause.message }),
        );
      }

      const message =
        cause instanceof SyntaxError
          ? "The request was not valid JSON."
          : "The model request failed. Check the endpoint, model, and key.";

      return json(
        res,
        cause instanceof SyntaxError ? 400 : 500,
        JSON.stringify({ error: message }),
      );
    }
  });

  return async (req: ApiRequest, res: ServerResponse) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const handler = routes.get(path);

    if (!handler)
      return json(res, 404, JSON.stringify({ error: "Unknown API route." }));
    await handler(req, res);
  };
};

export const apiPlugin = (getEnv: () => Record<string, string | undefined>) => {
  const handler = createApiHandler(getEnv);

  const attach = (
    server: Pick<import("vite").ViteDevServer, "middlewares">,
  ) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();
      void handler(req, res).catch(next);
    });
  };

  return {
    name: "conclave-api",
    configureServer: attach,
    configurePreviewServer: attach,
  } satisfies import("vite").Plugin;
};
