import { randomUUID } from "node:crypto";
import { describeRunError, redactSecrets } from "./run-error.js";
import { createModelsDevCatalog } from "./models-dev.js";
import { ApiError, buildModel, connectionSchema, fetchProviderModels } from "./provider-models.js";
import { traceAI } from "./telemetry.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { discussDecision, runModelCouncil } from "../src/council.js";
import {
  buildDemoRun,
  type CouncilEvent,
  type DiscussionEvent,
} from "../src/engine.js";
import {
  providerMeta,
  parseProvider,
  popularModels,
  type CatalogModel,
} from "../src/providers.js";

import {
  resultSchema,
  discussionMessageSchema,
  revisionContextSchema,
} from "../src/schemas.js";

const requestSchema = z.object({
  brief: z.string().trim().min(20).max(4000),
  connection: connectionSchema.optional(),
  revision: revisionContextSchema.optional(),
});

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: string,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(body);
}

const stream = <Event>(res: ServerResponse) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");

  return (event: Event) => {
    if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
  };
};

type ApiRequest = IncomingMessage & { body?: unknown };

type ApiHandler = (
  req: ApiRequest,
  res: ServerResponse,
) => void | Promise<void>;

const readRequestBody = async (req: ApiRequest, res: ServerResponse) => {
  let body = "";

  if (req.body !== undefined) {
    const rawBody = z.string().safeParse(req.body);
    body = rawBody.success ? rawBody.data : JSON.stringify(req.body);
  } else {
    for await (const chunk of req) {
      if (body.length <= 131_072) body += chunk;
    }
  }

  if (body.length > 131_072) {
    json(res, 413, JSON.stringify({ error: "Request is too large." }));

    return null;
  }

  return body;
};

