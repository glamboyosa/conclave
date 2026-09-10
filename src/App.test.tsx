import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
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
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Sonnet 4.5" }),
    );
    await userEvent.type(
      screen.getByLabelText(/API key/),
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
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Sonnet 4.5" }),
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
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/run",
      expect.anything(),
    );
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
    expect(screen.getAllByText(/Local council/i).length).toBeGreaterThan(0);
  });
  it("runs free NVIDIA models on the shared OpenRouter key", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("stop"));

    render(<App />);
    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(
      await screen.findByRole("option", { name: /Nemotron 3 Super 120B/ }),
    );

    expect(localStorage.getItem("conclave:connection")).toContain(
      '"provider":"nvidia"',
    );
    expect(screen.getByLabelText(/OpenRouter API key/)).toBeInTheDocument();
    expect(screen.getByText(/shared OpenRouter key/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Nemotron 3 Nano 30B" }),
    );

    expect(
      screen.getByText(/shared key covers free models only/),
    ).toBeInTheDocument();
  });
  it("switches models from the settings dropdown only", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("stop"));

    render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    await userEvent.click(screen.getByLabelText("Popular model"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Claude Opus 4.5" }),
    );

    const saved = localStorage.getItem("conclave:connection") ?? "";

    expect(saved).toContain("claude-opus-4-5");
    expect(saved).not.toContain("apiKey");
    expect(screen.queryByLabelText("API endpoint")).not.toBeInTheDocument();
  });
});
