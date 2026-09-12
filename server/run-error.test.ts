import { APICallError, RetryError } from "ai";
import { expect, it } from "vitest";
import { describeRunError } from "./run-error";

it("reports provider billing failures without leaking request credentials", () => {
  const error = new APICallError({
    message: "Insufficient credits for sk-test-private-key",
    url: "https://test.invalid",
    requestBodyValues: { key: "sk-test-private-key" },
    statusCode: 402,
  });

  const message = describeRunError(error, ["sk-test-private-key"]);
  expect(message).toContain("Insufficient credits");
  expect(message).toContain("billing");
  expect(message).not.toContain("sk-test-private-key");
  expect(message).not.toContain("test.invalid");
});

it("unwraps exhausted SDK retries and identifies transient failures with HTTP 200", () => {
  const error = new APICallError({
    message: "Upstream error from Nvidia: Service temporarily overloaded",
    url: "https://test.invalid",
    requestBodyValues: {},
    statusCode: 200,
  });

  const retry = new RetryError({
    message: "Retries exhausted",
    reason: "maxRetriesExceeded",
    errors: [error],
  });

  expect(describeRunError(retry, [])).toContain(
    "Service temporarily overloaded",
  );
  expect(describeRunError(retry, [])).toContain("Try again shortly");
});

it("distinguishes exhausted credits from a transient HTTP 429 rate limit", () => {
  const error = new APICallError({
    message: "You have no credits remaining. Add credits to continue.",
    url: "https://test.invalid",
    requestBodyValues: {},
    statusCode: 429,
  });

  const message = describeRunError(error, []);
  expect(message).toContain("billing");
  expect(message).not.toContain("Try again shortly");
});
