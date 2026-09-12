import { Box } from "lucide-react";
import type { ProviderId } from "../../providers";

export const ProviderLogo = ({ provider }: { provider: ProviderId }) => {
  if (["demo", "ollama", "lmstudio", "custom"].includes(provider))
    return <Box size={17} aria-hidden="true" />;
  const id = provider === "moonshot" ? "moonshotai" : provider;

  return (
    <img
      className="provider-logo"
      src={`/provider-logos/${id}.svg`}
      width={17}
      height={17}
      alt=""
      aria-hidden="true"
    />
  );
};
