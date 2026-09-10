import path from "node:path";
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
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { z } from "zod";
import { runModelCouncil } from "./src/council.js";
import { buildDemoRun } from "./src/engine.js";
import { parseProvider, popularModels, type CatalogModel, type ProviderId } from "./src/providers.js";

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
});

const catalogSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    pricing: z.object({ prompt: z.string().optional(), completion: z.string().optional() }).optional(),
    supported_parameters: z.array(z.string()).optional(),
    architecture: z.object({ output_modalities: z.array(z.string()).optional() }).optional(),
  })),
});

const openAIStyleCatalogSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

const anthropicCatalogSchema = z.object({
  data: z.array(z.object({ id: z.string(), display_name: z.string().optional() })),
});

const googleCatalogSchema = z.object({
  models: z.array(z.object({
    name: z.string(),
    displayName: z.string().optional(),
    supportedGenerationMethods: z.array(z.string()).optional(),
  })),
});

/** Models that cannot hold a council conversation. */
const nonChatPattern = /embed|whisper|tts|audio|realtime|image|moderation|ocr|transcri|rerank|davinci|babbage|guard/i;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(res: import("node:http").ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(body);
}

function compatibleBaseURL(provider: string, requestedURL: string) {
  if (provider === "nvidia") return "https://integrate.api.nvidia.com/v1";

  const url = new URL(requestedURL);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";

  if (provider === "ollama" || provider === "lmstudio") {
    if (!loopback) throw new Error("Local providers must use a loopback address.");
  } else if (url.protocol !== "https:" && !loopback) {
    throw new Error("Custom endpoints must use HTTPS.");
  }

  return requestedURL.replace(/\/$/, "");
}

