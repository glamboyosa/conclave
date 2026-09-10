import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildDemoRun, type RunResult } from "./src/engine.js";
import path from "node:path";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    verdict: { type: "string" },
    confidence: { type: "number" },
    agents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", enum: ["optimist", "analyst", "skeptic"] },
          thesis: { type: "string" },
          detail: { type: "string" },
          signal: { type: "string" },
          score: { type: "number" },
        },
        required: ["id", "thesis", "detail", "signal", "score"],
      },
    },
    tensions: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "verdict",
    "confidence",
    "agents",
    "tensions",
    "actions",
    "assumptions",
  ],
};

function apiPlugin(): Plugin {
  return {
    name: "conclave-api",
    configureServer(server) {
      server.middlewares.use("/api/run", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;

          return res.end("Method not allowed");
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        await new Promise((resolve) => req.on("end", resolve));

        try {
          const parsed: { brief?: string } = JSON.parse(body);
          const brief = parsed.brief;

          if (!brief || brief.trim().length < 20 || brief.length > 4000) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");

            return res.end(
              JSON.stringify({ error: "Brief must be 20–4,000 characters." }),
            );
          }

          const env = loadEnv("development", process.cwd(), "");

          if (!env.OPENAI_API_KEY) {
            const demo: RunResult = buildDemoRun(brief);
            res.setHeader("Content-Type", "application/json");

            return res.end(JSON.stringify({ ...demo, mode: "local" }));
          }

          const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: env.OPENAI_MODEL || "gpt-5-mini",
              store: false,
              instructions:
                "You are the chair of a private decision council. Return concise, specific analysis. Three agents must disagree productively. Scores and confidence are integers 0-100. Never claim web research or facts not supplied.",
              input: brief,
              text: {
                format: {
                  type: "json_schema",
                  name: "decision_council",
                  strict: true,
                  schema,
                },
              },
            }),
          });

          if (!response.ok)
            throw new Error(`OpenAI request failed (${response.status})`);

          const payload: {
            output_text?: string;
            output?: Array<{
              content?: Array<{ type?: string; text?: string }>;
            }>;
          } = await response.json();

          const outputText =
            payload.output_text ??
            payload.output
              ?.flatMap((item) => item.content ?? [])
              .find((item) => item.type === "output_text")?.text;

          if (!outputText)
            throw new Error("The model returned no structured output.");
          res.setHeader("Content-Type", "application/json");

          return res.end(
            JSON.stringify({ ...JSON.parse(outputText), mode: "live" }),
          );
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Run failed.",
            }),
          );
        }
      });
    },
  };
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
