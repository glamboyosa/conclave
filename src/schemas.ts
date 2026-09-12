import { z } from "zod";

export const resultSchema = z.object({
  title: z.string(),
  verdict: z.string(),
  confidence: z.number().min(0).max(100),
  agents: z.array(
    z.object({
      id: z.enum(["optimist", "analyst", "skeptic"]),
      thesis: z.string(),
      detail: z.string(),
      signal: z.string(),
      score: z.number(),
    }),
  ),
  tensions: z.array(z.string()),
  actions: z.array(z.string()),
  assumptions: z.array(z.string()),
  mode: z.enum(["local", "live"]).optional(),
  execution: z.object({ provider: z.string(), model: z.string() }).optional(),
});

export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stage"),
    stage: z.enum(["perspectives", "chair"]),
  }),
  z.object({
    type: z.literal("perspective"),
    id: z.enum(["optimist", "analyst", "skeptic"]),
  }),
  z.object({ type: z.literal("result"), result: resultSchema }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
