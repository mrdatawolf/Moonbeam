import { describe, expect, it } from "vitest";
import { buildSubtaskEnvelope, buildTopLevelEnvelope } from "./envelope.js";

const parent = (() => {
  const r = buildTopLevelEnvelope({
    inclusions: ["Build the API", "Write docs"],
    exclusions: ["No UI"],
    constraints: ["Use zod"],
    contracts: ["CONTRACT-005"],
    paths: ["server", "docs/DEVELOPMENT.md"],
  });
  if (!r.ok) throw new Error("bad fixture");
  return r.envelope;
})();

const ok = {
  inclusions: [{ text: "Build the claim route", derivedFrom: "I1" }],
  exclusions: ["No UI", "No docs"],
  constraints: ["Use zod"],
  contracts: ["CONTRACT-005"],
  paths: ["server/src"],
};

describe("scope envelope narrowing (CONTRACT-005 Scope envelope)", () => {
  it("keys top-level inclusions I1, I2, ...", () => {
    expect(parent.inclusions.map((i) => i.key)).toEqual(["I1", "I2"]);
  });

  it("accepts a narrowing envelope", () => {
    const r = buildSubtaskEnvelope(parent, ok, "s");
    expect(r.ok).toBe(true);
  });

  it("rejects every broken rule at once", () => {
    const r = buildSubtaskEnvelope(
      parent,
      {
        inclusions: [{ text: "Something else", derivedFrom: "I9" }],
        exclusions: [],
        constraints: [],
        contracts: ["CONTRACT-009"],
        paths: ["ui", "server/*.ts"],
      },
      "s",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.reasons.join("\n");
      expect(text).toMatch(/missing parent exclusion/);
      expect(text).toMatch(/missing parent constraint/);
      expect(text).toMatch(/missing parent contract/);
      expect(text).toMatch(/adds contract/);
      expect(text).toMatch(/does not derive/);
      expect(text).toMatch(/outside the parent's paths/);
      expect(text).toMatch(/glob/);
    }
  });

  it("allows a path equal to a parent path, and a file inside a parent directory", () => {
    expect(buildSubtaskEnvelope(parent, { ...ok, paths: ["server", "docs/DEVELOPMENT.md"] }, "s").ok).toBe(true);
    expect(buildSubtaskEnvelope(parent, { ...ok, paths: ["docs"] }, "s").ok).toBe(false);
  });
});
