import { defineConfig } from "vitest/config";

// No React plugin: esbuild's automatic JSX transform is all this page needs.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") } },
  build: { target: "es2022", sourcemap: false },
  server: { port: 5174 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
