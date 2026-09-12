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
  execution?: { provider: string; model: string };
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
    verdict:
      "Try a small pilot before committing more time or money. Agree on a success measure and a stop condition before starting.",
    confidence,
    agents: [
      {
        id: "optimist",
        thesis: "A small test could answer the main question",
        detail: `Test the part of the proposal you are least sure about. Keep the test small enough to stop if the results are poor.`,
        signal: "Upside case",
        score: 82,
      },
      {
        id: "analyst",
        thesis: market
          ? "Define how much demand would justify continuing"
          : "Define what success would look like",
        detail: `Choose a result you can measure, set a target, and review it on a specific date. Include the cost of running the test.`,
        signal: "Evidence gap",
        score: 64,
      },
      {
        id: "skeptic",
        thesis: urgency
          ? "A deadline could rush the commitment"
          : "Check who will maintain the work",
        detail: `Name who owns the test and who will handle the ongoing work. Set a budget limit and a way to exit before starting.`,
        signal: "Primary risk",
        score: 71,
      },
    ],
    tensions: [
      "A quick test may give users an unfinished experience",
      "Running the pilot takes time away from existing work",
    ],
    actions: [
      "Name one owner and one decision date",
      "Set a success target and a stop condition",
      "Test with 5 real users before expanding scope",
    ],
    assumptions: [
      "A pilot can be made reversible",
      "A decision-maker is available at the review date",
      "The test can produce useful feedback before the review date",
    ],
    mode: "local",
  };
}

export type CouncilEvent =
  | { type: "stage"; stage: "perspectives" | "chair" }
  | { type: "perspective"; id: AgentId }
  | { type: "result"; result: RunResult }
  | { type: "error"; error: string };

export type DiscussionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RevisionContext = {
  memo: RunResult;
  messages: DiscussionMessage[];
};
