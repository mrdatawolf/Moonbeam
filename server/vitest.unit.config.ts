import { defineConfig } from "vitest/config";

// Socket-free unit suites; the API/database suites use vitest.config.ts.
export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
  test: { include: ["src/discovery.test.ts", "src/lifecycle/*.test.ts", "src/identity/*.test.ts"] },
});
