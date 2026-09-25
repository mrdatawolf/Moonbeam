import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve workspace packages to their TypeScript sources (no build needed).
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
  // The global setup file runs in Vitest's own `__vitest__` environment.
  environments: { __vitest__: { resolve: { conditions: ["source"] } } },
  test: {
    // Starts an isolated embedded Postgres (temporary MOONBEAM_HOME, free
    // port) for the whole run; never the developer's ~/.moonbeam/db.
    globalSetup: ["./src/test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
