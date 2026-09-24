import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

const serverPort = process.env.MOONBEAM_SERVER_PORT ?? "3100";
const uiPort = Number(process.env.MOONBEAM_UI_PORT ?? 5180);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Resolve workspace packages to their TypeScript sources.
    conditions: ["source", ...defaultClientConditions],
  },
  server: {
    host: "127.0.0.1",
    port: uiPort,
    strictPort: true,
    proxy: {
      "/api": `http://127.0.0.1:${serverPort}`,
    },
  },
});
