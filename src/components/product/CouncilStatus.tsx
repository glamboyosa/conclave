import { Check, LoaderCircle } from "lucide-react";

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
    <details>
      <summary>Decision brief</summary>
      <p>{brief}</p>
    </details>
  </section>
);
