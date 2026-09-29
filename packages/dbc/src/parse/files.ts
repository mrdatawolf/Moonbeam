export type FileRead =
  | { kind: "text"; text: string }
  | { kind: "too_large" }
  | { kind: "not_utf8" }
  | { kind: "absent" };

/** P10: check the byte limit before decoding; TextDecoder strips one BOM. */
export function decodeFile(bytes: Uint8Array | null | undefined): FileRead {
  if (bytes == null) return { kind: "absent" };
  if (bytes.byteLength > 1_048_576) return { kind: "too_large" };
  try {
    return { kind: "text", text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { kind: "not_utf8" };
  }
}
