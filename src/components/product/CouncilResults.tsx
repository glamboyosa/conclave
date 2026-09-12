import { useState } from "react";
import { Check, ChevronRight, Copy, Download, Plus } from "lucide-react";
import type { AgentFinding, AgentId, RunResult } from "../../engine";
import { parseProvider, providerName } from "../../providers";
import { decisionMarkdown } from "../../storage";
import { Button } from "../ui/button";

const agentMeta: Record<AgentId, { name: string; role: string }> = {
  optimist: { name: "Mara", role: "Opportunity" },
  analyst: { name: "Ivo", role: "Evidence" },
  skeptic: { name: "Sana", role: "Risk" },
};

const PerspectiveResult = ({ finding }: { finding: AgentFinding }) => {
  const meta = agentMeta[finding.id];

  return (
    <article
      className={`agent-card agent-${finding.id}`}
      data-testid={`agent-${finding.id}`}
    >
      <div className="agent-head">
        <div>
          <strong>{meta.role}</strong>
          <small>{meta.name}</small>
        </div>
        <span className="score" title="Self-assessed support from the brief">
          {finding.score}/100
        </span>
      </div>
      <span className="signal">{finding.signal}</span>
      <h3>{finding.thesis}</h3>
      <p>{finding.detail}</p>
    </article>
  );
};

type Props = {
  result: RunResult;
  brief: string;
  onNew: () => void;
  onExport: () => void;
};

export const CouncilResults = ({ result, brief, onNew, onExport }: Props) => {
  const [copied, setCopied] = useState(false);
  const [pointerMotion, setPointerMotion] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = async (animate: boolean) => {
    setPointerMotion(animate);
    setCopyError(false);

    try {
      await navigator.clipboard.writeText(
        decisionMarkdown({
          id: "copy",
          createdAt: new Date().toISOString(),
          brief,
          result,
        }),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <section className="results">
      <div className="result-top">
        <div>
          <div className="eyebrow">Decision memo</div>
          <h1>{result.title}</h1>
        </div>
        <div className="confidence">
          <strong>{result.confidence}%</strong>
          <span>support from the brief</span>
        </div>
      </div>
      <div className="verdict">
        <span>Chair’s call</span>
        <p>{result.verdict}</p>
        <div className="mode">
          <span />
          <b>{result.mode === "live" ? "Live model" : "Offline preview"}</b> ·
          evidence limited to your brief
        </div>
      </div>
      {result.execution && result.mode === "live" && (
        <p className="result-model">
          {providerName(parseProvider(result.execution.provider))} ·{" "}
          {result.execution.model}
        </p>
      )}
      <p className="result-caveat">
        Support is the council’s self-assessment, not a calibrated probability.
        No external research or fact-checking is performed.
        {result.mode === "local"
          ? " This offline memo is a deterministic example, not an AI assessment."
          : ""}
      </p>
      <details className="original-brief">
        <summary>
          Original decision brief <ChevronRight size={16} />
        </summary>
        <p>{brief}</p>
      </details>
      <div className="section-label">
        <span>Analysis</span>
        <i />
      </div>
      <div className="agents">
        {result.agents.map((finding) => (
          <PerspectiveResult finding={finding} key={finding.id} />
        ))}
      </div>
      <div className="memo-grid">
        <article>
          <span className="memo-number">01</span>
          <h2>Disagreements</h2>
          {result.tensions.map((item) => (
            <div className="memo-row" key={item}>
              <span>↔</span>
              <p>{item}</p>
            </div>
          ))}
        </article>
        <article>
          <span className="memo-number">02</span>
          <h2>Next steps</h2>
          {result.actions.map((item, i) => (
            <div className="memo-row" key={item}>
              <span>{i + 1}</span>
              <p>{item}</p>
            </div>
          ))}
        </article>
      </div>
      <details>
        <summary>
          Assumptions <ChevronRight size={16} />
        </summary>
        <ul>
          {result.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      <div className="result-actions">
        <Button onClick={onNew}>
          <Plus data-icon="inline-start" />
          New decision
        </Button>
        <Button variant="ghost" onClick={onExport}>
          <Download data-icon="inline-start" />
          Export Markdown
        </Button>
        <Button
          variant="ghost"
          onClick={(event) => void copy(event.detail > 0)}
        >
          <span
            className="state-icon"
            data-active={copied || undefined}
            data-pointer-motion={pointerMotion || undefined}
            data-icon="inline-start"
            aria-hidden="true"
          >
            <Copy />
            <Check />
          </span>
          {copied ? "Copied" : "Copy memo"}
        </Button>
      </div>
      {copyError && <p role="alert">Copy failed. Export Markdown instead.</p>}
    </section>
  );
};
