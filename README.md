# Conclave

Conclave turns a decision brief into independent Opportunity, Evidence, and Risk positions, followed by a Chair recommendation.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. Scripts use the project-local Node 22 binary. Installation writes dependencies to `node_modules/`.

For shared access to free NVIDIA models through OpenRouter, set `OPENROUTER_API_KEY` in `.env.local`. Keep that file private. The application checks whether shared access is configured without exposing the key. Without it, choose Offline or enter your own provider key.

## Use

Write 20–4,000 characters describing the decision, stakes, constraints, and unknowns. Select **Convene council** or press **Cmd/Ctrl + Enter**. The textarea grows as you write.

The searchable model picker groups shared/offline access, hosted providers, and local connections. Settings uses the same connection controls. Catalog loading, failure, retry, and unavailable selections are shown before a run.

- **OpenRouter:** shared access covers only NVIDIA models with `nvidia/` IDs ending in `:free`. Every other OpenRouter model requires your own key, including other free models.
- **NVIDIA:** runs through OpenRouter and shares its in-memory key.
- **Hosted BYOK:** Anthropic, OpenAI, Google, Kimi/Moonshot, DeepSeek, xAI, Groq, and Mistral. Entering a key fetches the provider catalog.
- **Local/advanced:** Ollama, LM Studio, or an OpenAI-compatible endpoint. Enter the exact model ID manually. Local endpoints must use loopback addresses; remote custom endpoints require HTTPS. Models must support structured output.
- **Offline:** deterministic format preview; convening makes no model or network calls. It is not an AI assessment.

Live execution reports actual perspective completions, then Chair synthesis. Results include support from the brief, disagreements, actions, assumptions, and the original brief. Support scores are self-assessments, not calibrated probabilities. There are no external research tools.

## Data and keys

Keys are masked by default, can be revealed or forgotten, and stay only in tab memory. Reloading or closing clears them. They travel to the Conclave server for catalogs and runs, then to the selected provider. The app does not save them in browser storage, exports, logs, or analytics. Use HTTPS beyond localhost.

Briefs, memos, and provider/model metadata are saved in unencrypted browser local storage. Library searches and reopens the most recent 50 decisions. Copy or export Markdown for records you need to retain. Clearing site data deletes them; there is no account, database, or cloud sync. Connection preferences exclude keys and credential-bearing endpoint URLs.

## Verify and preview

```bash
pnpm check
pnpm preview
```

Verification runs lint, Vitest, TypeScript, a build, and desktop Chromium/mobile WebKit E2E checks. Preview serves the build and the same API handlers. Install missing browsers with `pnpm exec playwright install chromium webkit`; binaries go to the shared user cache.

<details>
<summary>Architecture</summary>

React/Vite renders the application. Product components live in `src/components/product/`; catalog state lives in `src/hooks/`. Zod validates requests, results, and stored records. `server/api.ts` attaches API handlers to Vite development and preview servers. AI SDK runs three agents concurrently and starts the Chair after their validated outputs complete. See [Council design](docs/agent-design.md).

Preview is for local verification. Public hosting still needs a production server/deployment setup; static hosting alone cannot serve the API.

</details>

## Remove

Stop the server, delete the project directory, and clear its browser site data. Playwright binaries are shared with other projects; deleting Conclave does not remove them.
