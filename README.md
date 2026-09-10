# Conclave

Conclave is a local web app that turns a decision brief into three independent positions and a decision memo.

It runs without credentials using a deterministic local engine. The Settings page can connect OpenRouter, NVIDIA NIM, OpenAI, Ollama, LM Studio, or another OpenAI-compatible endpoint through Vercel AI SDK.

## Install and run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. A project-local Node 22 binary runs the scripts, so the global Node version is not changed.

The install writes dependencies to `node_modules/`. Completed decisions are saved in this browser's local storage and shown in Library. The library keeps the 50 most recent records. It stores the brief and memo, but never the API key. There is no server database, account, sync, or analytics.

Browser storage is not encrypted. Anyone with access to the same browser profile can read it, and clearing site data removes it. Export records you need before clearing browser data.

## Use

Enter at least 20 characters describing the decision, constraints, and desired outcome. Select **Convene council** or press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>.

A completed run contains opportunity, evidence, and risk positions; a chair recommendation; unresolved assumptions; and three next actions. Without an API key, the result is labeled **Local council** and uses only rules in [`src/engine.ts`](src/engine.ts). It does not claim external research.

Live runs use three independent AI SDK agents in parallel, followed by a chair agent. See [Council design](docs/agent-design.md) for the role contracts, security boundary, and design sources.

Use **Export Markdown** on a memo or Library record to download the brief, independent positions, chair recommendation, actions, and assumptions as one `.md` transcript.

## Model connections

Open **Settings** and select a provider:

- **OpenRouter** defaults to the free `nvidia/nemotron-3-super-120b-a12b:free` route. It supports the structured output required by the council. Change the model ID to use OpenAI, Anthropic, DeepSeek, Kimi, or another model in OpenRouter's catalog.
- **NVIDIA NIM** uses `nvidia/nemotron-3-ultra-550b-a55b` and NVIDIA's hosted development endpoint by default.
- **OpenAI** uses `gpt-5-mini` and the OpenAI API by default.
- **Ollama** uses `http://127.0.0.1:11434/v1` by default.
- **LM Studio** uses `http://127.0.0.1:1234/v1` by default.
- **OpenAI-compatible** accepts any model ID and compatible base URL.

Hosted providers need your API key, including models marked free. Enter it in Settings before using the connection. `.env.local` is still available for non-secret site metadata:

```dotenv
CONCLAVE_SITE_URL=http://localhost:4173
```

The key lives only in React state for the current page and travels through the local middleware with each run. The app does not write it to local storage, session storage, files, or logs. Reloading clears it. Use HTTPS when deploying Conclave beyond localhost.

Ollama and LM Studio do not require a key by default. Start their OpenAI-compatible server, enter the model ID it exposes, and save the connection. Local model quality and structured-output support vary by model.

## Verify

```bash
pnpm check
```

Current output from the full check:

```text
Test Files  2 passed (2)
Tests       6 passed (6)
16 passed
```

The command runs Oxlint with the vendored anti-slop rules, ESLint, Vitest, a production build, and Playwright against desktop Chromium and a mobile WebKit viewport.

Install the Playwright browsers once if missing:

```bash
./node_modules/node/bin/node ./node_modules/@playwright/test/cli.js install chromium webkit
```

This writes browser binaries to Playwright's user cache outside the repository.

<details>
<summary>Architecture</summary>

- React 19 and TypeScript render a single-screen state machine.
- Tailwind CSS 4 and registry-installed shadcn/ui source provide the UI layer.
- Motion handles agent-card entrances and respects reduced-motion preferences.
- Vite middleware owns `POST /api/run`, validates every request with Zod, and uses AI SDK structured output.
- Vitest covers engine and component behavior. Playwright covers submission, validation, persistence, keyboard use, overflow, and API rejection.

</details>

## Remove

Delete `conclave/` to remove the app and its dependencies. Clear site data for `localhost:4173` to remove a saved memo. Playwright browser binaries live in its user cache and may be shared by other projects.
