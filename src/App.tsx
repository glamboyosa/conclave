import { Toast } from "@base-ui/react/toast";
import { ConnectionToasts } from "./components/product/ConnectionToasts";
import { z } from "zod";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Command,
  FileText,
  Plus,
  RotateCcw,
  Settings,
  MessageSquare,
  PanelLeft,
  Moon,
  Sun,
} from "lucide-react";
import type { RunResult } from "./engine";
import { Button } from "./components/ui/button";
import { useModelCatalog } from "./hooks/useModelCatalog";
import { DecisionDiscussion } from "./components/product/DecisionDiscussion";
import { CouncilResults } from "./components/product/CouncilResults";
import { DecisionLibrary } from "./components/product/DecisionLibrary";
import { DecisionComposer } from "./components/product/DecisionComposer";
import { ProviderConnection } from "./components/product/ProviderConnection";
import { CouncilStatus } from "./components/product/CouncilStatus";
import { resultSchema } from "./schemas";
import { readCouncilResponse } from "./run-client";
import { GuideView } from "./Guide";
import {
  defaultConnection,
  keyOptional,
  usesSharedNvidiaRoute,
  keySlot,
  needsApiKey,
  parseProvider,
  persistableEndpoint,
  popularModels,
  providerMeta,
  providerName,
  type ModelConnection,
  type ProviderId,
} from "./providers";
import {
  decisionMarkdown,
  deleteDecision,
  restoreDecision,
  loadDecisionLibrary,
  saveDecision,
  saveDiscussion,
  type DecisionRecord,
} from "./storage";

const sample =
  "We are a 12-person design studio considering turning our internal client-feedback workflow into a paid product. We can spend six weeks on a pilot, but it cannot distract from client delivery. Should we build it, and what would make the bet responsible?";

type Phase = "idle" | "running" | "done" | "error";

type SavedRun = {
  phase: Phase;
  brief: string;
  result: RunResult | null;
  recordId?: string;
};

type View = "decision" | "library" | "settings" | "guide";

function loadSavedRun(): SavedRun {
  const saved = localStorage.getItem("conclave:lastRun");

  if (!saved) return { phase: "idle", brief: "", result: null };

  try {
    const savedMemo = z
      .object({
        brief: z.string(),
        result: resultSchema,
        recordId: z.string().optional(),
      })
      .safeParse(JSON.parse(saved));

    if (savedMemo.success) {
      const parsed = savedMemo.data;

      return {
        phase: "done",
        recordId: parsed.recordId,
        brief: parsed.brief,
        result: resultSchema.parse(parsed.result),
      };
    }

    return {
      phase: "done",
      brief: "",
      result: resultSchema.parse(JSON.parse(saved)),
    };
  } catch {
    localStorage.removeItem("conclave:lastRun");

    return { phase: "idle", brief: "", result: null };
  }
}

