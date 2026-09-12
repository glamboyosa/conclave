import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { buildDemoRun } from "../../engine";
import { CouncilResults } from "./CouncilResults";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("confirms copying the memo and recovers from a failed copy", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
  const brief = "Should our test team pilot a new decision process?";
  render(
    <CouncilResults
      result={buildDemoRun(brief)}
      brief={brief}
      onNew={vi.fn()}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Copy memo" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Copy failed");
  writeText.mockResolvedValueOnce();
  await user.click(screen.getByRole("button", { name: "Copy memo" }));
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(brief));
});
