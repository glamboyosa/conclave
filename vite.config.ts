import path from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { generateText, Output } from "ai";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { z } from "zod";
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

const runSchema = z.object({
  title: z.string(),
  verdict: z.string(),
  confidence: z.number().int().min(0).max(100),
  agents: z.array(z.object({
    id: z.enum(["optimist", "analyst", "skeptic"]),
    thesis: z.string(),
    detail: z.string(),
    signal: z.string(),
    score: z.number().int().min(0).max(100),
  })).length(3),
  tensions: z.array(z.string()),
  actions: z.array(z.string()),
  assumptions: z.array(z.string()),
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
  return {
    name: "conclave-api",
    configureServer(server: import("vite").ViteDevServer) {
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

          const { output } = await generateText({
            model,
            output: Output.object({ schema: runSchema }),
            system: "You chair a private decision council. Write concise, specific analysis. The optimist, analyst, and skeptic must disagree productively. Use only facts in the brief. Do not imply web research. Return integer scores from 0 to 100.",
            prompt: brief,
          });

          return json(res, 200, JSON.stringify({ ...output, mode: "live" }));
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
