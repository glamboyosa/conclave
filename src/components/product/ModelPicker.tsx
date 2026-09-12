import { ProviderLogo } from "./ProviderLogo";
import { useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  pickerProviders,
  isRecentModel,
  popularModels,
  providerMeta,
  providerName,
  usesSharedNvidiaRoute,
  type CatalogModel,
  type ProviderId,
  type ModelConnection,
} from "../../providers";

const rowHeight = 72;

const providerOrder = (provider: ProviderId) => {
  if (provider === "openai") return 0;

  if (provider === "anthropic") return 1;

  return pickerProviders.indexOf(provider) + 2;
};

const overscan = 4;

const accessOrder = (provider: ProviderId, model: string) => {
  if (provider === "demo") return 0;

  if (usesSharedNvidiaRoute(provider, model)) return 1;

  return provider === "openrouter" || provider === "nvidia" ? 3 : 2;
};

type Props = {
  side?: "top" | "bottom";
  connection: ModelConnection;
  models: CatalogModel[];
  catalogs?: Partial<Record<ProviderId, CatalogModel[]>>;
  authenticatedCatalog?: boolean;
  onSelect: (value: string) => void;
};

export const ModelPicker = ({
  connection,
  models,
  catalogs = {},
  authenticatedCatalog = false,
  onSelect,
  side = "top",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [active, setActive] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [pointerMotion, setPointerMotion] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const resetList = () => {
    setActive(0);
    setScrollTop(0);

    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const choices = useMemo(() => {
    if (!open) return [];
    const search = query.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    return pickerProviders
      .flatMap((provider) => {
        const local = ["ollama", "lmstudio", "custom"].includes(provider);

        const catalog =
          provider === "demo"
            ? [
                {
                  id: providerMeta.demo.defaultModel,
                  name: "Offline council",
                  free: true,
                },
              ]
            : local
              ? [
                  {
                    id: providerMeta[provider].defaultModel,
                    name: providerName(provider),
                    free: false,
                  },
                ]
              : provider === connection.provider && authenticatedCatalog
                ? models.map((model) => ({
                    ...(catalogs[provider]?.find(
                      (entry) => entry.id === model.id,
                    ) ??
                      popularModels(provider).find(
                        (entry) => entry.id === model.id,
                      )),
                    ...model,
                  }))
                : (catalogs[provider] ??
                  (provider === connection.provider
                    ? models
                    : popularModels(provider)));

        const newestRelease = catalog.reduce(
          (latest, model) =>
            model.releaseDate &&
            model.releaseDate <= today &&
            model.releaseDate > latest
              ? model.releaseDate
              : latest,
          "",
        );

        return catalog.flatMap((model) => {
          const pinnedFreeModel =
            usesSharedNvidiaRoute(provider, model.id) &&
            model.id === "nvidia/nemotron-3-super-120b-a12b:free";

          if (
            provider !== "demo" &&
            !local &&
            !pinnedFreeModel &&
            !isRecentModel(model)
          )
            return [];

          const family =
            provider === "demo" || usesSharedNvidiaRoute(provider, model.id)
              ? "ready"
              : local
                ? "local"
                : "byok";

          if (group !== "all" && family !== group) return [];

          if (
            !`${providerName(provider)} ${model.name} ${model.id}`
              .toLowerCase()
              .includes(search)
          )
            return [];

          return [
            {
              provider,
              model,
              local,
              newest: Boolean(
                newestRelease && model.releaseDate === newestRelease,
              ),
            },
          ];
        });
      })
      .sort(
        (a, b) =>
          accessOrder(a.provider, a.model.id) -
            accessOrder(b.provider, b.model.id) ||
          (group === "byok"
            ? providerOrder(a.provider) - providerOrder(b.provider)
            : 0) ||
          (b.model.releaseDate ?? "").localeCompare(a.model.releaseDate ?? ""),
      );
  }, [
    open,
    connection.provider,
    models,
    catalogs,
    authenticatedCatalog,
    query,
    group,
  ]);

  const start = Math.max(
    0,
    Math.min(Math.floor(scrollTop / rowHeight) - overscan, choices.length - 1),
  );

  const end = Math.min(
    choices.length,
    start + Math.ceil(350 / rowHeight) + overscan * 2,
  );

  const selected =
    catalogs[connection.provider]?.find(
      (model) => model.id === connection.model,
    )?.name ??
    models.find((model) => model.id === connection.model)?.name ??
    popularModels(connection.provider).find(
      (model) => model.id === connection.model,
    )?.name ??
    connection.model;

  const choose = (index: number) => {
    const choice = choices[index];

    if (!choice) return;
    onSelect(`${choice.provider}|${choice.model.id}`);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(value, details) => {
        setPointerMotion(
          details.event.type.startsWith("pointer") ||
            details.event.type === "click",
        );
        setOpen(value);
        setQuery("");
        resetList();
      }}
    >
      <Popover.Trigger
        className="model-trigger"
        aria-label="Model"
        data-pointer-motion={pointerMotion || undefined}
      >
        <span>
          <small>{providerName(connection.provider)}</small>
          <strong>{selected || "Choose a local model"}</strong>
        </span>
        <ChevronDown size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="picker-positioner"
          align="start"
          side={side}
          collisionAvoidance={{
            side: "none",
            align: "shift",
            fallbackAxisSide: "none",
          }}
          sideOffset={8}
          collisionPadding={12}
        >
          <Popover.Popup
            className="model-dialog"
            data-pointer-motion={pointerMotion || undefined}
          >
            <div className="picker-heading">
              <div>
                <Popover.Title>Choose model</Popover.Title>
                <Popover.Description>
                  Free NVIDIA or your own provider.
                </Popover.Description>
              </div>
              <Popover.Close
                className="icon-button"
                aria-label="Close model picker"
              >
                <X size={18} />
              </Popover.Close>
            </div>
            <div className="picker-search">
              <Search size={18} />
              <input
                autoFocus
                aria-label="Search models"
                role="combobox"
                aria-controls="model-options"
                aria-expanded="true"
                aria-activedescendant={
                  choices[active] && active >= start && active < end
                    ? `model-option-${active}`
                    : undefined
                }
                placeholder="Search models or providers…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetList();
                }}
                onKeyDown={(event) => {
                  if (
                    ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                  ) {
                    event.preventDefault();

                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? choices.length - 1
                          : Math.max(
                              0,
                              Math.min(
                                choices.length - 1,
                                active + (event.key === "ArrowDown" ? 1 : -1),
                              ),
                            );

                    setActive(next);
                    const list = listRef.current;

                    if (list) {
                      const top = next * rowHeight;

                      if (top < list.scrollTop) list.scrollTop = top;
                      else if (
                        top + rowHeight >
                        list.scrollTop + list.clientHeight
                      )
                        list.scrollTop = top + rowHeight - list.clientHeight;
                      setScrollTop(list.scrollTop);
                    }
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    choose(active);
                  }
                }}
              />
            </div>
            <div className="picker-filters" aria-label="Provider groups">
              {[
                ["all", "All"],
                ["ready", "Ready to use"],
                ["byok", "Your provider"],
                ["local", "Local / advanced"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={group === id}
                  onClick={() => {
                    setGroup(id);
                    resetList();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="picker-options"
              ref={listRef}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
              style={{
                height: Math.min(
                  350,
                  Math.max(rowHeight, choices.length * rowHeight),
                ),
              }}
              id="model-options"
              role="listbox"
              aria-label="Models"
            >
              <div
                className="picker-window"
                style={{ height: choices.length * rowHeight }}
              >
                {choices
                  .slice(start, end)
                  .map(({ provider, model, local, newest }, offset) => {
                    const index = start + offset;

                    const groupStart =
                      group === "byok" &&
                      (index === 0 ||
                        choices[index - 1]?.provider !== provider);

                    return (
                      <button
                        type="button"
                        role="option"
                        id={`model-option-${index}`}
                        aria-posinset={index + 1}
                        aria-setsize={choices.length}
                        style={{
                          position: "absolute",
                          top: index * rowHeight,
                          height: rowHeight,
                        }}
                        aria-selected={
                          connection.provider === provider &&
                          connection.model === model.id
                        }
                        aria-label={`${model.name}${model.free ? " · Free" : ""}`}
                        tabIndex={-1}
                        className={`${index === active ? "highlighted" : ""} ${groupStart ? "provider-group-start" : ""}`}
                        key={`${provider}|${model.id}`}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(index)}
                      >
                        {groupStart && (
                          <span
                            className="provider-group-label"
                            aria-hidden="true"
                          >
                            {providerName(provider)}
                          </span>
                        )}
                        <span className="model-identity">
                          <ProviderLogo provider={provider} />
                          <span className="model-description">
                            <strong
                              title={
                                model.releaseDate
                                  ? `Released ${model.releaseDate}`
                                  : undefined
                              }
                            >
                              {model.name}
                              {newest && (
                                <span
                                  className="newest-model"
                                  title="Newest dated release listed for this provider in Models.dev"
                                >
                                  Newest
                                </span>
                              )}
                            </strong>
                            <small>
                              {providerName(provider)}
                              {provider === "nvidia"
                                ? " via OpenRouter"
                                : provider === "openrouter" ||
                                    local ||
                                    provider === "demo"
                                  ? ""
                                  : " · Direct"}
                              {model.context
                                ? ` · ${Math.round(model.context / 1000)}k context`
                                : ""}
                              {model.images ? " · Images" : ""}
                            </small>
                          </span>
                        </span>
                        <span className="model-access">
                          {provider === "demo"
                            ? "Offline"
                            : local
                              ? "Local"
                              : usesSharedNvidiaRoute(provider, model.id)
                                ? "Free · Shared"
                                : model.free
                                  ? "Free · BYOK"
                                  : "BYOK"}
                        </span>
                        {connection.provider === provider &&
                          connection.model === model.id && <Check size={16} />}
                      </button>
                    );
                  })}
              </div>
              {!choices.length && (
                <p className="picker-empty">
                  No matching models. Try another name or provider.
                </p>
              )}
            </div>
            <p className="picker-footnote">
              Hosted models released in the last 180 days, plus free Nemotron 3
              Super. Shared access covers free NVIDIA models via OpenRouter.
              Other hosted models require your key.
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