export const createApiHandler = (
  getEnv: () => Record<string, string | undefined> = () => process.env,
) => {
  const loadCatalog = createModelsDevCatalog();
  let modelCatalog: { expiresAt: number; models: CatalogModel[] } | null = null;

  const routes = new Map<string, ApiHandler>();

  const register = (method: string, path: string, handler: ApiHandler) =>
    routes.set(path, (req, res) => {
      if (req.method !== method)
        return json(res, 405, JSON.stringify({ error: "Method not allowed." }));

      return handler(req, res);
    });

  register("GET", "/api/availability", (_req, res) => {
    const env = getEnv();

    return json(
      res,
      200,
      JSON.stringify({
        sharedOpenRouter: Boolean(env.OPENROUTER_API_KEY?.trim()),
      }),
    );
  });

  register("GET", "/api/catalog", async (_req, res) => {
    try {
      const catalogs = await loadCatalog();

      return json(res, 200, JSON.stringify({ catalogs, source: "models.dev" }));
    } catch {
      return json(
        res,
        503,
        JSON.stringify({
          error: "Models.dev catalog unavailable. Try again shortly.",
        }),
      );
    }
  });

  register("GET", "/api/models", async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      const providerId = url.searchParams.get("provider") ?? "openrouter";

      if (!Object.prototype.hasOwnProperty.call(providerMeta, providerId))
        return json(res, 400, JSON.stringify({ error: "Unknown provider." }));
      const provider = parseProvider(providerId);

      const keyHeader = req.headers["x-conclave-key"];

      const key =
        (Array.isArray(keyHeader) ? keyHeader[0] : keyHeader)?.trim() ?? "";

      if (
        (provider === "openrouter" || provider === "nvidia") &&
        !key &&
        modelCatalog &&
        modelCatalog.expiresAt > Date.now()
      ) {
        const cached =
          provider === "nvidia"
            ? modelCatalog.models.filter((model) =>
                model.id.startsWith("nvidia/"),
              )
            : modelCatalog.models;

        if (cached.length) {
          return json(
            res,
            200,
            JSON.stringify({ models: cached, source: "live" }),
          );
        }
      }

      try {
        const models = await fetchProviderModels(provider, key);

        if (!models.length) throw new Error("Empty catalog");

        if (provider === "openrouter" && !key) {
          modelCatalog = { expiresAt: Date.now() + 5 * 60_000, models };
        }

        return json(res, 200, JSON.stringify({ models, source: "live" }));
      } catch {
        return json(
          res,
          200,
          JSON.stringify({
            models: popularModels(provider),
            source: "fallback",
          }),
        );
      }
    } catch {
      return json(res, 400, JSON.stringify({ error: "Unknown provider." }));
    }
  });

  register("POST", "/api/discuss", async (req, res) => {
    const body = await readRequestBody(req, res);

    if (body === null) return;
    const runId = randomUUID();
    res.setHeader("X-Conclave-Run-ID", runId);
    let secrets: string[] = [];

    try {
      const parsed = z
        .object({
          brief: z.string().max(4000),
          memo: resultSchema,
          messages: z.array(discussionMessageSchema).min(1).max(40),
          connection: connectionSchema,
        })
        .safeParse(JSON.parse(body));

      if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user")
        return json(
          res,
          400,
          JSON.stringify({
            error:
              "Add a message of up to 4,000 characters to discuss this decision.",
          }),
        );
      const { brief, memo, messages, connection } = parsed.data;

      if (connection.provider === "demo")
        return json(
          res,
          400,
          JSON.stringify({
            error:
              "Choose a live model for replies. Offline previews support notes only.",
          }),
        );
      const env = getEnv();
      secrets = [connection.apiKey, env.OPENROUTER_API_KEY ?? ""];
      const model = buildModel(connection, env);
      const safeModel = redactSecrets(connection.model, secrets);

      if (req.headers.accept?.includes("application/x-ndjson")) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        res.on("close", abort);
        const send = stream<DiscussionEvent>(res);

        try {
          await traceAI(
            env,
            "conclave.discussion",
            runId,
            connection.provider,
            safeModel,
            () =>
              discussDecision(
                model,
                brief,
                memo,
                messages,
                (text) => send({ type: "delta", text }),
                controller.signal,
              ),
          );
          send({ type: "done" });
        } catch (cause) {
          if (!controller.signal.aborted) {
            const reason = describeRunError(cause, secrets);
            console.error("[Conclave discussion failed]", { runId, reason });
            send({ type: "error", error: `${reason} Run ID: ${runId}` });
          }
        } finally {
          res.off("close", abort);
          res.end();
        }

        return;
      }

      const text = await traceAI(
        env,
        "conclave.discussion",
        runId,
        connection.provider,
        safeModel,
        () => discussDecision(model, brief, memo, messages),
      );

      return json(res, 200, JSON.stringify({ text }));
    } catch (cause) {
      if (cause instanceof SyntaxError)
        return json(
          res,
          400,
          JSON.stringify({ error: "The request was not valid JSON." }),
        );

      if (cause instanceof ApiError)
        return json(
          res,
          cause.status,
          JSON.stringify({ error: cause.message }),
        );
      const reason = describeRunError(cause, secrets);
      console.error("[Conclave discussion failed]", { runId, reason });

      return json(
        res,
        502,
        JSON.stringify({ error: `${reason} Run ID: ${runId}` }),
      );
    }
  });

  register("POST", "/api/run", async (req, res) => {
    const body = await readRequestBody(req, res);

    if (body === null) return;

    try {
      const parsed = requestSchema.safeParse(JSON.parse(body));

      if (body.length > 16_384 && (!parsed.success || !parsed.data.revision))
        return json(
          res,
          413,
          JSON.stringify({ error: "Request is too large." }),
        );

      if (!parsed.success) {
        return json(
          res,
          400,
          JSON.stringify({ error: "Brief must be 20–4,000 characters." }),
        );
      }

      const { brief, connection, revision } = parsed.data;

      if (!connection || connection.provider === "demo") {
        return json(
          res,
          200,
          JSON.stringify({ ...buildDemoRun(brief), mode: "local" }),
        );
      }

      if (!connection.model.trim()) {
        return json(
          res,
          400,
          JSON.stringify({ error: "Choose a model in the model picker." }),
        );
      }

      if (
        (connection.provider === "ollama" ||
          connection.provider === "lmstudio" ||
          connection.provider === "custom") &&
        !connection.baseURL.trim()
      ) {
        return json(
          res,
          400,
          JSON.stringify({ error: "A local API endpoint is required." }),
        );
      }

      const env = getEnv();
      const model = buildModel(connection, env);
      const runId = randomUUID();
      res.setHeader("X-Conclave-Run-ID", runId);
      const secrets = [connection.apiKey, env.OPENROUTER_API_KEY ?? ""];
      const safeModel = redactSecrets(connection.model, secrets);
      let stage = "perspectives";

      const failureMessage = (cause: unknown) => {
        const reason = describeRunError(cause, secrets);

        const message = `${providerMeta[connection.provider].name} / ${safeModel} failed during ${stage === "chair" ? "Chair synthesis" : "assessments"}: ${reason} Run ID: ${runId}`;
        console.error("[Conclave run failed]", {
          runId,
          provider: connection.provider,
          model: safeModel,
          stage,
          reason,
          errorType: cause instanceof Error ? cause.name : "UnknownError",
        });

        return message;
      };

      if (req.headers.accept?.includes("application/x-ndjson")) {
        const write = stream<CouncilEvent>(res);

        const send = (event: CouncilEvent) => {
          if (event.type === "stage") stage = event.stage;
          write(event);
        };

        try {
          const council = await traceAI(
            env,
            "conclave.council",
            runId,
            connection.provider,
            safeModel,
            () => runModelCouncil(model, brief, send, revision),
          );

          send({ type: "result", result: council });
        } catch (cause) {
          send({ type: "error", error: failureMessage(cause) });
        }

        res.end();

        return;
      }

      let council;

      try {
        council = await traceAI(
          env,
          "conclave.council",
          runId,
          connection.provider,
          safeModel,
          () =>
            runModelCouncil(
              model,
              brief,
              (event) => {
                if (event.type === "stage") stage = event.stage;
              },
              revision,
            ),
        );
      } catch (cause) {
        return json(res, 502, JSON.stringify({ error: failureMessage(cause) }));
      }

      return json(res, 200, JSON.stringify(council));
    } catch (cause) {
      if (cause instanceof ApiError) {
        return json(
          res,
          cause.status,
          JSON.stringify({ error: cause.message }),
        );
      }

      const message =
        cause instanceof SyntaxError
          ? "The request was not valid JSON."
          : "The model request failed. Check the endpoint, model, and key.";

      return json(
        res,
        cause instanceof SyntaxError ? 400 : 500,
        JSON.stringify({ error: message }),
      );
    }
  });

  return async (req: ApiRequest, res: ServerResponse) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const handler = routes.get(path);

    if (!handler)
      return json(res, 404, JSON.stringify({ error: "Unknown API route." }));
    await handler(req, res);
  };
};

export const apiPlugin = (getEnv: () => Record<string, string | undefined>) => {
  const handler = createApiHandler(getEnv);

  const attach = (
    server: Pick<import("vite").ViteDevServer, "middlewares">,
  ) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();
      void handler(req, res).catch(next);
    });
  };

  return {
    name: "conclave-api",
    configureServer: attach,
    configurePreviewServer: attach,
  } satisfies import("vite").Plugin;
};
