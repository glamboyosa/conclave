import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoRun } from "./engine";
import {
  decisionMarkdown,
  deleteDecision,
  restoreDecision,
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

it("deletes a memo and discussion while preserving and detaching its revisions", () => {
  const brief = "Should our test team run a bounded pilot?";
  const original = saveDecision(brief, buildDemoRun(brief));
  saveDiscussion(original.id, [{ role: "user", content: "New context." }]);
  const revision = saveDecision(brief, original.result, original.id);
  const other = saveDecision("An unrelated test decision", original.result);
  const records = deleteDecision(original.id);

  expect(records.map((record) => record.id)).toEqual([other.id, revision.id]);
  expect(records[1].parentId).toBeUndefined();
  expect(records[1].result).toEqual(revision.result);
  expect(loadDecisionLibrary()).toEqual(records);
  expect(localStorage.getItem("conclave:library")).not.toContain("New context.");
  expect(deleteDecision(revision.id)).toHaveLength(1);
  expect(deleteDecision(other.id)).toEqual([]);
  expect(loadDecisionLibrary()).toEqual([]);
});

it("undo restores a deleted memo and revision links without overwriting newer records", () => {
  const brief = "Should our test team run a bounded pilot?";
  const original = saveDecision(brief, buildDemoRun(brief));
  saveDiscussion(original.id, [{ role: "user", content: "Saved test context." }]);
  const revision = saveDecision(brief, original.result, original.id);
  const deleted = loadDecisionLibrary()[1];
  deleteDecision(original.id);
  const newer = saveDecision("A newer test decision", original.result);
  saveDiscussion(revision.id, [{ role: "user", content: "New revision context." }]);
  const records = restoreDecision(deleted, 1, [revision.id]);

  expect(records.find((saved) => saved.id === original.id)).toEqual(deleted);
  expect(records.find((saved) => saved.id === revision.id)?.parentId).toBe(original.id);
  expect(records.find((saved) => saved.id === revision.id)?.discussion?.[0].content).toBe("New revision context.");
  expect(records.some((saved) => saved.id === newer.id)).toBe(true);
  expect(loadDecisionLibrary()).toEqual(records);
});
