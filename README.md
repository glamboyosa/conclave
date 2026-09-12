# Conclave

Conclave is an AI council for working through decisions. Give it a brief; it assesses opportunity, evidence, and risk, then produces a decision memo with a recommendation and next steps.

Project domain: [conclave.click](https://conclave.click).

## Run locally

Use pnpm 10.15.0. The scripts run the project-local Node 22 binary installed with the dependencies.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:4173>.

To enable shared access to free NVIDIA models, create a private `.env.local`:

```dotenv
OPENROUTER_API_KEY=your-openrouter-key
CONCLAVE_SITE_URL=http://localhost:4173
```

The server uses this key only for free NVIDIA routes through OpenRouter. Without it, enter your own key or choose **Offline council**.

## Try a decision

Paste a brief like this:

> Should we add image uploads to Conclave now? We have two weeks available and want to help people review screenshots and diagrams. Text decisions already work. Image support would require compatible models, upload limits, and changes to storage and exports. What should we ship first?

Choose a model, then select **Convene council** or press **Cmd/Ctrl + Enter**. Briefs must contain 20–4,000 characters. The current input accepts text.

Assessments appear as they complete, followed by the Chair's synthesis. Reopen saved decisions in **Library**, or copy/export a memo as Markdown. The council uses the brief you provide; it has no external research tools. Support scores are model self-assessments, not calibrated probabilities.

## Models and API keys

| Connection              | Access                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Free NVIDIA             | Shared OpenRouter access for `nvidia/*:free` routes, including Nemotron 3 Super            |
| Direct providers        | Your own OpenAI, Anthropic, Google, Kimi/Moonshot, DeepSeek, xAI, Groq, or Mistral API key |
| Other OpenRouter models | Your own OpenRouter key, including for other free models                                   |
| Local / advanced        | Ollama, LM Studio, or an OpenAI-compatible endpoint; enter the exact model ID              |
| Offline council         | Deterministic format preview, without model calls; not an AI assessment                    |

OpenRouter is optional for direct providers. NVIDIA connections use OpenRouter and share its key slot.

The picker uses Models.dev metadata and provider catalogs. **Your provider** lists OpenAI first, then Anthropic, then other providers; models within each provider are newest first. Hosted models have a 180-day release window, with an explicit exception for free Nemotron 3 Super. Local connections are exempt. Models must support structured output.

Local endpoints must use loopback addresses. Remote custom endpoints require HTTPS.

## Storage and privacy

API keys stay in tab memory and clear on reload or close. They are sent to the Conclave server and selected provider for catalog requests and runs. They are never saved in browser storage, decision exports, logs, or analytics. Use HTTPS beyond localhost.

Briefs, memos, and connection preferences are stored in unencrypted browser local storage. The library retains the latest 50 decisions. There are no accounts, database, or cloud sync. Connection preferences exclude keys and credential-bearing URLs. Export records you want to keep; clearing site data deletes them.

## Development

```bash
pnpm check
pnpm preview
```

`check` runs lint, unit tests, TypeScript checks, a production build, and desktop Chromium/mobile WebKit tests. If browser binaries are missing, run `pnpm exec playwright install chromium webkit`; they are installed in the shared user cache.

`preview` serves the build with the API handlers for local verification. Static hosting alone cannot run the API. Public hosting needs a production server setup; use `CONCLAVE_SITE_URL=https://conclave.click` there and configure the shared key on the server.

<details>
<summary>How the council runs</summary>

React and Vite serve the interface. AI SDK runs three agents concurrently, then starts the Chair after their validated outputs complete. Zod validates requests, results, and saved records; Server-Sent Events deliver progress and results.

Product components live in `src/components/product/`, catalog state in `src/hooks/`, and API handlers in `server/api.ts`. See [Council design](docs/agent-design.md) for the workflow and constraints.

</details>
