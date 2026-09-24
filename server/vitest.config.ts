import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve workspace packages to their TypeScript sources (no build needed).
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"] } },
});
