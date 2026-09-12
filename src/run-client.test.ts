import { describe, expect, it } from "vitest";
import { buildDemoRun } from "./engine";
import { readCouncilResponse, type CouncilEvent } from "./run-client";

const streamedResponse = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) =>
          controller.enqueue(new TextEncoder().encode(chunk)),
        );
        controller.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );

describe("council stage transport", () => {
  it("reads split stage events and a final memo", async () => {
    const result = buildDemoRun(
      "Should we pilot this product with five test customers?",
    );

    const events: CouncilEvent[] = [];

    const response = streamedResponse([
      '{"type":"stage","stage":"pers',
      'pectives"}\n{"type":"perspective","id":"analyst"}\n',
      '{"type":"stage","stage":"chair"}\n',
      JSON.stringify({ type: "result", result }),
    ]);

    expect(
      await readCouncilResponse(response, (event) => events.push(event)),
    ).toEqual(result);
    expect(events.map((event) => event.type)).toEqual([
      "stage",
      "perspective",
      "stage",
      "result",
    ]);
  });
  it("does not accept an incomplete council as a result", async () => {
    await expect(
      readCouncilResponse(
        streamedResponse(['{"type":"stage","stage":"chair"}\n']),
        () => {},
      ),
    ).rejects.toThrow("stopped before the Chair completed");
  });
  it("surfaces safe server errors from a streamed failure", async () => {
    await expect(
      readCouncilResponse(
        streamedResponse(['{"type":"error","error":"Try another model."}\n']),
        () => {},
      ),
    ).rejects.toThrow("Try another model.");
  });
});
