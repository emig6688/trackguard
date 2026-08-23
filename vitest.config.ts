import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // "server-only" tira a propósito si algo lo importa fuera de un
      // Server Component — Next.js lo neutraliza en su build vía webpack,
      // pero Vitest no, así que acá se resuelve a un no-op para poder
      // testear código de lib/ y app/_actions que lo importa (es una guía
      // de build-time, no algo con comportamiento propio que testear).
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
});
