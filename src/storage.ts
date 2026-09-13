import { z } from "zod";
import { discussionMessageSchema, resultSchema } from "./schemas";
import type { DiscussionMessage, RunResult } from "./engine";

export type DecisionRecord = {
  id: string;
  createdAt: string;
  brief: string;
  result: RunResult;
  discussion?: DiscussionMessage[];
  parentId?: string;
};

const libraryKey = "conclave:library";

export function loadDecisionLibrary(): DecisionRecord[] {
  const saved = localStorage.getItem(libraryKey);

  if (!saved) return [];

  try {
    const records = JSON.parse(saved);

    if (!Array.isArray(records)) throw new Error("Invalid decision library.");

    return z
      .array(
        z.object({
          id: z.string(),
          createdAt: z.string(),
          brief: z.string(),
          result: resultSchema,
          discussion: z.array(discussionMessageSchema).max(40).optional(),
          parentId: z.string().optional(),
        }),
      )
      .parse(records);
  } catch {
    localStorage.removeItem(libraryKey);

    return [];
  }
}

export function saveDecision(
  brief: string,
  result: RunResult,
  parentId?: string,
): DecisionRecord {
  const createdAt = new Date().toISOString();

  const record = {
    id: crypto.randomUUID(),
    createdAt,
    brief,
    result: resultSchema.parse(result),
    parentId,
  };

  const records = [record, ...loadDecisionLibrary()].slice(0, 50);

  localStorage.setItem(libraryKey, JSON.stringify(records));

  return record;
}

export const saveDiscussion = (id: string, discussion: DiscussionMessage[]) => {
  const messages = z.array(discussionMessageSchema).max(40).parse(discussion);

  const records = loadDecisionLibrary().map((record) =>
    record.id === id ? { ...record, discussion: messages } : record,
  );

  localStorage.setItem(libraryKey, JSON.stringify(records));

  return records;
};

export const deleteDecision = (id: string) => {
  const records = loadDecisionLibrary()
    .filter((record) => record.id !== id)
    .map((record) => {
      if (record.parentId !== id) return record;
      const revision = { ...record };
      delete revision.parentId;

      return revision;
    });

  localStorage.setItem(libraryKey, JSON.stringify(records));

  return records;
};

export const restoreDecision = (
  record: DecisionRecord,
  index: number,
  revisionIds: string[],
) => {
  const records = loadDecisionLibrary().map((saved) =>
    revisionIds.includes(saved.id) && !saved.parentId
      ? { ...saved, parentId: record.id }
      : saved,
  );

  if (!records.some((saved) => saved.id === record.id)) {
    const restored = { ...record };

    if (restored.parentId && !records.some((saved) => saved.id === restored.parentId))
      delete restored.parentId;
    records.splice(index, 0, restored);
  }

  localStorage.setItem(libraryKey, JSON.stringify(records));

  return records;
};

export function decisionMarkdown(record: DecisionRecord) {
  const positions = record.result.agents
    .map(
      (agent) =>
        `### ${agent.id}\n\n**${agent.signal} · ${agent.score}/100**\n\n${agent.thesis}\n\n${agent.detail}`,
    )
    .join("\n\n");

  const list = (values: string[]) =>
    values.map((value) => `- ${value}`).join("\n");

  const discussion = record.discussion?.length
    ? `\n## Discussion\n\n${record.discussion.map((message) => `### ${message.role === "user" ? "You" : "Chair"}\n\n${message.content}`).join("\n\n")}\n`
    : "";

  return `# ${record.result.title}\n\nCreated: ${record.createdAt}\nModel mode: ${record.result.mode}${record.result.execution ? `\nProvider: ${record.result.execution.provider}\nModel: ${record.result.execution.model}` : ""}\n\n## Decision brief\n\n${record.brief}\n\n## Chair's call\n\n${record.result.verdict}\n\nConfidence: ${record.result.confidence}/100\n\n## Independent positions\n\n${positions}\n\n## Productive tensions\n\n${list(record.result.tensions)}\n\n## Next moves\n\n${list(record.result.actions)}\n\n## Assumptions\n\n${list(record.result.assumptions)}\n${discussion}`;
}
