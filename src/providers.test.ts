import { expect, it } from "vitest";
import { isRecentModel } from "./providers";

it("includes the 180-day boundary and excludes older, undated, and future models", () => {
  const today = new Date("2026-09-12T12:00:00Z");
  const model = { id: "test-model", name: "Test model", free: false };
  expect(isRecentModel({ ...model, releaseDate: "2026-03-16" }, today)).toBe(
    true,
  );
  expect(isRecentModel({ ...model, releaseDate: "2026-03-15" }, today)).toBe(
    false,
  );
  expect(isRecentModel({ ...model, releaseDate: "2026-09-12" }, today)).toBe(
    true,
  );
  expect(isRecentModel({ ...model, releaseDate: "2026-09-13" }, today)).toBe(
    false,
  );
  expect(isRecentModel(model, today)).toBe(false);
});
