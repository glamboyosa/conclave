import { Check, LoaderCircle } from "lucide-react";

import { DiscussionPending } from "./DiscussionPending";

type Props = {
  stage: string;
  completed: string[];
  offline: boolean;
  brief: string;
};

export const CouncilStatus = ({ stage, completed, offline, brief }: Props) => (
  <section className="council-running" aria-live="polite">
    <h2>
      {offline
        ? "Preparing preview…"
        : stage === "chair"
          ? "Writing recommendation…"
          : "Reviewing your decision…"}
    </h2>
    <div className="execution-list">
      {[
        ["optimist", "Opportunity"],
        ["analyst", "Evidence"],
        ["skeptic", "Risk"],
        ["chair", "Chair synthesis"],
      ].map(([id, label]) => {
        const done = completed.includes(id);

        const running =
          !offline &&
          !done &&
          (id === "chair" ? stage === "chair" : stage === "perspectives");

        return (
          <div key={id} className={running ? "executing" : ""}>
            {done ? (
              <Check size={18} />
            ) : running ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <span className="waiting-dot" />
            )}
            <strong>{label}</strong>
            <span>
              {offline
                ? "Preview"
                : done
                  ? "Complete"
                  : running
                    ? id === "chair"
                      ? "Synthesizing"
                      : "Analyzing"
                    : "Pending"}
            </span>
          </div>
        );
      })}
    </div>
    {!offline && (
      <DiscussionPending
        key={stage}
        messages={stage === "chair" ? [
          "The Chair is reviewing the assessments…",
          "Waiting for the recommendation…",
          "The saved memo will appear when complete…",
          "The model is still processing the assessments…",
        ] : [
          "Opportunity, evidence and risk assessments are running…",
          "Waiting for the independent assessments…",
          "Completed assessments appear above…",
          "The models are still processing your brief…",
        ]}
      />
    )}
    <details>
      <summary>Decision brief</summary>
      <p>{brief}</p>
    </details>
  </section>
);
