import { z } from "zod";

const replySchema = z.string().trim().min(1).max(12000);

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);

export const readDiscussionResponse = async (
  response: Response,
  onText: (text: string) => void,
): Promise<string> => {
  if (!response.ok) {
    const value = await response.json();
    throw new Error(z.object({ error: z.string() }).parse(value).error);
  }

  if (!response.body) throw new Error("The reply was empty. Try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let complete = false;

  const consume = (line: string) => {
    if (!line.trim()) return;

    if (complete) throw new Error("The reply continued after completion.");
    const event = eventSchema.parse(JSON.parse(line));

    if (event.type === "error") throw new Error(event.error);

    if (event.type === "done") complete = true;

    if (event.type === "delta") {
      text += event.text;

      if (text.length > 12000) throw new Error("The reply exceeded its length limit.");
      onText(text);
    }
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

    if (!complete) throw new Error("The reply was interrupted. Your message is preserved; try again.");

    return replySchema.parse(text);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
};
