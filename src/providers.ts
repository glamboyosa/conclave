export type ProviderId =
  | "demo"
  | "openrouter"
  | "anthropic"
  | "openai"
  | "google"
  | "moonshot"
  | "deepseek"
  | "xai"
  | "groq"
  | "mistral"
  | "nvidia"
  | "ollama"
  | "lmstudio"
  | "custom";

export type ModelConnection = {
  provider: ProviderId;
  model: string;
  baseURL: string;
  apiKey: string;
};

export type CatalogModel = {
  id: string;
  name: string;
  free: boolean;
  context?: number;
  images?: boolean;
  reasoning?: boolean;
  releaseDate?: string;
  inputCost?: number;
  outputCost?: number;
};

export type ProviderMeta = {
  id: ProviderId;
  name: string;
  /**
   * "none"     — no key involved (offline council, local servers).
   * "optional" — runs without a key on Conclave's shared key; BYOK unlocks the full catalog.
   * "required" — bring your own key.
   */
  key: "none" | "optional" | "required";
  /** Where the user can create an API key. */
  keyUrl?: string;
  /** Name shown on the key field when it differs from the provider name (NVIDIA runs on OpenRouter keys). */
  keyName?: string;
  defaultModel: string;
  /** Curated models shown before (or instead of) the live catalog. */
  popular: CatalogModel[];
};

