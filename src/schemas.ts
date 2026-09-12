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

export const discussionMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(4000),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(12000),
  }),
]);

export const revisionContextSchema = z.object({
  memo: resultSchema,
  messages: z.array(discussionMessageSchema).min(1).max(40),
});
