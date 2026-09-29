import { describe, expect, it } from "vitest";
import { decodeFile } from "./files.js";

describe("decodeFile (P10)", () => {
  it("decodes UTF-8 text and strips a leading BOM", () => {
    expect(decodeFile(new TextEncoder().encode("héllo"))).toEqual({ kind: "text", text: "héllo" });
    expect(decodeFile(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toEqual({ kind: "text", text: "a" });
  });

  it("returns not_utf8 for invalid bytes", () => {
    expect(decodeFile(new Uint8Array([0x61, 0xff, 0xfe, 0x62]))).toEqual({ kind: "not_utf8" });
    expect(decodeFile(new Uint8Array([0xc3]))).toEqual({ kind: "not_utf8" });
  });

  it("returns too_large above 1 MiB, and accepts exactly 1 MiB", () => {
    expect(decodeFile(new Uint8Array(1_048_577).fill(0x61))).toEqual({ kind: "too_large" });
    expect(decodeFile(new Uint8Array(1_048_576).fill(0x61)).kind).toBe("text");
  });

  it("checks the size before decoding", () => {
    const big = new Uint8Array(1_048_577).fill(0xff);
    expect(decodeFile(big)).toEqual({ kind: "too_large" });
  });

  it("returns absent for a missing file", () => {
    expect(decodeFile(null)).toEqual({ kind: "absent" });
    expect(decodeFile(undefined)).toEqual({ kind: "absent" });
  });
});
