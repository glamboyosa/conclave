import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import DiscussionMarkdown from "./DiscussionMarkdown";

afterEach(cleanup);

it("renders structured Markdown and keeps HTML and unsafe links inactive", () => {
  const content = [
    "## Hiring options",
    "**Reserve named capacity.**",
    "1. Confirm availability\n2. Set a budget",
    "| Option | Cost |\n| --- | --- |\n| Contractor | £5,000 |",
    "```text\nKeep the pilot bounded.\n```",
    "[Provider docs](https://example.com/docs)",
    "[Unsafe link](javascript:alert%281%29)",
    '<script>alert("test")</script>',
  ].join("\n\n");

  const { container } = render(<DiscussionMarkdown content={content} />);
  expect(
    screen.getByRole("heading", { name: "Hiring options" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Reserve named capacity.").tagName).toBe("STRONG");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("cell", { name: "£5,000" })).toBeInTheDocument();
  expect(container.querySelector("pre code")).toHaveTextContent(
    "Keep the pilot bounded.",
  );
  expect(screen.getByRole("link", { name: "Provider docs" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.getByText("Unsafe link")).not.toHaveAttribute(
    "href",
    expect.stringContaining("javascript:"),
  );
  expect(container.querySelector("script")).toBeNull();
});
