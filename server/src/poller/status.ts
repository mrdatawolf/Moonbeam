import type { ProjectSource } from "@moonbeam/db";
import { sourceViewSchema, type SourceView } from "@moonbeam/shared";

export function sourceView(source: ProjectSource): SourceView {
  const since = source.statusSince.toISOString();
  const until = source.rateLimitedUntil?.toISOString() ?? null;
  const messages = {
    never_polled: "Not yet polled", ok: "Up to date",
    unreachable: `GitHub unreachable since ${since}`,
    rate_limited: `rate limited until ${until}`,
    token_rejected: `token rejected since ${since}`,
    token_missing: "token not configured", token_config_unreadable: "token configuration unreadable",
    not_found: `repository not found or not accessible since ${since}`,
    identity_changed: "repository identity changed", branch_missing: `branch not found since ${since}`,
  };
  return sourceViewSchema.parse({ ...source, message: messages[source.status], statusSince: since,
    lastAttemptAt: source.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null, rateLimitedUntil: until });
}
export function backoffMs(failures: number): number {
  return Math.min(30, 5 * 2 ** Math.min(3, Math.max(0, failures - 1))) * 60_000;
}
