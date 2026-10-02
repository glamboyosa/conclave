import { createHash } from "node:crypto";
import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
otel.start();

const datasetName = "conclave/decision-briefs-v1";
const cases = [
  {
    id: "unverified-demand",
    brief:
      "Test Team 130 wants to spend $40,000 building a scheduling product. Two colleagues like the idea, but no prospective customer has been interviewed and no budget owner has approved it. Should the team commit to a full launch next month?",
    maxConfidence: 75,
  },
  {
    id: "deadline-pressure",
    brief:
      "Test Studio 130 has seven days to decide whether to sign a one-year software contract. The vendor offers a discount that expires Friday. The team has not tested the integration or calculated migration costs. Should it sign now?",
    maxConfidence: 75,
  },
  {
    id: "missing-baseline",
    brief:
      "Test Service 130 plans to replace its current support workflow with an AI assistant. There is no baseline for resolution time or error rate, and no policy for handling sensitive requests. Should it roll out to every customer immediately?",
    maxConfidence: 75,
  },
];

const stableId = (id) => {
  const hash = createHash("sha256")
    .update(`${datasetName}:${id}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

const langfuse = new LangfuseClient();

try {
  await langfuse.api.datasets.create({
    name: datasetName,
    description:
      "Synthetic, underspecified decision briefs for council regression checks.",
  });

  for (const item of cases) {
    await langfuse.dataset.createItem({
      id: stableId(item.id),
      datasetName,
      input: { brief: item.brief },
      expectedOutput: { maxConfidence: item.maxConfidence },
      metadata: { caseId: item.id, source: "synthetic" },
    });
  }

  const dataset = await langfuse.dataset.get(datasetName);
  const result = await dataset.runExperiment({
    name: `conclave-council-${process.env.CONCLAVE_EVAL_MODEL || "openai/gpt-4o-mini"}`,
    description:
      "Synthetic council regression run. Scores are structural and calibration checks; review recommendation quality manually.",
    task: async ({ input }) => {
      const response = await fetch(
        `${process.env.CONCLAVE_EVAL_BASE_URL || "http://127.0.0.1:4173"}/api/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: input.brief,
            connection: {
              provider: "openrouter",
              model: process.env.CONCLAVE_EVAL_MODEL || "openai/gpt-4o-mini",
              apiKey: process.env.OPENROUTER_API_KEY,
              baseURL: "",
            },
          }),
        },
      );
      if (!response.ok)
        throw new Error(`Council request failed (${response.status})`);
      return response.json();
    },
    evaluators: [
      async ({ output }) => ({
        name: "conclave.memo_complete",
        value: Number(
          typeof output.verdict === "string" &&
            output.verdict.trim().length > 0 &&
            output.actions?.length === 3 &&
            output.tensions?.length >= 2 &&
            output.assumptions?.length >= 2 &&
            output.mode === "live",
        ),
      }),
      async ({ output }) => ({
        name: "conclave.role_coverage",
        value: Number(
          ["optimist", "analyst", "skeptic"].every((role) =>
            output.agents?.some(
              (agent) =>
                agent.id === role &&
                agent.thesis?.trim() &&
                agent.detail?.trim(),
            ),
          ),
        ),
      }),
      async ({ output, expectedOutput }) => ({
        name: "conclave.uncertainty_calibration",
        value: Number(
          Number.isInteger(output.confidence) &&
            output.confidence >= 0 &&
            output.confidence <= expectedOutput.maxConfidence,
        ),
      }),
    ],
  });

  console.log(await result.format());
} finally {
  await langfuse.flush();
  await otel.shutdown();
}
