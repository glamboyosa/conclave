import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Command,
  Download,
  FileText,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AgentFinding, AgentId, RunResult } from "./engine";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "./components/ui/field";
import { GuideView } from "./Guide";
import {
  defaultConnection,
  keyOptional,
  keySlot,
  needsApiKey,
  parseProvider,
  pickerProviders,
  popularModels,
  providerMeta,
  providerName,
  type CatalogModel,
  type ModelConnection,
} from "./providers";
import {
  decisionMarkdown,
  loadDecisionLibrary,
  saveDecision,
  type DecisionRecord,
} from "./storage";

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

type SavedRun = { phase: Phase; brief: string; result: RunResult | null };

type View = "decision" | "library" | "settings" | "guide";

const catalogResponseSchema = z.object({
  models: z.array(z.object({ id: z.string(), name: z.string(), free: z.boolean() })),
  source: z.enum(["live", "fallback"]).catch("fallback"),
});

function loadSavedRun(): SavedRun {
  const saved = localStorage.getItem("conclave:lastRun");

  if (!saved) return { phase: "idle", brief: "", result: null };

  try {
    const parsed: RunResult | { brief: string; result: RunResult } = JSON.parse(saved);

    if ("result" in parsed) {
      return { phase: "done", brief: parsed.brief, result: parsed.result };
    }

    return { phase: "done", brief: "", result: parsed };
  } catch {
    localStorage.removeItem("conclave:lastRun");

    return { phase: "idle", brief: "", result: null };
  }
}

