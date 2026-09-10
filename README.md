# Conclave

Conclave is a local web app that turns a decision brief into three independent positions and a decision memo.

The default model is NVIDIA Nemotron 3 Super on OpenRouter's free tier, covered by a shared key — nothing to configure. A model picker on the decision page switches providers (Anthropic, OpenAI, Google, Kimi, DeepSeek, xAI, Groq, Mistral, NVIDIA NIM) with live model catalogs and bring-your-own-key support through Vercel AI SDK. An offline, deterministic council runs with no credentials and no network.

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

The **model picker** on the decision page has three parts: a provider list, a model list loaded live from that provider's catalog, and — for hosted providers — a key field.

- **OpenRouter** is the default. The free `nvidia/nemotron-3-super-120b-a12b:free` route runs on the shared key from `.env.local`, so it works out of the box. The shared key covers `:free` models only; add your own OpenRouter key to run paid catalog models.
- **Anthropic, OpenAI, Google, Kimi (Moonshot), DeepSeek, xAI, Groq, Mistral, NVIDIA NIM** are bring-your-own-key. Paste a key and the picker loads the provider's live model list; without a key it shows a short list of popular models.
- **Offline** is the deterministic local council — no key, no network.

**Settings** holds exactly one control: a dropdown of popular models. It never asks you to type a model ID or an endpoint.

The shared OpenRouter key lives in `.env.local`:

```dotenv
OPENROUTER_API_KEY=sk-or-...
CONCLAVE_SITE_URL=http://localhost:4173
```

Your own keys live only in React state for the current tab and travel through the local middleware with each run. The app does not write them to local storage, session storage, files, or logs. Reloading clears them. Use HTTPS when deploying Conclave beyond localhost.

The `/api/run` endpoint still accepts `ollama`, `lmstudio`, and `custom` OpenAI-compatible connections (loopback or HTTPS only), but the picker focuses on the hosted providers above.

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
