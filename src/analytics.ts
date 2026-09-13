import type { AnalyticsProps } from "@vercel/analytics/react";

export const sanitizeAnalyticsEvent: NonNullable<AnalyticsProps["beforeSend"]> = (event) => {
  if (event.type !== "pageview") return null;
  const url = new URL(event.url);

  return { type: "pageview", url: `${url.origin}/` };
};
