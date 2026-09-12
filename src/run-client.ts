import { z } from "zod";
import type { CouncilEvent, RunResult } from "./engine";
import { eventSchema, resultSchema } from "./schemas";

export type { CouncilEvent } from "./engine";

export const readCouncilResponse = async (
  response: Response,
  onEvent: (event: CouncilEvent) => void,
): Promise<RunResult> => {
  if (!response.headers.get("Content-Type")?.includes("application/x-ndjson")) {
    const value = await response.json();

    if (!response.ok)
      throw new Error(z.object({ error: z.string() }).parse(value).error);

    return resultSchema.parse(value);
  }

  if (!response.body)
    throw new Error("The council response was empty. Try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunResult | undefined;

  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = eventSchema.parse(JSON.parse(line));

    if (event.type === "error") throw new Error(event.error);

    if (event.type === "result") result = event.result;
    onEvent(event);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(consume);

      if (done) break;
    }

    consume(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!result)
    throw new Error(
      "The council stopped before the Chair completed. Your brief is preserved; try again.",
    );

  return result;
};
