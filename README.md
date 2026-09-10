# Conclave

Conclave is a local web app that turns a decision brief into three independent positions and a decision memo.

It runs without credentials using a deterministic local engine. If `OPENAI_API_KEY` is configured, the development server sends the brief to the OpenAI Responses API and requests schema-validated output.

## Install and run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. A project-local Node 22 binary runs the scripts, so the global Node version is not changed.

The install writes dependencies to `node_modules/`. The app writes the latest completed memo to the browser's `localStorage` under `conclave:lastRun`; **Start over** removes it.

## Use

Enter at least 20 characters describing the decision, constraints, and desired outcome. Select **Convene council** or press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>.

A completed run contains opportunity, evidence, and risk positions; a chair recommendation; unresolved assumptions; and three next actions. Without an API key, the result is labeled **Local council** and uses only rules in [`src/engine.ts`](src/engine.ts). It does not claim external research.

## Live model mode

Create `.env.local`:

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_MODEL` is optional. The key stays in the Vite server process and is not included in client JavaScript. Each run sends the brief to `https://api.openai.com/v1/responses` with `store: false`. No other app feature makes a network request, apart from loading Google Fonts in the current UI.

## Verify

```bash
pnpm check
```

Current output from the full check:

```text
Test Files  2 passed (2)
Tests       4 passed (4)
✓ built in 682ms
10 passed (10.4s)
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
- Vite middleware owns `POST /api/run`, validation, and the server-only API key.
- Vitest covers engine and component behavior. Playwright covers submission, validation, persistence, keyboard use, overflow, and API rejection.

</details>

## Remove

Delete `conclave/` to remove the app and its dependencies. Clear site data for `localhost:4173` to remove a saved memo. Playwright browser binaries live in its user cache and may be shared by other projects.
