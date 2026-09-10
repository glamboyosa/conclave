import path from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { generateText, Output } from "ai";
import { defineConfig } from "vitest/config";
import { z } from "zod";
import { buildDemoRun } from "./src/engine.js";

const connectionSchema = z.object({
  provider: z.enum(["demo", "nvidia", "openai", "ollama", "lmstudio", "custom"]),
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

          if ((connection.provider === "openai" || connection.provider === "nvidia") && !connection.apiKey) {
            return json(res, 400, JSON.stringify({ error: "This provider requires an API key." }));
          }

          const provider = createOpenAICompatible({
            name: connection.provider,
            baseURL: connection.baseURL.replace(/\/$/, ""),
            apiKey: connection.apiKey || undefined,
            supportsStructuredOutputs: true,
          });

          const { output } = await generateText({
            model: provider.chatModel(connection.model),
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
