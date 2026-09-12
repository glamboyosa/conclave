import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildDemoRun } from "../../engine";
import { defaultConnection } from "../../providers";
import { DecisionDiscussion } from "./DecisionDiscussion";

const brief = "Should our test team pilot a new decision workflow?";

const record = {
  id: "test-decision",
  createdAt: "2026-09-12",
  brief,
  result: buildDemoRun(brief),
};

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves a failed message and saves the conversation only after a successful retry", async () => {
  const user = userEvent.setup();
  const save = vi.fn();

  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "Provider credits exhausted. Run ID: test-run",
        }),
        { status: 502 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          text: "A smaller budget changes the recommendation.",
        }),
      ),
    );

  render(
    <DecisionDiscussion
      record={record}
      connection={defaultConnection}
      controls={null}
      onSave={save}
      onRevise={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Discuss this decision" }),
  );
  await user.type(
    screen.getByLabelText("Your follow-up"),
    "Our budget is now £5,000.",
  );
  await user.click(screen.getByRole("button", { name: "Send follow-up" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Provider credits exhausted",
  );
  expect(screen.getByLabelText("Your follow-up")).toHaveValue(
    "Our budget is now £5,000.",
  );
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Send follow-up" }));
  await vi.waitFor(() =>
    expect(save).toHaveBeenCalledWith([
      { role: "user", content: "Our budget is now £5,000." },
      {
        role: "assistant",
        content: "A smaller budget changes the recommendation.",
      },
    ]),
  );
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/discuss",
    expect.objectContaining({
      body: expect.stringContaining(record.result.verdict),
    }),
  );
  expect(screen.getByLabelText("Your follow-up")).toHaveValue("");
});

it("saves offline notes without a model request and enables revision after context is added", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  const revise = vi.fn();
  const fetch = vi.spyOn(globalThis, "fetch");

  const props = {
    record,
    connection: {
      ...defaultConnection,
      provider: "demo" as const,
      model: "offline",
    },
    controls: null,
    onSave: save,
    onRevise: revise,
  };

  const { rerender } = render(<DecisionDiscussion {...props} />);
  await user.click(
    screen.getByRole("button", { name: "Discuss this decision" }),
  );
  expect(
    screen.getByRole("button", { name: "Revise decision" }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText("Your follow-up"),
    "We cannot afford a six-week pilot.",
  );
  await user.click(screen.getByRole("button", { name: "Add note" }));
  expect(fetch).not.toHaveBeenCalled();
  const discussion = save.mock.calls[0][0];
  rerender(
    <DecisionDiscussion {...props} record={{ ...record, discussion }} />,
  );
  expect(
    screen.getByText("We cannot afford a six-week pilot."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revise decision" }));
  expect(revise).toHaveBeenCalledOnce();
});