function loadSavedConnection(): ModelConnection {
  const saved = localStorage.getItem("conclave:connection");

  if (!saved) return defaultConnection;

  try {
    const parsed = z
      .object({
        provider: z.string(),
        model: z.string(),
        baseURL: z.string().default(""),
      })
      .parse(JSON.parse(saved));

    return {
      provider: parseProvider(parsed.provider),
      model: parsed.model,
      baseURL: parsed.baseURL,
      apiKey: "",
    };
  } catch {
    return defaultConnection;
  }
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [dark, setDark] = useState(
    () => localStorage.getItem("conclave:theme") === "dark",
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-transitions");
    root.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("conclave:theme", dark ? "dark" : "light");

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        root.classList.remove("no-transitions"),
      );
    });

    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("no-transitions");
    };
  }, [dark]);

  const [initial] = useState(loadSavedRun);
  const [brief, setBrief] = useState(initial.brief);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [result, setResult] = useState<RunResult | null>(initial.result);
  const [error, setError] = useState("");
  const [recordId, setRecordId] = useState(initial.recordId);
  const [view, setView] = useState<View>("decision");
  const [library, setLibrary] = useState<DecisionRecord[]>(loadDecisionLibrary);

  const [connection, setConnection] =
    useState<ModelConnection>(loadSavedConnection);

  const [toastManager] = useState(() => Toast.createToastManager());

  const onKeyConnected = useCallback(
    (provider: ProviderId) => {
      toastManager.add({
        title: `${providerName(provider)} catalog connected`,
        description:
          "Your key can access the model list. Ready to try a decision.",
      });
    },
    [toastManager],
  );

  const [keys, setKeys] = useState<Record<string, string>>({});

  const {
    catalogs,
    sharedAvailable,
    refresh,
    models,
    modelSource,
    modelStatus,
    setModels,
    setModelSource,
    setModelStatus,
    setDebouncedKey,
  } = useModelCatalog(connection, onKeyConnected);

  const [stage, setStage] = useState("perspectives");
  const [completed, setCompleted] = useState<string[]>([]);
  const runId = useRef(0);

  const decisionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  function persistConnection(next: ModelConnection) {
    localStorage.setItem(
      "conclave:connection",
      JSON.stringify({
        provider: next.provider,
        model: next.model,
        baseURL: persistableEndpoint(next.baseURL),
      }),
    );
  }

  function changeKey(value: string) {
    setConnection({ ...connection, apiKey: value });
    setModelStatus("loading");
    setKeys((current) => ({
      ...current,
      [keySlot(connection.provider)]: value,
    }));
  }

  function applyModelChoice(value: string) {
    const [providerId, ...rest] = value.split("|");
    const provider = parseProvider(providerId ?? "");
    const model = rest.join("|") || providerMeta[provider].defaultModel;
    const apiKey = keys[keySlot(provider)] ?? "";

    const baseURL =
      provider === connection.provider
        ? connection.baseURL
        : provider === "ollama"
          ? "http://localhost:11434/v1"
          : provider === "lmstudio"
            ? "http://localhost:1234/v1"
            : "";

    const next: ModelConnection = { provider, model, baseURL, apiKey };

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

  async function runCouncil(revision?: DecisionRecord) {
    if (phase === "running") return;

    if (brief.trim().length < 20) {
      setError("Give the council at least 20 characters of context.");
      textareaRef.current?.focus();

      return;
    }

    if (
      (needsApiKey(connection.provider) ||
        (keyOptional(connection.provider) &&
          (!usesSharedNvidiaRoute(connection.provider, connection.model) ||
            sharedAvailable === false))) &&
      !connection.apiKey.trim()
    ) {
      setError(
        `Add your ${providerMeta[connection.provider].keyName ?? providerName(connection.provider)} API key before convening.`,
      );
      keyRef.current?.focus();

      return;
    }

    if (
      ["ollama", "lmstudio", "custom"].includes(connection.provider) &&
      (!connection.baseURL.trim() || !connection.model.trim())
    ) {
      setError("Add an API endpoint and model ID before convening.");

      return;
    }

    if (
      ["ollama", "lmstudio", "custom"].includes(connection.provider) &&
      !persistableEndpoint(connection.baseURL)
    ) {
      setError(
        "Use an HTTP or HTTPS endpoint without credentials, query parameters, or a fragment. Put credentials in the API key field.",
      );

      return;
    }

    if (
      modelSource === "live" &&
      modelStatus === "ready" &&
      connection.provider !== "demo" &&
      !["ollama", "lmstudio", "custom"].includes(connection.provider) &&
      !models.some((model) => model.id === connection.model)
    ) {
      setError(
        "This model is unavailable in the live catalog. Choose another model.",
      );

      return;
    }

    const currentRun = ++runId.current;
    setStage("perspectives");
    setCompleted([]);
    setError("");
    setPhase("running");

    if (!revision) setResult(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          brief: brief.trim(),
          connection,
          revision: revision
            ? { memo: revision.result, messages: revision.discussion }
            : undefined,
        }),
      });

      const data = await readCouncilResponse(response, (event) => {
        if (currentRun !== runId.current) return;

        if (event.type === "stage") setStage(event.stage);

        if (event.type === "perspective")
          setCompleted((values) => [...values, event.id]);
      });

      if (currentRun !== runId.current) return;

      const memo = {
        ...data,
        execution: { provider: connection.provider, model: connection.model },
      };

      setResult(memo);
      setPhase("done");
      const record = saveDecision(brief.trim(), memo, revision?.id);
      setRecordId(record.id);
      localStorage.setItem(
        "conclave:lastRun",
        JSON.stringify({
          brief: brief.trim(),
          result: memo,
          recordId: record.id,
        }),
      );

      setLibrary((records) => [record, ...records].slice(0, 50));
    } catch (cause) {
      if (currentRun !== runId.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "The council could not complete this run.",
      );
      setPhase(revision ? "done" : "error");
    }
  }

  function openRecord(record: DecisionRecord) {
    runId.current++;
    localStorage.setItem(
      "conclave:lastRun",
      JSON.stringify({
        brief: record.brief,
        result: record.result,
        recordId: record.id,
      }),
    );
    setRecordId(record.id);
    setError("");
    setBrief(record.brief);
    setResult(record.result);
    setPhase("done");
    setView("decision");
  }

  function exportRecord(record: DecisionRecord) {
    const blob = new Blob([decisionMarkdown(record)], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `conclave-${record.createdAt.slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    runId.current++;
    setView("decision");
    setBrief("");
    setRecordId(undefined);
    setResult(null);
    setError("");
    setPhase("idle");
    localStorage.removeItem("conclave:lastRun");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const activeRecord =
    library.find((record) => record.id === recordId) ??
    library.find(
      (record) =>
        record.brief === brief && record.result.title === result?.title,
    );

  const parentRecord = library.find(
    (record) => record.id === activeRecord?.parentId,
  );

  const modelLabel = (modelId: string) =>
    models.find((model) => model.id === modelId)?.name ??
    popularModels(connection.provider).find((model) => model.id === modelId)
      ?.name ??
    modelId;

  const connectionControls = (
    <ProviderConnection
      compact={view === "decision"}
      key={connection.provider}
      sharedAvailable={sharedAvailable}
      onRetry={refresh}
      connection={connection}
      models={models}
      catalogs={catalogs}
      status={modelStatus}
      source={modelSource}
      keyRef={keyRef}
      onSelect={applyModelChoice}
      onKey={changeKey}
      onEndpoint={(baseURL, model) => {
        const next = { ...connection, baseURL, model };
        setConnection(next);
        persistConnection(next);
      }}
    />
  );

  return (
    <div className={`shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Command size={16} />
          </span>
          <span>Conclave</span>
        </div>
        <button className="new-run" onClick={reset}>
          <Plus size={16} />
          New decision
        </button>
        <nav aria-label="Primary">
          <button
            className={`nav-item ${view === "decision" ? "active" : ""}`}
            onClick={() => setView("decision")}
          >
            <MessageSquare size={16} />
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
        <div className="recent-decisions">
          <span className="sidebar-label">Recent decisions</span>
          {library.length ? (
            library.slice(0, 12).map((record) => (
              <button
                key={record.id}
                onClick={() => openRecord(record)}
                title={record.result.title}
              >
                <MessageSquare size={14} />
                <span>{record.result.title}</span>
              </button>
            ))
          ) : (
            <p>No decisions yet</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <span>Stored in this browser</span>
        </div>
      </aside>
      <main>
        <header>
          <button
            className="sidebar-toggle icon-button"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft size={18} />
          </button>
          <span className="workspace-title">
            {view === "decision"
              ? phase === "done" && result
                ? result.title
                : "New decision"
              : view === "settings"
                ? "Settings"
                : view === "library"
                  ? "Library"
                  : "Guide"}
          </span>
          <div className="status">
            <span className="status-dot" />
            <span className="min-w-0 truncate">
              {connection.provider === "demo"
                ? "Offline preview"
                : `${providerName(connection.provider)} · ${modelLabel(connection.model)}`}
            </span>
          </div>
          <button
            className="icon-button theme-toggle"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="reset-icon"
            aria-label="Start over"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </button>
          <a
            className="icon-button"
            href="https://github.com/glamboyosa/conclave"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conclave on GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.6-2.81 5.63-5.49 5.93.43.37.82 1.1.82 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
            </svg>
          </a>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <button
            className={view === "decision" ? "active" : ""}
            onClick={() => setView("decision")}
          >
            <MessageSquare size={16} /> Decision
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
            <DecisionLibrary
              records={library}
              onOpen={openRecord}
              onExport={exportRecord}
              onNew={reset}
              onDelete={(record) => {
                try {
                  const index = library.findIndex((saved) => saved.id === record.id);
                  const revisionIds = library.filter((saved) => saved.parentId === record.id).map((saved) => saved.id);
                  const records = deleteDecision(record.id);
                  setLibrary(records);

                  if (activeRecord?.id === record.id) {
                    runId.current++;
                    setRecordId(undefined);
                    setBrief("");
                    setResult(null);
                    setError("");
                    setPhase("idle");
                    localStorage.removeItem("conclave:lastRun");
                  }

                  const toastId = toastManager.add({
                    title: "Decision deleted",
                    description: record.result.title,
                    timeout: 10000,
                    actionProps: {
                      children: "Undo",
                      onClick: () => {
                        try {
                          setLibrary(restoreDecision(record, index, revisionIds));
                          toastManager.close(toastId);
                        } catch {
                          toastManager.add({ title: "Could not restore the decision", description: "Browser storage is unavailable. Try again." });
                        }
                      },
                    },
                  });
                } catch {
                  toastManager.add({ title: "Could not delete the decision", description: "Browser storage is unavailable. Try again." });
                }
              }}
            />
          ) : view === "settings" ? (
            <section className="settings-view">
              <h1>Model & connection</h1>
              <p className="lede">
                Free NVIDIA access is included. Connect your own key to use
                another hosted model.
              </p>
              {connectionControls}
              <Button onClick={() => setView("decision")}>Done</Button>
            </section>
          ) : phase === "idle" || phase === "error" ? (
            <DecisionComposer
              brief={brief}
              error={error}
              textareaRef={textareaRef}
              onChange={setBrief}
              onRun={() => void runCouncil()}
              onExample={() => {
                setBrief(sample);
                textareaRef.current?.focus();
              }}
              connection={connectionControls}
            />
          ) : null}
          {view === "decision" && phase === "running" && (
            <CouncilStatus
              stage={stage}
              completed={completed}
              offline={connection.provider === "demo"}
              brief={brief}
            />
          )}
          {view === "decision" && phase === "done" && result && (
            <div
              className="decision-thread"
              id="decision-memo"
              ref={decisionRef}
              tabIndex={-1}
              aria-label="Decision memo"
            >
              {parentRecord && (
                <Button
                  variant="ghost"
                  onClick={() => openRecord(parentRecord)}
                >
                  View previous memo
                </Button>
              )}
              <CouncilResults
                result={result}
                brief={brief}
                onNew={reset}
                onExport={() =>
                  exportRecord(
                    activeRecord ?? {
                      id: "export",
                      createdAt: new Date().toISOString(),
                      brief,
                      result,
                    },
                  )
                }
              />
              {error && (
                <p role="alert" className="discussion-error">
                  {error}
                </p>
              )}
              <DecisionDiscussion
                key={activeRecord?.id ?? "unsaved"}
                record={
                  activeRecord ?? {
                    id: "unsaved",
                    createdAt: new Date().toISOString(),
                    brief,
                    result,
                  }
                }
                connection={connection}
                controls={connectionControls}
                onSave={(messages) => {
                  const record = activeRecord ?? saveDecision(brief, result);
                  setRecordId(record.id);
                  setLibrary(saveDiscussion(record.id, messages));
                  localStorage.setItem(
                    "conclave:lastRun",
                    JSON.stringify({ brief, result, recordId: record.id }),
                  );
                }}
                onRevise={() => activeRecord && void runCouncil(activeRecord)}
                onDecision={(animate) => {
                  const reducedMotion = window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches;

                  decisionRef.current?.scrollIntoView({
                    block: "start",
                    behavior: animate && !reducedMotion ? "smooth" : "instant",
                  });
                  decisionRef.current?.focus({ preventScroll: true });
                }}
              />
            </div>
          )}
        </div>
      </main>
      <Toast.Provider toastManager={toastManager} limit={5}>
        <ConnectionToasts />
      </Toast.Provider>
    </div>
  );
}