export const providerMeta: Record<ProviderId, ProviderMeta> = {
  demo: {
    id: "demo",
    name: "Offline",
    key: "none",
    defaultModel: "Offline council",
    popular: [],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    key: "optional",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    popular: [
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        name: "NVIDIA Nemotron 3 Super (free)",
        free: true,
        releaseDate: "2026-03-11",
      },
      {
        id: "anthropic/claude-fable-5.1",
        name: "Anthropic Claude Fable 5.1",
        free: false,
        releaseDate: "2026-09-01",
      },
      {
        id: "openai/gpt-6-astra",
        name: "OpenAI GPT-6 Astra",
        free: false,
        releaseDate: "2026-09-04",
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    key: "required",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-fable-5-1",
    popular: [
      {
        id: "claude-fable-5-1",
        name: "Claude Fable 5.1",
        free: false,
        releaseDate: "2026-09-01",
      },
      {
        id: "claude-opus-5",
        name: "Claude Opus 5",
        free: false,
        releaseDate: "2026-07-24",
      },
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        free: false,
        releaseDate: "2026-06-29",
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    key: "required",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-6-astra",
    popular: [
      {
        id: "gpt-6-astra",
        name: "GPT-6 Astra",
        free: false,
        releaseDate: "2026-09-04",
      },
      {
        id: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        free: false,
        releaseDate: "2026-07-09",
      },
      {
        id: "gpt-5.6-luna",
        name: "GPT-5.6 Luna",
        free: false,
        releaseDate: "2026-07-09",
      },
    ],
  },
  google: {
    id: "google",
    name: "Google",
    key: "required",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.8-flash",
    popular: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        free: false,
        releaseDate: "2026-09-02",
      },
      {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        free: false,
        releaseDate: "2026-08-13",
      },
      {
        id: "gemini-flash-latest",
        name: "Gemini Flash Latest",
        free: false,
        releaseDate: "2026-08-13",
      },
    ],
  },
  moonshot: {
    id: "moonshot",
    name: "Kimi (Moonshot)",
    key: "required",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    defaultModel: "kimi-k3",
    popular: [
      {
        id: "kimi-k3",
        name: "Kimi K3",
        free: false,
        releaseDate: "2026-07-16",
      },
      {
        id: "kimi-k2.7-code-highspeed",
        name: "Kimi K2.7 Code HighSpeed",
        free: false,
        releaseDate: "2026-06-12",
      },
      {
        id: "kimi-k2.7-code",
        name: "Kimi K2.7 Code",
        free: false,
        releaseDate: "2026-06-12",
      },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    key: "required",
    keyUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-v4-flash",
    popular: [
      {
        id: "deepseek-v4-flash-vision-exp",
        name: "DeepSeek V4 Flash Vision Exp",
        free: false,
        releaseDate: "2026-09-10",
      },
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        free: false,
        releaseDate: "2026-09-10",
      },
      {
        id: "deepseek-flash",
        name: "DeepSeek V4.1 Flash",
        free: false,
        releaseDate: "2026-09-10",
      },
    ],
  },
  xai: {
    id: "xai",
    name: "xAI",
    key: "required",
    keyUrl: "https://console.x.ai/",
    defaultModel: "grok-4.6",
    popular: [
      {
        id: "grok-4.6",
        name: "Grok 4.6",
        free: false,
        releaseDate: "2026-08-12",
      },
      {
        id: "grok-4.5",
        name: "Grok 4.5",
        free: false,
        releaseDate: "2026-07-08",
      },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    key: "required",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "qwen/qwen3.8-27b",
    popular: [
      {
        id: "qwen/qwen3.8-27b",
        name: "Qwen3.8 27B",
        free: false,
        releaseDate: "2026-08-14",
      },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    key: "required",
    keyUrl: "https://console.mistral.ai/api-keys",
    defaultModel: "zai-glm-5-2",
    popular: [
      {
        id: "zai-glm-5-2",
        name: "GLM-5.2",
        free: false,
        releaseDate: "2026-06-13",
      },
    ],
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA",
    key: "optional",
    keyUrl: "https://openrouter.ai/keys",
    keyName: "OpenRouter",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    popular: [
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        name: "Nemotron 3 Super (free)",
        free: true,
        releaseDate: "2026-03-11",
      },
      {
        id: "nvidia/nemotron-3.5-lightning",
        name: "Nemotron 3.5 Lightning 30B A3B",
        free: false,
        releaseDate: "2026-08-11",
      },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        name: "Nemotron 3 Ultra 550B A55B",
        free: false,
        releaseDate: "2026-06-04",
      },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    key: "none",
    defaultModel: "qwen3:8b",
    popular: [],
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    key: "none",
    defaultModel: "local-model",
    popular: [],
  },
  custom: {
    id: "custom",
    name: "OpenAI-compatible",
    key: "none",
    defaultModel: "",
    popular: [],
  },
};

/** Providers offered by the pickers, in display order. */
export const pickerProviders: ProviderId[] = [
  "openrouter",
  "demo",
  "anthropic",
  "openai",
  "google",
  "moonshot",
  "deepseek",
  "xai",
  "groq",
  "mistral",
  "nvidia",
  "ollama",
  "lmstudio",
  "custom",
];

export const defaultConnection: ModelConnection = {
  provider: "openrouter",
  model: providerMeta.openrouter.defaultModel,
  baseURL: "",
  apiKey: "",
};

export function providerName(provider: ProviderId) {
  return providerMeta[provider]?.name ?? provider;
}

export function needsApiKey(provider: ProviderId) {
  return providerMeta[provider]?.key === "required";
}

export function keyOptional(provider: ProviderId) {
  return providerMeta[provider]?.key === "optional";
}

export const usesSharedNvidiaRoute = (
  provider: ProviderId,
  model: string,
): boolean =>
  (provider === "openrouter" || provider === "nvidia") &&
  model.startsWith("nvidia/") &&
  model.endsWith(":free");

/** In-memory key slot — NVIDIA shares OpenRouter's key, since NVIDIA runs through OpenRouter. */
export function keySlot(provider: ProviderId): ProviderId {
  return provider === "nvidia" ? "openrouter" : provider;
}

export function popularModels(provider: ProviderId): CatalogModel[] {
  return providerMeta[provider]?.popular ?? [];
}

export function parseProvider(value: string): ProviderId {
  // SAFETY: an own-property check restricts the value to the declared provider IDs.
  return Object.prototype.hasOwnProperty.call(providerMeta, value)
    ? (value as ProviderId)
    : "openrouter";
}

/** Endpoint preferences may be saved only when the URL contains no credentials or query data. */
export const persistableEndpoint = (value: string): string => {
  if (!value) return "";

  try {
    const url = new URL(value);

    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["http:", "https:"].includes(url.protocol)
    )
      return "";

    return value;
  } catch {
    return "";
  }
};

/** Only models with a known release within the last 180 UTC days belong in the hosted picker. */
export const isRecentModel = (model: CatalogModel, today = new Date()) => {
  if (!model.releaseDate) return false;
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - 180);
  const end = today.toISOString().slice(0, 10);

  return (
    model.releaseDate >= cutoff.toISOString().slice(0, 10) &&
    model.releaseDate <= end
  );
};
