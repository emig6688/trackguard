import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Multi-tenant: fuera de /plataforma (SUPERADMIN) y el cron de sistema,
  // todo lo que toca datos de negocio tiene que usar el cliente de Prisma
  // scoped por empresa que devuelven requireRole/requireSession/
  // requireEmpresa (ver lib/permisos.ts), nunca el cliente crudo — el tipo
  // del cliente scoped es idéntico al crudo a propósito (ver
  // lib/tenant-prisma.ts), así que TypeScript no puede detectar un archivo
  // que se olvidó de migrar. Esta regla es el chequeo real.
  {
    files: [
      "app/_actions/**/*.{ts,tsx}",
      "app/(admin)/**/*.{ts,tsx}",
      "app/(mobile)/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
    ],
    ignores: ["app/api/cron/**", "app/(plataforma)/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              importNames: ["prisma"],
              message:
                "Usá el prisma con alcance de requireRole/requireSession/requireEmpresa (lib/permisos.ts), no el cliente crudo.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
