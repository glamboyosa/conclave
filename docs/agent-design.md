# Council and discussion design

Conclave runs a fixed council over a user's decision brief, then lets the user discuss or revise the resulting memo. A live council uses **one selected model** for three separate assessments and a final synthesis. The user can choose another provider or model for a later discussion reply or revision. Continuity comes from sending saved context with each request, not from transferring a provider session.

The workflow lives in [`src/council.ts`](../src/council.ts). [`server/api.ts`](../server/api.ts) validates requests, selects models, and serves the API. [`src/App.tsx`](../src/App.tsx) manages the current decision and connection; [`src/storage.ts`](../src/storage.ts) saves completed records in the browser. The wire contracts are in [`src/schemas.ts`](../src/schemas.ts) and [`src/engine.ts`](../src/engine.ts).

## Why this is a workflow

The three assessment roles are known before a run starts. They can examine the same brief independently and in parallel; the Chair needs their completed findings before it can synthesize a memo. Application code controls that sequence and validates each output. `ToolLoopAgent` supplies reusable role instructions and structured output, but the roles have no tools or authority to change the workflow. An open-ended agent conversation would add model calls without giving the council new evidence.

This design follows established guidance on choosing a bounded workflow for a predictable task:

- [AI SDK workflow patterns](https://ai-sdk.dev/docs/agents/workflows) shows parallel specialist calls followed by synthesis, and recommends starting with the simplest approach that meets the task's needs.
- [Anthropic's guide to building effective agents](https://www.anthropic.com/engineering/building-effective-agents) describes parallelization for independent perspectives and recommends adding complexity only when it improves outcomes.
- [Google Cloud's agent design guide](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system) describes a fixed parallel pattern and weighs task structure, latency, cost, and human involvement when choosing a design.

## Council run

1. `/api/run` validates a 20–4,000 character brief and the selected connection. **Offline council** returns a deterministic format preview from `buildDemoRun`; it makes no model call.
2. For a live run, opportunity (`optimist`), evidence (`analyst`), and risk (`skeptic`) execute concurrently through `Promise.all`. They receive the same brief and selected model, but not one another's findings. Each returns a structured thesis, explanation, signal, and 0–100 support score.
3. The Chair starts after all three findings pass their output schema. It receives the brief and the three findings, then returns a title, verdict, 0–100 support score, two to four tensions, exactly three actions, and two to five assumptions. The saved result also includes the findings and `mode: "live"`.
4. The browser saves the completed memo with the provider and model used for that run. It keeps up to 50 completed decisions in local storage.

The roles cannot research outside the supplied context. The Chair synthesizes disagreement; it does not ask the analysts to negotiate or rerun them when they differ.

The API emits newline-delimited JSON (`application/x-ndjson`) for live runs: a `perspectives` stage, a completion event for each analyst, a `chair` stage, then one `result` or `error`. The progress events do **not** contain partial findings or a token stream of the final memo. The client renders the memo only after receiving the complete result, then brings its start into view. The endpoint can also return a JSON result to callers that do not request the stream.

## Prompts, validation, and recovery

Role instructions require claims tied to the brief, explicit uncertainty, and a bounded action when evidence is weak. The brief and revision material are delimited as data; role instructions reject commands inside them. User-authored language guides the response language, with the latest user message taking precedence for revisions and follow-ups. The model is still responsible for following those instructions; delimiters are not a security boundary.

Each structured generation has a three-minute timeout and an output token cap. If a model returns an invalid structured object, Conclave makes one corrective attempt, except when generation stopped because of length. A narrow retry also covers transient OpenRouter overloads reported inside successful HTTP responses. Retries can make the whole council take longer than three minutes. A failed analyst prevents Chair synthesis; a failed Chair prevents a memo from being saved.

Zod validates request bodies, generated findings and memos, streamed events, and saved records at their boundaries. Model catalogs help users find candidates, but a listed model can still fail to produce valid structured output. Model-call failures include a run ID and a redacted, actionable reason where available. The client keeps the brief for another attempt; a failed revision leaves the earlier memo and discussion intact.

## Discussion and model changes

After a memo is saved, **Discuss this decision** sends a new request to `/api/discuss`. The request contains the original brief, saved memo, ordered discussion messages including the new user message, and the connection selected for **this** reply. `discussDecision` gives the model the brief and memo as context, then replays the messages in order. It does not depend on a provider-native conversation ID. Switching providers or models therefore affects the next reply while preserving the visible conversation. It does not change the original council's model or its saved verdict.

The API requires the last discussion message to be from the user. User messages are limited to 4,000 characters, assistant replies to 12,000 characters, and the discussion to 40 messages. The UI reserves room for a user message and reply before accepting another live follow-up. Offline council supports saved user notes but generates no AI reply.

Live replies stream `delta` events followed by `done`, or an `error`. The client buffers the first 1.5 seconds before revealing text, renders the reply as Markdown, and follows the latest content until the reader scrolls up. It saves the user message and assistant reply only after a complete response. An interrupted or failed reply leaves the draft available to retry. Each saved assistant message records its provider and model, and the timeline marks changes from the previous reply. The model picker retains entered keys by provider in tab memory, with NVIDIA and OpenRouter sharing the OpenRouter key slot.

## Revising a decision

**Revise decision** runs the entire council again with the currently selected model. The new prompt includes the original brief, the previous memo, and the saved discussion. It asks the roles to reassess new facts and objections while treating earlier assistant replies as analysis rather than independent evidence.

A successful revision creates a new decision record with a `parentId` pointing to the source record. The original memo and discussion remain available; the revised memo is not merged into them. A failed revision keeps the source record on screen. The library can reopen, export, delete, and undo deletion of records. Markdown export includes the brief, memo, assessments, and saved discussion with reply attribution.

## Provider and data boundaries

The same council and discussion code accepts models from direct providers, OpenRouter, NVIDIA through OpenRouter, and OpenAI-compatible endpoints. A configured server key covers only free `nvidia/*:free` routes; other hosted routes require the user's key. Ollama and LM Studio endpoints must be loopback addresses. Remote custom endpoints require HTTPS, and endpoint URLs cannot contain credentials, query parameters, or fragments.

The picker combines Models.dev metadata, live provider catalogs, and curated fallback entries. Hosted choices need a known release date within 180 days, except the pinned free Nemotron route. OpenRouter's live catalog is filtered to text models advertising structured output. Catalog metadata and a successful key lookup are not guarantees that every council generation will succeed.

API keys remain in tab memory and are omitted from saved connection preferences and exports. Briefs, memos, discussions, and key-free connection preferences are stored in unencrypted browser local storage; there are no accounts or cloud sync. A live request sends its context and key through the Conclave server to the chosen provider. The council has no external research or fact-checking tools, and current requests contain text rather than historical attachments or hidden reasoning.

Optional Langfuse tracing records the run ID, provider, model, and model-call observations. AI SDK input and output recording is disabled, and failure messages are redacted before logging. See [`docs/evals.md`](evals.md) for the synthetic council cases and structural checks. Those checks can catch missing fields and overconfident scores on underspecified briefs; they cannot establish whether a recommendation is sound.

## Decision limits

- Analyst scores and Chair confidence are model self-assessments of support in the supplied brief, not calibrated probabilities.
- Three assessments from one model are distinct calls, not independent external sources.
- Each follow-up replays the saved context. Conclave does not summarize or trim a long discussion to fit a smaller provider context window, so a later model may reject it.
- The saved memo changes only through a successful revision. A discussion reply may disagree with it without rewriting it.
