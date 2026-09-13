import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
});

describe("decision room", () => {
  it("guards against context-free runs", async () => {
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /convene council/i }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "at least 20 characters",
    );
  });
  it("keeps API keys out of local storage", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("stop"));

    render(<App />);
    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Fable 5.1" }),
    );
    await userEvent.type(
      screen.getByLabelText(/API key/, { selector: "input" }),
      "temporary-secret-value",
    );

    expect(localStorage.getItem("conclave:connection")).not.toContain(
      "temporary-secret-value",
    );
    expect(localStorage.getItem("conclave:connection")).toContain(
      '"provider":"anthropic"',
    );
    await userEvent.type(
      screen.getByLabelText("Decision brief"),
      "Should we launch this product to five customers next month?",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /convene council/i }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/run",
      expect.objectContaining({
        body: expect.stringContaining("temporary-secret-value"),
      }),
    );
  });
  it("requires a BYOK key before running a hosted provider", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("stop"));

    render(<App />);
    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Fable 5.1" }),
    );
    await userEvent.type(
      screen.getByLabelText("Decision brief"),
      "Should we launch this product to five customers next month?",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /convene council/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add your Anthropic API key",
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/run", expect.anything());
  });
  it("runs the council and renders the memo", async () => {
    const memo = JSON.stringify({
      title: "A careful launch",
      verdict: "Pilot it.",
      confidence: 76,
      mode: "local",
      agents: [
        {
          id: "optimist",
          thesis: "Go",
          detail: "Learn now.",
          signal: "Upside",
          score: 80,
        },
        {
          id: "analyst",
          thesis: "Measure",
          detail: "Set a metric.",
          signal: "Gap",
          score: 66,
        },
        {
          id: "skeptic",
          thesis: "Limit",
          detail: "Cap downside.",
          signal: "Risk",
          score: 72,
        },
      ],
      tensions: ["Speed vs quality"],
      actions: ["Run a pilot"],
      assumptions: ["Users care"],
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      input === "/api/run"
        ? Promise.resolve(
            new Response(memo, {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          )
        : Promise.reject(new Error("no catalog")),
    );
    render(<App />);
    await userEvent.type(
      screen.getByLabelText("Decision brief"),
      "Should we launch this product to five customers next month?",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /convene council/i }),
    );
    expect(
      await screen.findByText("Pilot it.", {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Offline preview/i).length).toBeGreaterThan(0);
  });
  it("runs free NVIDIA models on the shared OpenRouter key", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("stop"));

    localStorage.setItem(
      "conclave:connection",
      JSON.stringify({
        provider: "nvidia",
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        baseURL: "",
      }),
    );
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "API key" }));
    expect(
      screen.getByLabelText(/OpenRouter API key/, { selector: "input" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/shared OpenRouter key/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.type(
      screen.getByLabelText("Search models"),
      "Nemotron 3.5 Lightning 30B A3B",
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: "Nemotron 3.5 Lightning 30B A3B",
      }),
    );

    expect(
      screen.getByText(/shared key covers free NVIDIA models only/),
    ).toBeInTheDocument();
  });
  it("uses the shared connection controls in settings", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("stop"));

    render(<App />);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Settings" })[0],
    );
    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.type(
      screen.getByLabelText("Search models"),
      "Claude Opus 5",
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Opus 5" }),
    );

    const saved = localStorage.getItem("conclave:connection") ?? "";

    expect(saved).toContain("claude-opus-5");
    expect(saved).not.toContain("apiKey");
    expect(screen.queryByLabelText("API endpoint")).not.toBeInTheDocument();
  });
});

it("blocks paid OpenRouter routes before sending a run", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("no catalog"));

  render(<App />);
  await userEvent.click(screen.getByLabelText("Model"));
  await userEvent.click(screen.getByRole("button", { name: "All" }));
  await userEvent.type(
    screen.getByLabelText("Search models"),
    "Anthropic Claude Fable",
  );
  await userEvent.click(
    screen.getByRole("option", { name: "Anthropic Claude Fable 5.1" }),
  );
  await userEvent.type(
    screen.getByLabelText("Decision brief"),
    "Should we pilot this product with five test customers?",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /convene council/i }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Add your OpenRouter API key",
  );
  expect(fetchMock).not.toHaveBeenCalledWith("/api/run", expect.anything());
});

it("shares the in-memory OpenRouter key with NVIDIA and clears it on reload", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no catalog"));
  const { unmount } = render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "API key" }));
  await userEvent.type(
    screen.getByLabelText(/API key/, { selector: "input" }),
    "fake-session-key",
  );
  await userEvent.click(screen.getByLabelText("Model"));
  await userEvent.click(screen.getByRole("button", { name: "All" }));
  await userEvent.type(
    screen.getByLabelText("Search models"),
    "Nemotron 3.5 Lightning",
  );
  await userEvent.click(
    screen.getByRole("option", { name: "Nemotron 3.5 Lightning 30B A3B" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Manage key" }));
  expect(screen.getByLabelText(/API key/, { selector: "input" })).toHaveValue(
    "fake-session-key",
  );
  expect(JSON.stringify(localStorage)).not.toContain("fake-session-key");
  expect(JSON.stringify(sessionStorage)).not.toContain("fake-session-key");
  unmount();
  render(<App />);
  expect(screen.getByLabelText(/API key/, { selector: "input" })).toHaveValue(
    "",
  );
});

it("does not persist credential-bearing endpoint URLs", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no catalog"));
  render(<App />);
  await userEvent.click(screen.getByLabelText("Model"));
  await userEvent.click(screen.getByRole("button", { name: "All" }));
  await userEvent.type(
    screen.getByLabelText("Search models"),
    "OpenAI-compatible",
  );
  await userEvent.click(
    screen.getByRole("option", { name: "OpenAI-compatible" }),
  );
  await userEvent.type(
    screen.getByLabelText("API endpoint"),
    "https://example.com/v1?key=fake-url-secret",
  );
  expect(localStorage.getItem("conclave:connection")).not.toContain(
    "fake-url-secret",
  );
});
