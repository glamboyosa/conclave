import path from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { z } from "zod";
import { runModelCouncil } from "./src/council.js";
import { buildDemoRun } from "./src/engine.js";

const connectionSchema = z.object({
  provider: z.enum(["demo", "openrouter", "nvidia", "openai", "ollama", "lmstudio", "custom"]),
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

function json(res: import("node:http").ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(body);
}

function compatibleBaseURL(provider: string, requestedURL: string) {
  if (provider === "openai") return "https://api.openai.com/v1";

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

function apiPlugin() {
  let modelCatalog: { expiresAt: number; models: Array<{ id: string; name: string; free: boolean }> } | null = null;

  return {
    name: "conclave-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/models", async (req, res) => {
        if (req.method !== "GET") return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

        try {
          if (modelCatalog && modelCatalog.expiresAt > Date.now()) {
            return json(res, 200, JSON.stringify({ models: modelCatalog.models }));
          }

          const response = await fetch("https://openrouter.ai/api/v1/models", {
            signal: AbortSignal.timeout(10_000),
          });

          if (!response.ok) throw new Error("OpenRouter catalog request failed");

          const catalog = catalogSchema.parse(await response.json());

          const models = catalog.data
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

          modelCatalog = { expiresAt: Date.now() + 5 * 60_000, models };

          return json(res, 200, JSON.stringify({ models }));
        } catch {
          return json(res, 502, JSON.stringify({ error: "The OpenRouter model catalog is unavailable." }));
        }
      });

      server.middlewares.use("/api/run", async (req, res) => {
        if (req.method !== "POST") return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        await new Promise((resolve) => req.on("end", resolve));

        try {
          const parsed = requestSchema.safeParse(JSON.parse(body));

          if (!parsed.success) {
            return json(res, 400, JSON.stringify({ error: "Brief must be 20–4,000 characters." }));
          }

          const { brief, connection } = parsed.data;

          if (!connection || connection.provider === "demo") {
            return json(res, 200, JSON.stringify({ ...buildDemoRun(brief), mode: "local" }));
          }

          if (!connection.model || !connection.baseURL) {
            return json(res, 400, JSON.stringify({ error: "Model and API endpoint are required." }));
          }

          const env = loadEnv("development", process.cwd(), "");

          if (connection.provider === "openrouter" && !connection.apiKey && !env.OPENROUTER_API_KEY) {
            return json(res, 400, JSON.stringify({ error: "OpenRouter needs a key in Settings or .env.local." }));
          }

          if ((connection.provider === "openai" || connection.provider === "nvidia") && !connection.apiKey) {
            return json(res, 400, JSON.stringify({ error: "This provider requires an API key." }));
          }

          const model = connection.provider === "openrouter"
              ? createOpenRouter({
                  apiKey: connection.apiKey || env.OPENROUTER_API_KEY,
                  compatibility: "strict",
                  extraBody: {
                    reasoning: { effort: "low", exclude: true },
                  },
                headers: {
                  "HTTP-Referer": env.CONCLAVE_SITE_URL || "http://localhost:4173",
                  "X-Title": "Conclave",
                },
              })(connection.model)
            : createOpenAICompatible({
                name: connection.provider,
                baseURL: compatibleBaseURL(connection.provider, connection.baseURL),
                apiKey: connection.apiKey || undefined,
                supportsStructuredOutputs: true,
              }).chatModel(connection.model);

          const council = await runModelCouncil(model, brief);

          return json(res, 200, JSON.stringify(council));
        } catch (cause) {
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