function loadSavedConnection(): ModelConnection {
  const saved = localStorage.getItem("conclave:connection");

  if (!saved) return defaultConnection;

  try {
    const parsed = JSON.parse(saved);

    return {
      ...defaultConnection,
      ...parsed,
      provider: parseProvider(parsed.provider ?? ""),
      apiKey: "",
    };
  } catch {
    return defaultConnection;
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
  const [brief, setBrief] = useState(initial.brief);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [result, setResult] = useState<RunResult | null>(initial.result);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("decision");
  const [library, setLibrary] = useState<DecisionRecord[]>(loadDecisionLibrary);
  const [connection, setConnection] = useState<ModelConnection>(loadSavedConnection);
  const [keys, setKeys] = useState<Record<string, string>>({});

  const [models, setModels] = useState<CatalogModel[]>(() =>
    popularModels(connection.provider),
  );

  const [modelSource, setModelSource] = useState<"live" | "fallback">("fallback");

  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready">(() =>
    connection.provider === "demo" ? "idle" : "loading",
  );

  const [debouncedKey, setDebouncedKey] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(connection.apiKey.trim()), 500);

    return () => clearTimeout(timer);
  }, [connection.apiKey]);

  useEffect(() => {
    if (connection.provider === "demo") return;

    const controller = new AbortController();
    let stale = false;

    fetch(`/api/models?provider=${connection.provider}`, {
      signal: controller.signal,
      headers: debouncedKey ? { "x-conclave-key": debouncedKey } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");

        return catalogResponseSchema.parse(await response.json());
      })
      .then(({ models: nextModels, source }) => {
        // A switch that happened while this fetch was in flight must not overwrite the new provider's list.
        if (stale) return;

        const live = nextModels.length ? nextModels : popularModels(connection.provider);

        const missing = popularModels(connection.provider).filter(
          (popular) => !live.some((model) => model.id === popular.id),
        );

        setModels([...live, ...missing]);
        setModelSource(nextModels.length ? source : "fallback");
        setModelStatus("ready");
      })
      .catch((cause: unknown) => {
        if (stale) return;

        if (cause instanceof DOMException && cause.name === "AbortError") return;

        setModels(popularModels(connection.provider));
        setModelSource("fallback");
        setModelStatus("ready");
      });

    return () => {
      stale = true;
      controller.abort();
    };
  }, [connection.provider, debouncedKey]);

  function persistConnection(next: ModelConnection) {
    localStorage.setItem(
      "conclave:connection",
      JSON.stringify({
        provider: next.provider,
        model: next.model,
        baseURL: next.baseURL,
      }),
    );
  }

  function changeKey(value: string) {
    setConnection({ ...connection, apiKey: value });
    setKeys((current) => ({ ...current, [keySlot(connection.provider)]: value }));
  }

  function applyModelChoice(value: string) {
    const [providerId, ...rest] = value.split("|");
    const provider = parseProvider(providerId ?? "");
    const model = rest.join("|") || providerMeta[provider].defaultModel;
    const apiKey = keys[keySlot(provider)] ?? "";

    const next: ModelConnection = { provider, model, baseURL: "", apiKey };

    setConnection(next);
    persistConnection(next);
    setError("");
    // Skip the typing debounce on provider switches so the catalog fetch uses the right key immediately.
    setDebouncedKey(apiKey.trim());

    if (provider === "demo") {
      setModels([]);
      setModelStatus("idle");

      return;
    }

    // Seed the new provider's popular list so labels resolve instantly; the live catalog swaps in silently.
    if (provider !== connection.provider) {
      setModels(popularModels(provider));
      setModelSource("fallback");
      setModelStatus("loading");
    }
  }

  async function runCouncil() {
    if (brief.trim().length < 20) {
      setError("Give the council at least 20 characters of context.");
      textareaRef.current?.focus();

      return;
    }

    if (needsApiKey(connection.provider) && !connection.apiKey.trim()) {
      setError(`Add your ${providerName(connection.provider)} API key in the model picker.`);
      keyRef.current?.focus();

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
      localStorage.setItem(
        "conclave:lastRun",
        JSON.stringify({ brief: brief.trim(), result: data }),
      );
      const record = saveDecision(brief.trim(), data);

      setLibrary((records) => [record, ...records].slice(0, 50));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The council could not complete this run.",
      );
      setPhase("error");
    }
  }

  function openRecord(record: DecisionRecord) {
    setBrief(record.brief);
    setResult(record.result);
    setPhase("done");
    setView("decision");
  }

  function exportRecord(record: DecisionRecord) {
    const blob = new Blob([decisionMarkdown(record)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `conclave-${record.createdAt.slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
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
  const meta = providerMeta[connection.provider];

  const modelLabel = (modelId: string) =>
    models.find((model) => model.id === modelId)?.name ??
    popularModels(connection.provider).find((model) => model.id === modelId)?.name ??
    modelId;

  const connectionValue = `${connection.provider}|${connection.model}`;

  const pickerLabel = (value: string) => {
    const [providerId, ...rest] = value.split("|");
    const provider = parseProvider(providerId ?? "");
    const modelId = rest.join("|");

    if (provider === "demo") return "Offline council";

    const catalog = provider === connection.provider ? models : popularModels(provider);

    return (
      catalog.find((model) => model.id === modelId)?.name ??
      popularModels(provider).find((model) => model.id === modelId)?.name ??
      modelId
    );
  };

  const settingsLabel = (value: string) => {
    const [providerId, ...rest] = value.split("|");
    const provider = parseProvider(providerId ?? "");
    const modelId = rest.join("|");

    if (provider === "demo") return "Offline council";

    const popular = popularModels(provider).find((model) => model.id === modelId);

    return popular
      ? `${providerName(provider)} · ${popular.name}`
      : `${providerName(provider)} · ${modelId}`;
  };

  const noteLines: string[] = [];

  if (connection.provider === "demo") {
    noteLines.push(
      "No network requests — the offline council is deterministic and needs no account or key.",
    );
  } else {
    if (keyOptional(connection.provider)) {
      noteLines.push(
        connection.apiKey
          ? "Your OpenRouter key is held in this tab’s memory only — never saved."
          : connection.model.endsWith(":free")
            ? "Runs free on Conclave’s shared OpenRouter key — no key needed. Add your own key for paid models."
            : "The shared key covers free models only — add your own OpenRouter key to run this model.",
      );
    }

    if (needsApiKey(connection.provider)) {
      noteLines.push(
        connection.apiKey
          ? "Key held in this tab’s memory only — sent to the local Conclave server at run time, never saved."
          : `Bring your own ${providerName(connection.provider)} key — it stays in this tab’s memory and is never saved.`,
      );
    }

    if (modelStatus !== "loading" && modelSource === "fallback") {
      noteLines.push(
        needsApiKey(connection.provider) && !connection.apiKey
          ? `Showing popular ${providerName(connection.provider)} models — add your key to load the full live catalog.`
          : `The live ${providerName(connection.provider)} catalog is unavailable — showing popular models.`,
      );
    }
  }

  const showKeyLink =
    meta.keyUrl &&
    !connection.apiKey &&
    (needsApiKey(connection.provider) || keyOptional(connection.provider));

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
            className={`nav-item ${view === "library" ? "active" : ""}`}
            onClick={() => setView("library")}
          >
            <FileText size={16} />
            Library<span>{library.length}</span>
          </button>
          <button
            className={`nav-item ${view === "guide" ? "active" : ""}`}
            onClick={() => setView("guide")}
          >
            <BookOpen size={16} />
            Guide
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
            <span className="min-w-0 truncate">
              {connection.provider === "demo"
                ? "Offline · 3 agents"
                : `${providerName(connection.provider)} · ${modelLabel(connection.model)}`}
            </span>
          </div>
          <button
            className="reset-icon"
            aria-label="Start over"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </button>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button
            className={view === "decision" ? "active" : ""}
            onClick={() => setView("decision")}
          >
            <Sparkles size={16} /> Decision
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => setView("library")}
          >
            <FileText size={16} /> Library
          </button>
          <button
            className={view === "guide" ? "active" : ""}
            onClick={() => setView("guide")}
          >
            <BookOpen size={16} /> Guide
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            <Settings size={16} /> Settings
          </button>
        </nav>
        <div className="workspace">
          {view === "guide" ? (
            <GuideView />
          ) : view === "library" ? (
            <section className="library-view">
              <div className="eyebrow">
                <span>Local only</span> Decision library
              </div>
              <h1>Your decision record.</h1>
              <p className="lede">
                Saved in this browser. Conclave has no account, server database,
                or cloud sync. Export Markdown when another agent needs the full
                context.
              </p>
              {library.length ? (
                <div className="library-list">
                  {library.map((record) => (
                    <article key={record.id}>
                      <button onClick={() => openRecord(record)}>
                        <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                        <strong>{record.result.title}</strong>
                        <p>{record.brief}</p>
                      </button>
                      <Button
                        variant="ghost"
                        aria-label={`Export ${record.result.title} as Markdown`}
                        onClick={() => exportRecord(record)}
                      >
                        <Download data-icon="inline-start" /> Markdown
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-library">
                  <FileText size={22} />
                  <strong>No saved decisions</strong>
                  <p>Completed councils will appear here on this device.</p>
                </div>
              )}
            </section>
          ) : view === "settings" ? (
            <section className="settings-view">
              <div className="eyebrow">
                <span>Settings</span> Model
              </div>
              <h1>Pick a model. That’s all.</h1>
              <p className="lede">
                A short list of popular models that handle the council’s
                structured format. The full live catalog — and your API key —
                live in the model picker on the decision page.
              </p>
              <Card className="settings-card">
                <CardHeader>
                  <CardTitle>Popular models</CardTitle>
                  <CardDescription>
                    One dropdown. No typing, no endpoints.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Field>
                    <FieldLabel htmlFor="popular-model">Model</FieldLabel>
                    <Select
                      value={connectionValue}
                      itemToStringLabel={settingsLabel}
                      onValueChange={(value) => value && applyModelChoice(value)}
                    >
                      <SelectTrigger id="popular-model" className="settings-control" aria-label="Popular model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {pickerProviders.map((id) => (
                          <SelectGroup key={id}>
                            <SelectLabel>{providerName(id)}</SelectLabel>
                            {id === "demo" ? (
                              <SelectItem value={`demo|${providerMeta.demo.defaultModel}`}>
                                Offline council · Free
                              </SelectItem>
                            ) : (
                              <>
                                {id === connection.provider &&
                                  !popularModels(id).some((model) => model.id === connection.model) && (
                                    <SelectItem value={connectionValue}>
                                      {modelLabel(connection.model)}
                                    </SelectItem>
                                  )}
                                {popularModels(id).map((model) => (
                                  <SelectItem value={`${id}|${model.id}`} key={model.id}>
                                    {model.name}{model.free ? " · Free" : ""}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {connection.provider === "demo"
                        ? "The offline council is deterministic — no key, no network."
                        : needsApiKey(connection.provider) && !connection.apiKey
                          ? `${providerName(connection.provider)} needs your API key — add it in the model picker on the decision page.`
                          : "Provider, live catalog, and keys are managed in the model picker on the decision page."}
                    </FieldDescription>
                  </Field>
                  {needsApiKey(connection.provider) && !connection.apiKey && (
                    <Alert>
                      <ShieldCheck aria-hidden="true" />
                      <AlertTitle>Key needed for {providerName(connection.provider)}</AlertTitle>
                      <AlertDescription>
                        Add it in the model picker on the decision page. It stays
                        in this tab’s memory and is never saved.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
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
              <div className="mb-2 flex items-end gap-2.5 rounded-[18px] bg-paper p-2.5 shadow-[0_1px_1px_rgba(22,32,25,0.03),0_6px_20px_rgba(31,40,34,0.05),inset_0_0_0_1px_rgba(28,37,31,0.06)] max-[850px]:flex-col max-[850px]:items-stretch">
                <div className="grid min-w-0 flex-1 gap-[5px]">
                  <span className="flex items-center pl-[3px] font-mono text-[9px] uppercase tracking-[0.09em] text-faint">
                    Model
                  </span>
                  <Select
                    value={connectionValue}
                    itemToStringLabel={pickerLabel}
                    onValueChange={(value) => value && applyModelChoice(value)}
                  >
                    <SelectTrigger
                      className="min-h-[42px] w-full rounded-lg bg-white text-[13px]"
                      aria-label="Model"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {pickerProviders.map((id) => {
                        const items: CatalogModel[] =
                          id === "demo"
                            ? [{ id: providerMeta.demo.defaultModel, name: "Offline council", free: true }]
                            : id === connection.provider
                              ? models
                              : popularModels(id);

                        if (!items.length) return null;

                        return (
                          <SelectGroup key={id}>
                            <SelectLabel>
                              {providerName(id)}{id === "openrouter" ? " · Free default" : ""}
                            </SelectLabel>
                            {items.map((model) => (
                              <SelectItem value={`${id}|${model.id}`} key={model.id}>
                                {model.name}{model.free ? " · Free" : ""}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {(needsApiKey(connection.provider) || keyOptional(connection.provider)) && (
                  <div className="grid min-w-0 flex-1 gap-[5px]">
                    <label
                      className="flex items-center pl-[3px] font-mono text-[9px] uppercase tracking-[0.09em] text-faint"
                      htmlFor="byok-key"
                    >
                      {meta.keyName ?? providerName(connection.provider)} API key
                      {keyOptional(connection.provider) ? " (optional)" : ""}
                    </label>
                    <Input
                      ref={keyRef}
                      id="byok-key"
                      className="min-h-[42px] w-full rounded-lg bg-white pr-2.5 text-[13px]"
                      type="password"
                      value={connection.apiKey}
                      onChange={(event) => changeKey(event.target.value)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      spellCheck={false}
                      placeholder="Held for this tab only"
                    />
                  </div>
                )}
              </div>
              <div className="mx-[2px] mb-[18px] grid gap-[3px]">
                {noteLines.map((line) => (
                  <p className="m-0 text-[11px] leading-[1.5] text-pretty text-faint" key={line}>
                    {line}
                  </p>
                ))}
                {showKeyLink && (
                  <a
                    className="flex min-h-6 w-fit items-center gap-[1px] text-[11px] font-semibold text-primary no-underline underline-offset-[3px] hover:underline"
                    href={meta.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get a {meta.keyName ?? providerName(connection.provider)} key <ChevronRight size={12} />
                  </a>
                )}
              </div>
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
          {view === "decision" && phase === "running" && (
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
          {view === "decision" && phase === "done" && result && (
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
              <Button
                className="export-current"
                variant="ghost"
                onClick={() =>
                  exportRecord({
                    id: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    brief,
                    result,
                  })
                }
              >
                <Download data-icon="inline-start" />
                Export Markdown
              </Button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
