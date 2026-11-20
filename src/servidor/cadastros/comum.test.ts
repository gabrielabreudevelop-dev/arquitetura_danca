import { expect, it } from "vitest";
import { ehUuid } from "./comum";

it("reconhece uuids e recusa o resto", () => {
  expect(ehUuid("0b3f6f1e-5c1a-4f5e-9d2a-3a1c2b4d5e6f")).toBe(true);
  expect(ehUuid("0B3F6F1E-5C1A-4F5E-9D2A-3A1C2B4D5E6F")).toBe(true);
  expect(ehUuid("")).toBe(false);
  expect(ehUuid("abc")).toBe(false);
  expect(ehUuid("0b3f6f1e-5c1a-4f5e-9d2a-3a1c2b4d5e6f ")).toBe(false);
});
