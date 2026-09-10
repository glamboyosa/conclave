import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  CircleAlert,
  Command,
  FileText,
  KeyRound,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AgentFinding, AgentId, RunResult } from "./engine";
import { Button } from "./components/ui/button";
import {
  defaultConnection,
  needsApiKey,
  providerPresets,
  type ModelConnection,
  type ProviderId,
} from "./providers";

const sample =
  "We are a 12-person design studio considering turning our internal client-feedback workflow into a paid product. We can spend six weeks on a pilot, but it cannot distract from client delivery. Should we build it, and what would make the bet responsible?";

const agentMeta: Record<
  AgentId,
  { name: string; role: string; monogram: string }
> = {
  optimist: { name: "Mara", role: "Opportunity", monogram: "M" },
  analyst: { name: "Ivo", role: "Evidence", monogram: "I" },
  skeptic: { name: "Sana", role: "Risk", monogram: "S" },
};

const council: Array<{
  id: AgentId;
  name: string;
  role: string;
  monogram: string;
}> = [
  { id: "optimist", ...agentMeta.optimist },
  { id: "analyst", ...agentMeta.analyst },
  { id: "skeptic", ...agentMeta.skeptic },
];

type Phase = "idle" | "running" | "done" | "error";

type SavedRun = { phase: Phase; result: RunResult | null };

type View = "decision" | "settings";

const providerNames: Record<ProviderId, string> = {
  demo: "Built-in demo",
  openrouter: "OpenRouter",
  nvidia: "NVIDIA NIM",
  openai: "OpenAI",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  custom: "OpenAI-compatible",
};

function parseProvider(value: string): ProviderId {
  switch (value) {
    case "openrouter":
    case "nvidia":
    case "openai":
    case "ollama":
    case "lmstudio":
    case "custom":
      return value;
    default:
      return "demo";
  }
}

function loadSavedRun(): SavedRun {
  const saved = localStorage.getItem("conclave:lastRun");

  if (!saved) return { phase: "idle", result: null };

  try {
    const result: RunResult = JSON.parse(saved);

    return { phase: "done", result };
  } catch {
    localStorage.removeItem("conclave:lastRun");

    return { phase: "idle", result: null };
  }
}

function AgentCard({
  finding,
  index,
}: {
  finding: AgentFinding;
  index: number;
}) {
  const meta = agentMeta[finding.id];
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className={`agent-card agent-${finding.id}`}
      initial={reduceMotion ? false : { opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.09,
        ease: [0.23, 1, 0.32, 1],
      }}
      data-testid={`agent-${finding.id}`}
    >
      <div className="agent-head">
        <div className="avatar">
          {meta.monogram}
          <span />
        </div>
        <div>
          <strong>{meta.name}</strong>
          <small>{meta.role}</small>
        </div>
        <span className="score">{finding.score}</span>
      </div>
      <span className="signal">{finding.signal}</span>
      <h3>{finding.thesis}</h3>
      <p>{finding.detail}</p>
    </motion.article>
  );
}

