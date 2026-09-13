import { expect, it } from "vitest";
import { readDiscussionResponse } from "./discussion-client";

it("reveals incremental text across split UTF-8 and event boundaries", async () => {
  const bytes = new TextEncoder().encode(
    '{"type":"delta","text":"£5,000"}\n{"type":"delta","text":" changes the scope."}\n{"type":"done"}',
  );

  const updates: string[] = [];

  const response = new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  }));

  expect(await readDiscussionResponse(response, (text) => updates.push(text))).toBe("£5,000 changes the scope.");
  expect(updates).toEqual(["£5,000", "£5,000 changes the scope."]);
});

it.each([
  ['{"type":"delta","text":"Partial reply"}\n', "interrupted"],
  ['{"type":"delta","text":"Partial reply"}\n{"type":"error","error":"Provider unavailable. Run ID: fake-run"}\n', "Provider unavailable"],
])("rejects unfinished replies so they cannot be saved as complete", async (body, error) => {
  await expect(readDiscussionResponse(new Response(body), () => {})).rejects.toThrow(error);
});
