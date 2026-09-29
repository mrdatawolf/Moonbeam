import { defineConfig } from "vitest/config";

// Socket-free unit suites; the API/database suites use vitest.config.ts.
export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
  test: { include: ["src/identity/*.test.ts"], passWithNoTests: true },
});
