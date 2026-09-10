export type AgentId = "optimist" | "analyst" | "skeptic";

export type AgentFinding = {
  id: AgentId;
  thesis: string;
  detail: string;
  signal: string;
  score: number;
};

export type RunResult = {
  title: string;
  verdict: string;
  confidence: number;
  agents: AgentFinding[];
  tensions: string[];
  actions: string[];
  assumptions: string[];
  mode?: "local" | "live";
};

const firstSentence = (brief: string) =>
  brief
    .trim()
    .split(/[.!?\n]/)[0]
    .replace(
      /^(we|i)\s+(want|need|are considering|am considering)\s+to?\s*/i,
      "",
    )
    .trim();

export function buildDemoRun(brief: string): RunResult {
  const subject = firstSentence(brief) || "the proposed move";
  const lower = brief.toLowerCase();
  const urgency = /week|month|deadline|urgent|launch/.test(lower);
  const market = /customer|market|user|sell|revenue|price/.test(lower);

  const confidence = Math.min(
    84,
    68 + (brief.length > 180 ? 8 : 0) + (market ? 4 : 0),
  );

  return {
    title: subject.length > 68 ? `${subject.slice(0, 65)}…` : subject,
    verdict: `Run a narrow, reversible pilot before committing fully to ${subject.toLowerCase()}. Define the stop condition now; let observed behavior—not enthusiasm—earn the next investment.`,
    confidence,
    agents: [
      {
        id: "optimist",
        thesis: "There is enough signal to test now",
        detail: `The brief points to a concrete change with learnable demand. A deliberately small version can turn the biggest unknown into evidence without waiting for perfect certainty.`,
        signal: "Upside case",
        score: 82,
      },
      {
        id: "analyst",
        thesis: market
          ? "The decision lacks a measurable demand threshold"
          : "The success condition is underspecified",
        detail: `The proposal names an ambition but not the number that would justify continuing. Cost, adoption, and time-to-value need one shared scorecard.`,
        signal: "Evidence gap",
        score: 64,
      },
      {
        id: "skeptic",
        thesis: urgency
          ? "Urgency may be disguising an irreversible bet"
          : "The hidden cost is operational drag",
        detail: `The likely failure mode is not that the idea cannot work; it is that ownership, maintenance, and exit criteria remain implicit until after commitment.`,
        signal: "Primary risk",
        score: 71,
      },
    ],
    tensions: [
      "Speed to learning vs. quality of the first impression",
      "Strategic optionality vs. operational focus",
    ],
    actions: [
      "Name one owner and one decision date",
      "Define a success metric and a kill metric",
      "Test with 5 real users before expanding scope",
    ],
    assumptions: [
      "A pilot can be made reversible",
      "A decision-maker is available at the review date",
      "Useful feedback can be observed within one cycle",
    ],
    mode: "local",
  };
}
