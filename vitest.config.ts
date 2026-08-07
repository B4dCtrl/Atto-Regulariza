import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Ambiente Node: os testes cobrem lógica pura, sem DOM.
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
