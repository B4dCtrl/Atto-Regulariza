import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O alias "@" vem do tsConfigPaths na config do app; aqui precisa ser
  // declarado à mão, senão módulos de src/lib/api não resolvem no teste.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Ambiente Node: os testes cobrem lógica pura, sem DOM.
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
