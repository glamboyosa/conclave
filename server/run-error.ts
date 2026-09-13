import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

export const redactSecrets = (message: string, secrets: string[]) => {
  const variants = secrets.flatMap((secret) => {
    const trimmed = secret.trim();

    return trimmed ? [secret, trimmed, encodeURIComponent(trimmed)] : [];
  });

  const safe = variants.reduce((text, secret) => text.split(secret).join("[redacted]"), message);

  return safe.replace(/Bearer\s+\S+|sk-[\w-]+/gi, "[redacted]").slice(0, 600);
};

export const describeRunError = (cause: unknown, secrets: string[]) => {
  const error = RetryError.isInstance(cause) ? cause.lastError : cause;

  if (APICallError.isInstance(error)) {
    const detail = redactSecrets(error.message, secrets);
    const status = error.statusCode;

    const action =
      status === 401 || status === 403
        ? "Check your key and model access."
        : status === 402 ||
            /no credits|insufficient.quota|insufficient.*credit|billing/i.test(
              detail,
            )
          ? "Check your provider credits or billing."
          : status === 429 ||
              (status !== undefined && status >= 500) ||
              /overload|temporarily|busy|timeout/i.test(detail)
            ? "Try again shortly or choose another model."
            : status === 404
              ? "Choose a model available to your key."
              : "Check the provider message below.";

    return `${detail || "The provider rejected the request."} ${action}`;
  }

  if (NoObjectGeneratedError.isInstance(error))
    return error.finishReason === "length"
      ? "The model stopped before completing the structured response. Try another model."
      : "The model did not return a valid decision response. Try again or choose another model.";

  if (error instanceof Error && /timeout|abort/i.test(error.name))
    return "The model request timed out. Try again or choose another model.";

  return "The model request failed. Check the server log using the run ID.";
};
