# Conclave tracing and evals

Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` in the server environment. Live council and discussion requests appear as `conclave.council` and `conclave.discussion` traces. AI SDK child observations show model calls and token usage. Traces omit brief text, memo text, replies, and API keys; they retain the run ID, provider, and model. Tracing is off when either Langfuse key is absent.

Start the app with `pnpm dev`, then run `pnpm eval`. The runner reads `.env.local`, uses `OPENROUTER_API_KEY`, and calls the local `/api/run` route with three synthetic briefs. Set `CONCLAVE_EVAL_MODEL` to compare models or `CONCLAVE_EVAL_BASE_URL` to target another running instance. These are real model calls and can incur cost.

The runner stores fixtures in the `conclave/decision-briefs-v1` Langfuse dataset. The `conclave/` dataset and `conclave.` score prefixes separate these results from Docket in the shared Langfuse project. Each item receives three scores:

| Score                              | Meaning                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `conclave.memo_complete`           | The memo has a verdict, three actions, at least two tensions and assumptions, and live mode. |
| `conclave.role_coverage`           | Optimist, analyst, and skeptic each returned a thesis and explanation.                       |
| `conclave.uncertainty_calibration` | Confidence stays under the case's provisional ceiling for an underspecified brief.           |

These checks detect structural regressions and overconfidence. They do not establish that the advice is correct. Review verdicts and actions in the Langfuse experiment before changing prompts or shipping a model change. Add synthetic cases with a reviewed confidence ceiling for new failure modes; do not upload real user decisions without consent.
