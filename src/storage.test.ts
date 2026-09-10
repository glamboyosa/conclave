import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoRun } from "./engine";
import { decisionMarkdown, loadDecisionLibrary, saveDecision } from "./storage";

beforeEach(() => localStorage.clear());

describe("decision library", () => {
  it("saves decisions locally and exports a complete Markdown transcript", () => {
    const brief = "Should we run a small reversible pilot before committing the team?";
    const record = saveDecision(brief, buildDemoRun(brief));
    const markdown = decisionMarkdown(record);

    expect(loadDecisionLibrary()).toHaveLength(1);
    expect(markdown).toContain("## Decision brief");
    expect(markdown).toContain(brief);
    expect(markdown).toContain("### optimist");
    expect(markdown).toContain("## Assumptions");
  });
});

