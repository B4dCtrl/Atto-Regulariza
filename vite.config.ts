// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Deploy na Vercel: preset vercel + output no formato Build Output API (.vercel/output).
  // O preset vem de NITRO_PRESET=vercel (env da Vercel); aqui só corrigimos o output,
  // que a config padrão força para "dist". Localmente (sem NITRO_PRESET) continua cloudflare-module.
  nitro:
    process.env.NITRO_PRESET === "vercel"
      ? {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            publicDir: ".vercel/output/static",
            serverDir: ".vercel/output/functions/__server.func",
          },
        }
      : undefined,
});
