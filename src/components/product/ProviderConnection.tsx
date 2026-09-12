import { useRef, useState, type RefObject } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import {
  providerMeta,
  providerName,
  keyOptional,
  usesSharedNvidiaRoute,
  needsApiKey,
  type ModelConnection,
} from "../../providers";
import { ModelPicker } from "./ModelPicker";
import { Button } from "../ui/button";
import type { CatalogModel } from "../../providers";

type Props = {
  compact?: boolean;
  connection: ModelConnection;
  sharedAvailable: boolean | null;
  models: CatalogModel[];
  catalogs?: Partial<Record<ModelConnection["provider"], CatalogModel[]>>;
  status: "idle" | "loading" | "ready";
  source: "live" | "fallback";
  keyRef: RefObject<HTMLInputElement | null>;
  onSelect: (value: string) => void;
  onRetry: () => void;
  onKey: (value: string) => void;
  onEndpoint: (baseURL: string, model: string) => void;
};

export const ProviderConnection = ({
  compact = false,
  connection,
  sharedAvailable,
  models,
  catalogs,
  status,
  source,
  keyRef,
  onSelect,
  onRetry,
  onKey,
  onEndpoint,
}: Props) => {
  const [reveal, setReveal] = useState(false);
  const [pointerMotion, setPointerMotion] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const meta = providerMeta[connection.provider];
  const local = ["ollama", "lmstudio", "custom"].includes(connection.provider);
  const hasKey = Boolean(connection.apiKey.trim());

  const requiresKey =
    needsApiKey(connection.provider) ||
    (keyOptional(connection.provider) &&
      (!usesSharedNvidiaRoute(connection.provider, connection.model) ||
        sharedAvailable === false));

  const unavailable =
    source === "live" &&
    status === "ready" &&
    !local &&
    connection.provider !== "demo" &&
    !models.some((model) => model.id === connection.model);

  const access =
    connection.provider === "demo"
      ? "Offline"
      : local
        ? "Local"
        : hasKey
          ? "BYOK"
          : requiresKey
            ? "Requires key"
            : "Free · Shared";

  const showKey =
    needsApiKey(connection.provider) ||
    keyOptional(connection.provider) ||
    connection.provider === "custom";

  const keyPanelOpen = expanded || (requiresKey && !hasKey);

  return (
    <div className="provider-connection">
      <div className="connection-row">
        <ModelPicker
          side={compact ? "top" : "bottom"}
          connection={connection}
          models={models}
          catalogs={catalogs}
          authenticatedCatalog={source === "live"}
          onSelect={onSelect}
        />
        <span
          className={`connection-state ${requiresKey && !hasKey ? "needs-key" : ""}`}
        >
          <ShieldCheck size={14} />
          {access}
        </span>
        {showKey && (
          <button
            ref={toggleRef}
            className="connection-toggle"
            aria-expanded={keyPanelOpen}
            aria-controls="key-connection"
            data-pointer-motion={pointerMotion || undefined}
            onClick={(event) => {
              setPointerMotion(event.detail > 0);
              setExpanded(!expanded);
            }}
          >
            <KeyRound size={14} />
            {hasKey ? "Manage key" : "API key"}
          </button>
        )}
      </div>
      {(!compact ||
        expanded ||
        (requiresKey && !hasKey) ||
        local ||
        connection.provider === "demo") && (
        <p className="connection-guidance">
          {connection.provider === "demo"
            ? "Offline preview. No model calls."
            : local
              ? "The Conclave server connects to your local endpoint. Your model must support structured output."
              : keyOptional(connection.provider)
                ? hasKey
                  ? "Using your OpenRouter key."
                  : requiresKey
                    ? sharedAvailable === false &&
                      usesSharedNvidiaRoute(
                        connection.provider,
                        connection.model,
                      )
                      ? "Shared access is not configured on this server. Add your OpenRouter API key or choose Offline."
                      : "The shared key covers free NVIDIA models only. Add your OpenRouter key for this model."
                    : sharedAvailable === true
                      ? "Free NVIDIA via Conclave’s shared OpenRouter key."
                      : "Free NVIDIA via the shared OpenRouter key, if configured."
                : `Your brief is sent to ${providerName(connection.provider)}. ${hasKey ? "Your key is set for this tab." : `Add your ${providerName(connection.provider)} API key before convening.`}`}
        </p>
      )}
      {showKey && keyPanelOpen && (
        <div className="key-connection" id="key-connection">
          <label htmlFor="byok-key">
            {meta.keyName ?? providerName(connection.provider)} API key
            {keyOptional(connection.provider) && !requiresKey
              ? " (optional)"
              : ""}
          </label>
          <div className="key-input">
            <input
              ref={keyRef}
              id="byok-key"
              type={reveal ? "text" : "password"}
              value={connection.apiKey}
              onChange={(event) => {
                setExpanded(true);
                onKey(event.target.value);
              }}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
              placeholder="Paste your key"
            />
            <button
              type="button"
              className="icon-button"
              aria-label={reveal ? "Hide API key" : "Reveal API key"}
              onClick={(event) => {
                setPointerMotion(event.detail > 0);
                setReveal(!reveal);
              }}
            >
              <span
                className="state-icon"
                data-active={reveal || undefined}
                data-pointer-motion={pointerMotion || undefined}
                aria-hidden="true"
              >
                <Eye size={17} />
                <EyeOff size={17} />
              </span>
            </button>
          </div>
          <p>
            Held only in this tab’s memory. Cleared on reload or close. Sent to
            the Conclave server for catalogs and runs; never saved or exported.
          </p>
          <div className="key-actions">
            {meta.keyUrl && (
              <a href={meta.keyUrl} target="_blank" rel="noreferrer">
                Get a {meta.keyName ?? providerName(connection.provider)} key ↗
              </a>
            )}
            {hasKey && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setExpanded(false);
                    setReveal(false);
                    toggleRef.current?.focus();
                  }}
                >
                  Save for this tab
                </Button>
                <button className="forget-key" onClick={() => onKey("")}>
                  Forget this key
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {local && (
        <div className="local-connection">
          <label htmlFor="api-endpoint">API endpoint</label>
          <input
            id="api-endpoint"
            autoComplete="off"
            spellCheck={false}
            value={connection.baseURL}
            onChange={(event) =>
              onEndpoint(event.target.value, connection.model)
            }
            placeholder="http://localhost:11434/v1"
          />
          <label htmlFor="local-model">Model ID</label>
          <input
            id="local-model"
            value={connection.model}
            onChange={(event) =>
              onEndpoint(connection.baseURL, event.target.value)
            }
            placeholder="Exact model ID from your server"
          />
        </div>
      )}
      {status === "ready" &&
        source === "fallback" &&
        connection.provider !== "demo" &&
        !local &&
        (!compact || keyPanelOpen) &&
        (!needsApiKey(connection.provider) || hasKey) && (
          <button className="connection-toggle" onClick={onRetry}>
            Retry catalog
          </button>
        )}
      {unavailable && (
        <p className="error" role="alert">
          Model unavailable in the live catalog. Choose another model before
          convening.
        </p>
      )}
      {connection.provider !== "demo" &&
        !local &&
        (!compact || expanded || !hasKey) && (
          <p className="catalog-state" role="status">
            {status === "loading"
              ? "Loading models…"
              : needsApiKey(connection.provider) && !hasKey
                ? catalogs?.[connection.provider]?.length
                  ? "Models.dev catalog · add a key to check your provider access."
                  : "Popular models · add a key to fetch your provider’s catalog."
                : source === "live"
                  ? "Live catalog loaded"
                  : !hasKey && catalogs?.[connection.provider]?.length
                    ? "Models.dev catalog loaded"
                    : catalogs?.[connection.provider]?.length
                      ? "Connection failed or catalog unavailable · showing Models.dev models. Check your key or try a run."
                      : "Connection failed or catalog unavailable · showing popular models. You can still try a run."}
          </p>
        )}
    </div>
  );
};
