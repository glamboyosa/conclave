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

const free = (id: string, name: string): CatalogModel => ({
  id,
  name,
  free: true,
});

const paid = (id: string, name: string): CatalogModel => ({
  id,
  name,
  free: false,
});

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
      free("nvidia/nemotron-3-super-120b-a12b:free", "NVIDIA Nemotron 3 Super"),
      paid("anthropic/claude-sonnet-4.5", "Anthropic Claude Sonnet 4.5"),
      paid("openai/gpt-5-mini", "OpenAI GPT-5 mini"),
      paid("moonshotai/kimi-k2-0905", "Moonshot Kimi K2"),
      paid("google/gemini-2.5-flash", "Google Gemini 2.5 Flash"),
      paid("deepseek/deepseek-chat-v3.1", "DeepSeek V3.1"),
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    key: "required",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-5",
    popular: [
      paid("claude-opus-4-5", "Claude Opus 4.5"),
      paid("claude-sonnet-4-5", "Claude Sonnet 4.5"),
      paid("claude-haiku-4-5", "Claude Haiku 4.5"),
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    key: "required",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-5-mini",
    popular: [
      paid("gpt-5", "GPT-5"),
      paid("gpt-5-mini", "GPT-5 mini"),
      paid("gpt-5-nano", "GPT-5 nano"),
    ],
  },
  google: {
    id: "google",
    name: "Google",
    key: "required",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash",
    popular: [
      paid("gemini-2.5-pro", "Gemini 2.5 Pro"),
      paid("gemini-2.5-flash", "Gemini 2.5 Flash"),
      paid("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"),
    ],
  },
  moonshot: {
    id: "moonshot",
    name: "Kimi (Moonshot)",
    key: "required",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    defaultModel: "kimi-k2-0905-preview",
    popular: [
      paid("kimi-k2-0905-preview", "Kimi K2"),
      paid("kimi-k2-turbo-preview", "Kimi K2 Turbo"),
      paid("kimi-latest", "Kimi Latest"),
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    key: "required",
    keyUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
    popular: [
      paid("deepseek-chat", "DeepSeek Chat"),
      paid("deepseek-reasoner", "DeepSeek Reasoner"),
    ],
  },
  xai: {
    id: "xai",
    name: "xAI",
    key: "required",
    keyUrl: "https://console.x.ai/",
    defaultModel: "grok-4-fast-reasoning",
    popular: [
      paid("grok-4", "Grok 4"),
      paid("grok-4-fast-reasoning", "Grok 4 Fast"),
      paid("grok-code-fast-1", "Grok Code Fast"),
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    key: "required",
    keyUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    popular: [
      paid("llama-3.3-70b-versatile", "Llama 3.3 70B"),
      paid("openai/gpt-oss-120b", "GPT-OSS 120B"),
      paid("qwen/qwen3-32b", "Qwen3 32B"),
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    key: "required",
    keyUrl: "https://console.mistral.ai/api-keys",
    defaultModel: "mistral-large-latest",
    popular: [
      paid("mistral-large-latest", "Mistral Large"),
      paid("mistral-medium-latest", "Mistral Medium"),
      paid("mistral-small-latest", "Mistral Small"),
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
      free("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super 120B"),
      paid("nvidia/nemotron-3-nano-30b-a3b", "Nemotron 3 Nano 30B"),
      paid("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra"),
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
