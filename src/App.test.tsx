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
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.selectOptions(screen.getByLabelText("Provider"), "nvidia");
    await userEvent.type(screen.getByLabelText("API key"), "nvapi-secret-value");
    await userEvent.click(screen.getByRole("button", { name: "Save connection" }));

    expect(localStorage.getItem("conclave:connection")).not.toContain("nvapi-secret-value");
    expect(screen.getByText(/NVIDIA NIM/)).toBeInTheDocument();
  });
  it("runs the council and renders the memo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
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
});
