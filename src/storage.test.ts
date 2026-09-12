import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoRun } from "./engine";
import {
  decisionMarkdown,
  loadDecisionLibrary,
  saveDecision,
  saveDiscussion,
} from "./storage";

beforeEach(() => localStorage.clear());

describe("decision library", () => {
  it("saves decisions locally and exports a complete Markdown transcript", () => {
    const brief =
      "Should we run a small reversible pilot before committing the team?";

    const record = saveDecision(brief, buildDemoRun(brief));
    const markdown = decisionMarkdown(record);

    expect(loadDecisionLibrary()).toHaveLength(1);
    expect(markdown).toContain("## Decision brief");
    expect(markdown).toContain(brief);
    expect(markdown).toContain("### optimist");
    expect(markdown).toContain("## Assumptions");
  });
});

it("strips secret-bearing extra fields from records before saving", () => {
  const brief = "Should we pilot a new decision workflow with our test team?";

  const result = {
    ...buildDemoRun(brief),
    apiKey: "fake-test-secret",
    connection: { apiKey: "fake-test-secret" },
  };

  const record = saveDecision(brief, result);
  expect(JSON.stringify(record)).not.toContain("fake-test-secret");
  expect(localStorage.getItem("conclave:library")).not.toContain(
    "fake-test-secret",
  );
  expect(decisionMarkdown(record)).not.toContain("fake-test-secret");
});

it("keeps the original memo intact while saving discussion and a linked revision", () => {
  const brief = "Should our test team pilot a new decision workflow?";
  const original = saveDecision(brief, buildDemoRun(brief));

  const discussion = [
    { role: "user" as const, content: "The budget has dropped to £5,000." },
  ];

  saveDiscussion(original.id, discussion);

  const revision = saveDecision(
    brief,
    { ...original.result, verdict: "Reduce the pilot budget." },
    original.id,
  );

  const records = loadDecisionLibrary();
  expect(records).toHaveLength(2);
  expect(records[0].parentId).toBe(original.id);
  expect(revision.id).not.toBe(original.id);
  expect(records[1].result.verdict).toBe(original.result.verdict);
  expect(records[1].discussion).toEqual(discussion);
  expect(decisionMarkdown(records[1])).toContain(
    "The budget has dropped to £5,000.",
  );
});