function requireKey(apiKey: string, providerName: string) {
  const key = apiKey.trim();

  if (!key) {
    throw new ApiError(400, `Add your ${providerName} API key in the model picker.`);
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
    .filter((model) =>
      model.architecture?.output_modalities?.includes("text") &&
      model.supported_parameters?.includes("structured_outputs"),
    )
    .map((model) => ({
      id: model.id,
      name: model.name || model.id,
      free: model.pricing?.prompt === "0" && model.pricing?.completion === "0",
    }))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
}

async function fetchOpenAIStyleModels(baseURL: string, key: string): Promise<CatalogModel[]> {
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
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error("Anthropic catalog request failed");

  const catalog = anthropicCatalogSchema.parse(await response.json());

  return catalog.data
    .map((model) => ({ id: model.id, name: model.display_name || model.id, free: false }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchGoogleModels(key: string): Promise<CatalogModel[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`,
    { signal: AbortSignal.timeout(10_000) },
  );

  if (!response.ok) throw new Error("Google catalog request failed");

  const catalog = googleCatalogSchema.parse(await response.json());

  return catalog.models
    .filter((model) =>
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
  nvidia: "https://integrate.api.nvidia.com/v1",
};

async function fetchProviderModels(provider: ProviderId, key: string): Promise<CatalogModel[]> {
  if (provider === "openrouter") return fetchOpenRouterModels();

  if (provider === "anthropic") return fetchAnthropicModels(key);

  if (provider === "google") return fetchGoogleModels(key);

  const baseURL = openAIStyleEndpoints[provider];

  if (!baseURL || !key) throw new Error("No live catalog for this provider.");

  return fetchOpenAIStyleModels(baseURL, key);
}

function buildModel(
  connection: z.infer<typeof connectionSchema>,
  env: Record<string, string>,
) {
  switch (connection.provider) {
    case "openrouter": {
      const userKey = connection.apiKey.trim();
      const sharedKey = env.OPENROUTER_API_KEY?.trim() ?? "";
      const apiKey = userKey || sharedKey;

      if (!apiKey) {
        throw new ApiError(
          400,
          "Add your OpenRouter API key in the model picker, or set OPENROUTER_API_KEY in .env.local.",
        );
      }

      if (!userKey && sharedKey && !connection.model.endsWith(":free")) {
        throw new ApiError(
          400,
          "The shared OpenRouter key covers free models only. Add your own OpenRouter key in the model picker to run this model.",
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
      return createAnthropic({ apiKey: requireKey(connection.apiKey, "Anthropic") })(connection.model);
    case "openai":
      return createOpenAI({ apiKey: requireKey(connection.apiKey, "OpenAI") })(connection.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: requireKey(connection.apiKey, "Google") })(connection.model);
    case "moonshot":
      return createMoonshotAI({ apiKey: requireKey(connection.apiKey, "Kimi (Moonshot)") })(connection.model);
    case "deepseek":
      return createDeepSeek({ apiKey: requireKey(connection.apiKey, "DeepSeek") })(connection.model);
    case "xai":
      return createXai({ apiKey: requireKey(connection.apiKey, "xAI") })(connection.model);
    case "groq":
      return createGroq({ apiKey: requireKey(connection.apiKey, "Groq") })(connection.model);
    case "mistral":
      return createMistral({ apiKey: requireKey(connection.apiKey, "Mistral") })(connection.model);
    case "nvidia":
      return createOpenAICompatible({
        name: "nvidia",
        baseURL: compatibleBaseURL("nvidia", connection.baseURL),
        apiKey: requireKey(connection.apiKey, "NVIDIA NIM"),
        supportsStructuredOutputs: true,
      }).chatModel(connection.model);
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

function apiPlugin() {
  let modelCatalog: { expiresAt: number; models: CatalogModel[] } | null = null;

  return {
    name: "conclave-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/models", async (req, res) => {
        if (req.method !== "GET") return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          const provider = parseProvider(url.searchParams.get("provider") ?? "openrouter");
          const keyHeader = req.headers["x-conclave-key"];
          const key = (Array.isArray(keyHeader) ? keyHeader[0] : keyHeader)?.trim() ?? "";

          if (provider === "openrouter" && !key && modelCatalog && modelCatalog.expiresAt > Date.now()) {
            return json(res, 200, JSON.stringify({ models: modelCatalog.models, source: "live" }));
          }

          try {
            const models = await fetchProviderModels(provider, key);

            if (!models.length) throw new Error("Empty catalog");

            if (provider === "openrouter" && !key) {
              modelCatalog = { expiresAt: Date.now() + 5 * 60_000, models };
            }

            return json(res, 200, JSON.stringify({ models, source: "live" }));
          } catch {
            return json(res, 200, JSON.stringify({ models: popularModels(provider), source: "fallback" }));
          }
        } catch {
          return json(res, 400, JSON.stringify({ error: "Unknown provider." }));
        }
      });

      server.middlewares.use("/api/run", async (req, res) => {
        if (req.method !== "POST") return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

        let body = "";
        let oversized = false;
        req.on("data", (chunk) => {
          body += chunk;

          if (body.length > 16_384) oversized = true;
        });
        await new Promise((resolve) => req.on("end", resolve));

        if (oversized) {
          return json(res, 413, JSON.stringify({ error: "Request is too large." }));
        }

        try {
          const parsed = requestSchema.safeParse(JSON.parse(body));

          if (!parsed.success) {
            return json(res, 400, JSON.stringify({ error: "Brief must be 20–4,000 characters." }));
          }

          const { brief, connection } = parsed.data;

          if (!connection || connection.provider === "demo") {
            return json(res, 200, JSON.stringify({ ...buildDemoRun(brief), mode: "local" }));
          }

          if (!connection.model.trim()) {
            return json(res, 400, JSON.stringify({ error: "Choose a model in the model picker." }));
          }

          if (
            (connection.provider === "ollama" ||
              connection.provider === "lmstudio" ||
              connection.provider === "custom") &&
            !connection.baseURL.trim()
          ) {
            return json(res, 400, JSON.stringify({ error: "A local API endpoint is required." }));
          }

          const env = loadEnv("development", process.cwd(), "");
          const model = buildModel(connection, env);
          const council = await runModelCouncil(model, brief);

          return json(res, 200, JSON.stringify(council));
        } catch (cause) {
          if (cause instanceof ApiError) {
            return json(res, cause.status, JSON.stringify({ error: cause.message }));
          }

          const message = cause instanceof SyntaxError
            ? "The request was not valid JSON."
            : "The model request failed. Check the endpoint, model, and key.";

          return json(res, 500, JSON.stringify({ error: message }));
        }
      });
    },
  } satisfies import("vite").Plugin;
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: { port: 4173 },
  preview: { port: 4173 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    exclude: ["tests/**", "node_modules/**"],
  },
});
