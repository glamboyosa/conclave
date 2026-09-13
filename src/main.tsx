import { Analytics } from "@vercel/analytics/react";
import { StrictMode } from "react";
import { preload } from "react-dom";
import fontUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import { createRoot } from "react-dom/client";
import App from "./App";
import { sanitizeAnalyticsEvent } from "./analytics";
import "./styles.css";

preload(fontUrl, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {import.meta.env.PROD && <Analytics beforeSend={sanitizeAnalyticsEvent} debug={false} />}
  </StrictMode>,
);
