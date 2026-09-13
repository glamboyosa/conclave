import { expect, it } from "vitest";
import { sanitizeAnalyticsEvent } from "./analytics";

it("sends only the app origin in pageviews, excluding path, query and fragment data", () => {
  expect(sanitizeAnalyticsEvent({
    type: "pageview",
    url: "https://test.invalid/private-brief?apiKey=fake-key#private-message",
  })).toEqual({ type: "pageview", url: "https://test.invalid/" });
});

it("drops custom analytics events", () => {
  expect(sanitizeAnalyticsEvent({ type: "event", url: "https://test.invalid" })).toBeNull();
});
