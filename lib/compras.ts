import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Separada de app/_actions/compras.ts (que es "use server" y arrastra todo
 * el árbol de auth/Prisma al importarla) para poder testear esta regla de
 * negocio de forma aislada — ver lib/compras.test.ts.
 */
export function calcularRequiereAutorizacion(
  montoEstimado: number | undefined,
  umbral: Prisma.Decimal | null
) {
  return umbral != null && montoEstimado != null && montoEstimado > Number(umbral);
}
