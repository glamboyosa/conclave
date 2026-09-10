import type { RunResult } from "./engine";

export type DecisionRecord = {
  id: string;
  createdAt: string;
  brief: string;
  result: RunResult;
};

const libraryKey = "conclave:library";

export function loadDecisionLibrary(): DecisionRecord[] {
  const saved = localStorage.getItem(libraryKey);

  if (!saved) return [];

  try {
    const records = JSON.parse(saved);

    if (!Array.isArray(records)) throw new Error("Invalid decision library.");

    return records;
  } catch {
    localStorage.removeItem(libraryKey);

    return [];
  }
}

export function saveDecision(brief: string, result: RunResult): DecisionRecord {
  const createdAt = new Date().toISOString();
  const record = { id: createdAt, createdAt, brief, result };
  const records = [record, ...loadDecisionLibrary()].slice(0, 50);

  localStorage.setItem(libraryKey, JSON.stringify(records));

  return record;
}

export function decisionMarkdown(record: DecisionRecord) {
  const positions = record.result.agents
    .map(
      (agent) =>
        `### ${agent.id}\n\n**${agent.signal} · ${agent.score}/100**\n\n${agent.thesis}\n\n${agent.detail}`,
    )
    .join("\n\n");

  const list = (values: string[]) => values.map((value) => `- ${value}`).join("\n");

  return `# ${record.result.title}\n\nCreated: ${record.createdAt}\nModel mode: ${record.result.mode}\n\n## Decision brief\n\n${record.brief}\n\n## Chair's call\n\n${record.result.verdict}\n\nConfidence: ${record.result.confidence}/100\n\n## Independent positions\n\n${positions}\n\n## Productive tensions\n\n${list(record.result.tensions)}\n\n## Next moves\n\n${list(record.result.actions)}\n\n## Assumptions\n\n${list(record.result.assumptions)}\n`;
}
