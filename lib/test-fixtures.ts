import { vi } from "vitest";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scopedPrisma, MODELOS_CON_EMPRESA } from "@/lib/tenant-prisma";
import type { Rol } from "@/app/generated/prisma/client";

function delegatePrisma(modelo: string) {
  const propiedad = modelo.charAt(0).toLowerCase() + modelo.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[propiedad] as { deleteMany: (args: unknown) => Promise<unknown> };
}

/**
 * Infra compartida por los tests de app/_actions/*.ts: cada archivo de test
 * crea su propia Empresa aislada (nunca toca los datos reales de MEAT S.A. /
 * LA SUPERIOR), la puebla con lo que necesite, y la borra entera al
 * terminar. Corre contra la base real configurada en DATABASE_URL — nada
 * de Prisma se mockea, solo el borde con Next.js (sesión, redirect, cache)
 * y proveedores externos (ver vitest.setup.ts).
 */

let contador = 0;
function sufijoUnico() {
  contador += 1;
  return `${Date.now()}-${contador}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function crearEmpresaDePrueba(tag: string) {
  const empresa = await prisma.empresa.create({
    data: { nombre: `TEST_VITEST_${tag}_${sufijoUnico()}` },
  });
  return { empresaId: empresa.id, prisma: scopedPrisma(empresa.id) };
}

/**
 * `activo` por defecto en el modelo es `true`, y `telefono` queda `null` a
 * propósito: aunque enviarWhatsapp está mockeado (vitest.setup.ts), no tiene
 * sentido darle un teléfono a un usuario de prueba.
 */
export async function crearUsuarioDePrueba(
  empresaId: string,
  rol: Rol,
  overrides: { activo?: boolean; nombre?: string } = {}
) {
  const passwordHash = await bcrypt.hash("test-vitest-1234", 4); // costo bajo: más rápido en tests
  return prisma.usuario.create({
    data: {
      empresaId,
      email: `test-vitest-${rol.toLowerCase()}-${sufijoUnico()}@example.local`,
      nombre: overrides.nombre ?? `Test ${rol}`,
      passwordHash,
      rol,
      activo: overrides.activo ?? true,
    },
  });
}

export type SesionDePrueba = { id: string; rol: Rol; empresaId: string | null };

export function mockearSesion(sesion: SesionDePrueba | null) {
  vi.mocked(auth).mockResolvedValue(
    sesion
      ? ({
          user: {
            id: sesion.id,
            rol: sesion.rol,
            empresaId: sesion.empresaId,
            email: "",
            name: "",
          },
          expires: new Date(Date.now() + 3600_000).toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      : null
  );
}

/**
 * Borra la Empresa de prueba y todo lo que cuelgue de ella. En vez de
 * mantener a mano el orden exacto de ~30 modelos con FKs cruzadas, intenta
 * borrar por empresaId en todos los modelos de MODELOS_CON_EMPRESA (más
 * Usuario, que queda afuera de ese set a propósito) en varias pasadas: los
 * que fallan por una FK todavía viva se reintentan en la pasada siguiente,
 * hasta que no quede ninguno o se estanque. Las tablas "nieto" sin
 * empresaId propio (PresupuestoCompra, OTDerivacionExterna,
 * ChecklistRespuesta, PerfilChofer, ChecklistItem) tienen onDelete: Cascade
 * desde su padre directo, así que no hace falta tocarlas a mano.
 *
 * ChecklistRealizado es la excepción: tampoco tiene empresaId propio, pero
 * a diferencia de las de arriba NO tiene onDelete: Cascade desde Vehiculo/
 * ChecklistTemplate/Usuario — hay que borrarla a mano ANTES del resto, o
 * esos tres modelos nunca logran borrarse (encontrado escribiendo los tests
 * de eventosRuta.ts y guardia.ts).
 */
export async function borrarEmpresaDePrueba(empresaId: string) {
  await prisma.checklistRealizado.deleteMany({ where: { vehiculo: { empresaId } } });

  let pendientes: string[] = [...MODELOS_CON_EMPRESA, "Usuario"];

  for (let intento = 0; intento < pendientes.length + 1 && pendientes.length > 0; intento++) {
    const siguientes: string[] = [];
    for (const modelo of pendientes) {
      try {
        await delegatePrisma(modelo).deleteMany({ where: { empresaId } });
      } catch {
        siguientes.push(modelo);
      }
    }
    if (siguientes.length === pendientes.length) break; // sin progreso: no insistir para siempre
    pendientes = siguientes;
  }

  if (pendientes.length > 0) {
    throw new Error(
      `borrarEmpresaDePrueba: no se pudieron borrar estos modelos para empresaId=${empresaId}: ${pendientes.join(", ")}`
    );
  }

  await prisma.empresa.delete({ where: { id: empresaId } });
}
