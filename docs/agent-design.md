# Council design

Conclave uses a fixed parallel workflow with four AI SDK agents:

1. The opportunity agent argues the strongest evidence-based case for action.
2. The evidence agent separates facts from assumptions and defines a success threshold.
3. The risk agent identifies the likeliest failure mode and a guardrail.
4. The chair receives all three positions and writes the final memo.

The first three agents run concurrently. They cannot see one another's output, which reduces anchoring and gives the chair distinct positions to compare. The chair runs only after all three positions pass their Zod schemas.

Each role has a narrow instruction, a typed output contract, and a three-minute limit. The decision brief is wrapped as untrusted data and role instructions explicitly reject commands found inside it. The workflow makes no external claims because it has no research tools. Confidence measures support in the supplied brief, not certainty about the world.

## Why this is a workflow

AI SDK defines an agent as a model that uses tools in a loop. It recommends explicit workflows when the control path must be repeatable. Conclave needs independent analysis followed by synthesis, so code controls that sequence. `ToolLoopAgent` owns each role's reusable instructions and structured output, while the workflow owns concurrency and ordering.

This matches guidance from:

- [AI SDK workflow patterns](https://ai-sdk.dev/docs/agents/workflows), which shows parallel specialists followed by model synthesis.
- [Anthropic's building effective agents guide](https://www.anthropic.com/engineering/building-effective-agents), which recommends simple composable patterns and warns that autonomy adds latency and cost.
- [Google Cloud's agent design guide](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system), which recommends choosing from workload complexity, latency, cost, and human involvement.

An open-ended swarm would add agent-to-agent loops without giving this task better evidence. It is not part of the current design.

## Current limits

- The agents reason only over the user's brief.
- Free hosted models can be slow or rate-limited.
- Structured output support varies by model. The default OpenRouter model is `nvidia/nemotron-3-super-120b-a12b:free` because OpenRouter currently reports structured-output support for that route. The OpenRouter catalog endpoint is filtered to models that report `structured_outputs` support; catalogs for bring-your-own-key providers (Anthropic, OpenAI, Google, Kimi, DeepSeek, xAI, Groq, Mistral, NVIDIA NIM) are loaded live from each provider, and every role runs through the same Vercel AI SDK contract regardless of provider.
- A good memo still depends on a brief with concrete stakes and constraints.
