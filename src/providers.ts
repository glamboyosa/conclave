export type ProviderId =
  | "demo"
  | "openrouter"
  | "nvidia"
  | "openai"
  | "ollama"
  | "lmstudio"
  | "custom";

export type ModelConnection = {
  provider: ProviderId;
  model: string;
  baseURL: string;
  apiKey: string;
};

export const providerPresets: Record<
  ProviderId,
  Omit<ModelConnection, "apiKey">
> = {
  demo: { provider: "demo", model: "Offline council", baseURL: "" },
  openrouter: {
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    baseURL: "https://openrouter.ai/api/v1",
  },
  nvidia: {
    provider: "nvidia",
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    baseURL: "https://integrate.api.nvidia.com/v1",
  },
  openai: {
    provider: "openai",
    model: "gpt-5-mini",
    baseURL: "https://api.openai.com/v1",
  },
  ollama: {
    provider: "ollama",
    model: "qwen3:8b",
    baseURL: "http://127.0.0.1:11434/v1",
  },
  lmstudio: {
    provider: "lmstudio",
    model: "local-model",
    baseURL: "http://127.0.0.1:1234/v1",
  },
  custom: {
    provider: "custom",
    model: "",
    baseURL: "",
  },
};

export const defaultConnection: ModelConnection = {
  ...providerPresets.demo,
  apiKey: "",
};

export function needsApiKey(provider: ProviderId) {
  return provider === "openrouter" || provider === "nvidia" || provider === "openai";
}

export function needsEndpoint(provider: ProviderId) {
  return provider === "custom";
}
