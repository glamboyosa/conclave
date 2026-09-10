import { describe, expect, it } from "vitest";
import { buildDemoRun } from "./engine";

describe("local council engine", () => {
  it("turns a brief into three distinct positions and an action memo", () => {
    const result = buildDemoRun(
      "We need to launch a paid customer research product within six weeks.",
    );

    expect(result.agents.map((a) => a.id)).toEqual([
      "optimist",
      "analyst",
      "skeptic",
    ]);
    expect(result.actions).toHaveLength(3);
    expect(result.verdict).toContain("pilot");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
  it("creates a readable title from first sentence", () => {
    expect(
      buildDemoRun("We want to open a studio. It costs a lot.").title,
    ).toBe("open a studio");
  });
});
