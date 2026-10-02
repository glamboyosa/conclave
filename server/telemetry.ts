import { registerTelemetry } from "ai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";

// SAFETY: This module alone writes the reload-persistent property, always with a LangfuseSpanProcessor.
const telemetryState = globalThis as typeof globalThis & {
  conclaveLangfuseProcessor?: LangfuseSpanProcessor;
};

const initialize = (env: Record<string, string | undefined>) => {
  if (
    telemetryState.conclaveLangfuseProcessor ||
    !env.LANGFUSE_PUBLIC_KEY ||
    !env.LANGFUSE_SECRET_KEY
  )
    return;

  process.env.LANGFUSE_PUBLIC_KEY = env.LANGFUSE_PUBLIC_KEY;
  process.env.LANGFUSE_SECRET_KEY = env.LANGFUSE_SECRET_KEY;
  process.env.LANGFUSE_BASE_URL =
    env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";
  const processor = new LangfuseSpanProcessor();
  new NodeSDK({ spanProcessors: [processor] }).start();
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
  telemetryState.conclaveLangfuseProcessor = processor;
};

export const traceAI = async <T>(
  env: Record<string, string | undefined>,
  name: string,
  runId: string,
  provider: string,
  model: string,
  task: () => Promise<T>,
): Promise<T> => {
  try {
    initialize(env);
  } catch {
    console.error("[Conclave tracing setup failed]", { runId });

    return task();
  }

  const processor = telemetryState.conclaveLangfuseProcessor;

  if (!processor) return task();

  try {
    return await startActiveObservation(name, async (span) => {
      span.update({ metadata: { runId, provider, model } });

      return propagateAttributes(
        { traceName: name, tags: ["conclave", name] },
        task,
      );
    });
  } finally {
    try {
      await processor.forceFlush();
    } catch {
      console.error("[Conclave tracing flush failed]", { runId });
    }
  }
};