export default function App() {
  const [initial] = useState(loadSavedRun);
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [result, setResult] = useState<RunResult | null>(initial.result);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("decision");

  const [connection, setConnection] = useState<ModelConnection>(() => {
    const saved = localStorage.getItem("conclave:connection");

    if (!saved) return defaultConnection;

    try {
      return { ...defaultConnection, ...JSON.parse(saved), apiKey: "" };
    } catch {
      return defaultConnection;
    }
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function runCouncil() {
    if (brief.trim().length < 20) {
      setError("Give the council at least 20 characters of context.");
      textareaRef.current?.focus();

      return;
    }

    setError("");
    setPhase("running");
    setResult(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), connection }),
      });

      const data: RunResult & { error?: string } = await response.json();

      if (!response.ok)
        throw new Error(
          data.error || "The council could not complete this run.",
        );
      await new Promise((resolve) => setTimeout(resolve, 950));
      setResult(data);
      setPhase("done");
      localStorage.setItem("conclave:lastRun", JSON.stringify(data));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The council could not complete this run.",
      );
      setPhase("error");
    }
  }

  function chooseProvider(provider: ProviderId) {
    setConnection({ ...providerPresets[provider], apiKey: "" });
  }

  function saveConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (connection.provider !== "demo" && !connection.model.trim()) {
      setError("Enter the model ID exposed by this provider.");

      return;
    }

    if (connection.provider !== "demo" && !connection.baseURL.trim()) {
      setError("Enter an OpenAI-compatible API endpoint.");

      return;
    }

    if (needsApiKey(connection.provider) && !connection.apiKey.trim()) {
      setError("Enter an API key for this provider.");

      return;
    }

    const safeConnection = {
      provider: connection.provider,
      model: connection.model,
      baseURL: connection.baseURL,
    };

    localStorage.setItem("conclave:connection", JSON.stringify(safeConnection));
    setError("");
    setView("decision");
  }

  function reset() {
    setBrief("");
    setResult(null);
    setError("");
    setPhase("idle");
    localStorage.removeItem("conclave:lastRun");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const chars = brief.length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Command size={16} />
          </span>
          <span>Conclave</span>
        </div>
        <nav aria-label="Primary">
          <button
            className={`nav-item ${view === "decision" ? "active" : ""}`}
            onClick={() => setView("decision")}
          >
            <Sparkles size={16} />
            Decision room
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => {
              setError("");
              setView("settings");
            }}
          >
            <Settings size={16} />
            Settings
          </button>
          <button className="nav-item" disabled>
            <FileText size={16} />
            Library<span>Soon</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <ShieldCheck size={15} />
            <div>
              <strong>Private by design</strong>
              <span>Briefs stay on this machine in local mode.</span>
            </div>
          </div>
          <button className="new-run" onClick={reset}>
            <Plus size={16} />
            New decision
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="mobile-brand">
            <Command size={15} />
            Conclave
          </div>
          <div className="status">
            <span className="status-dot" />
            {providerNames[connection.provider]} · 3 agents
          </div>
          <button
            className="reset-icon"
            aria-label="Start over"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </button>
        </header>
        <div className="workspace">
          {view === "settings" ? (
            <section className="settings-view">
              <div className="eyebrow">
                <span>Settings</span> Model connection
              </div>
              <h1>Choose who powers the council.</h1>
              <p className="lede">
                Use the offline demo, a hosted model, or a local server. Your
                key stays in this tab and is never written to local storage.
              </p>
              <form className="settings-form" onSubmit={saveConnection}>
                <label>
                  <span>Provider</span>
                  <select
                    value={connection.provider}
                    onChange={(event) => {
                      const provider = parseProvider(event.target.value);

                      chooseProvider(provider);
                    }}
                  >
                    {Object.entries(providerNames).map(([id, name]) => (
                      <option value={id} key={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {connection.provider !== "demo" && (
                  <>
                    <label>
                      <span>Model ID</span>
                      <input
                        value={connection.model}
                        onChange={(event) =>
                          setConnection({
                            ...connection,
                            model: event.target.value,
                          })
                        }
                        placeholder="provider/model-name"
                      />
                    </label>
                    <label>
                      <span>API endpoint</span>
                      <input
                        type="url"
                        value={connection.baseURL}
                        onChange={(event) =>
                          setConnection({
                            ...connection,
                            baseURL: event.target.value,
                          })
                        }
                        inputMode="url"
                        placeholder="https://api.example.com/v1"
                      />
                    </label>
                    <label>
                      <span>
                        API key {needsApiKey(connection.provider) ? "" : "(optional)"}
                      </span>
                      <div className="secret-input">
                        <KeyRound size={16} />
                        <input
                          type="password"
                          value={connection.apiKey}
                          onChange={(event) =>
                            setConnection({
                              ...connection,
                              apiKey: event.target.value,
                            })
                          }
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          spellCheck={false}
                          placeholder="Held for this tab only"
                        />
                      </div>
                    </label>
                  </>
                )}
                {connection.provider === "nvidia" && (
                  <p className="provider-note">
                    Nemotron 3 Ultra is preselected. NVIDIA currently offers a
                    free development endpoint; usage limits are set by NVIDIA.
                  </p>
                )}
                {connection.provider === "openrouter" && (
                  <p className="provider-note">
                    Free Nemotron 3 Ultra is preselected. Use any OpenRouter
                    model ID here for OpenAI, Anthropic, DeepSeek, Kimi, and
                    other models. A key in .env.local also works.
                  </p>
                )}
                {connection.provider === "demo" && (
                  <p className="provider-note">
                    The deterministic demo makes no network request and needs no
                    account.
                  </p>
                )}
                {error && <div className="error" role="alert">{error}</div>}
                <div className="settings-actions">
                  <Button type="submit">Save connection</Button>
                </div>
              </form>
            </section>
          ) : phase === "idle" || phase === "error" ? (
            <section className="composer-view">
              <div className="eyebrow">
                <span>01</span> Frame the decision
              </div>
              <h1>
                Bring the decision
                <br />
                you keep circling.
              </h1>
              <p className="lede">
                A private council will argue the upside, interrogate the
                evidence, and find the risk you are not naming.
              </p>
              <div className={`composer ${error ? "has-error" : ""}`}>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  aria-label="Decision brief"
                  value={brief}
                  maxLength={4000}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="What are you deciding? Include the stakes, constraints, and what would make this a good outcome…"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                      runCouncil();
                  }}
                />
                <div className="composer-footer">
                  <span className="char-count">
                    {chars.toLocaleString()} / 4,000
                  </span>
                  <Button onClick={runCouncil}>
                    Convene council <span className="shortcut">⌘↵</span>
                    <ArrowUp data-icon="inline-end" />
                  </Button>
                </div>
              </div>
              {error && (
                <div className="error" role="alert">
                  <CircleAlert size={15} />
                  {error}
                </div>
              )}
              <button className="sample" onClick={() => setBrief(sample)}>
                Use an example brief <ChevronRight size={15} />
              </button>
              <div className="roster">
                <span>Your council</span>
                {council.map((agent) => (
                  <div className={`roster-person ${agent.id}`} key={agent.id}>
                    <b>{agent.monogram}</b>
                    <span>
                      {agent.name}
                      <small>{agent.role}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {phase === "running" && (
            <section className="running" aria-live="polite">
              <div className="orbit">
                <span>M</span>
                <span>I</span>
                <span>S</span>
                <i />
              </div>
              <div className="eyebrow">
                <span>02</span> Council in session
              </div>
              <h2>Three minds. One hard question.</h2>
              <p>
                Reading the brief, building independent positions, then
                resolving the sharpest disagreement.
              </p>
              <div className="steps">
                <span className="complete">
                  <Check size={14} />
                  Brief understood
                </span>
                <span className="active-step">
                  <i />
                  Agents forming positions
                </span>
                <span>
                  <i />
                  Chair synthesis
                </span>
              </div>
            </section>
          )}
          {phase === "done" && result && (
            <section className="results">
              <div className="result-top">
                <div>
                  <div className="eyebrow">
                    <span>03</span> Decision memo
                  </div>
                  <h1>{result.title}</h1>
                </div>
                <div className="confidence">
                  <strong>{result.confidence}%</strong>
                  <span>council confidence</span>
                </div>
              </div>
              <div className="verdict">
                <span>Chair’s call</span>
                <p>{result.verdict}</p>
                <div className="mode">
                  <span />
                  <b>
                    {result.mode === "live" ? "Live model" : "Local council"}
                  </b>{" "}
                  · evidence limited to your brief
                </div>
              </div>
              <div className="section-label">
                <span>Independent positions</span>
                <i />
              </div>
              <div className="agents">
                {result.agents.map((finding, i) => (
                  <AgentCard finding={finding} index={i} key={finding.id} />
                ))}
              </div>
              <div className="memo-grid">
                <article>
                  <span className="memo-number">01</span>
                  <h2>Productive tensions</h2>
                  {result.tensions.map((item) => (
                    <div className="memo-row" key={item}>
                      <span>↔</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </article>
                <article>
                  <span className="memo-number">02</span>
                  <h2>Next moves</h2>
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
                  Assumptions this recommendation depends on{" "}
                  <ChevronRight size={16} />
                </summary>
                <ul>
                  {result.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
              <Button className="another" variant="ghost" onClick={reset}>
                <Plus data-icon="inline-start" />
                Bring another decision
              </Button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
