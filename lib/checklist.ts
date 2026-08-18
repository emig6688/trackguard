import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";

export function inicioDeHoy(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

export async function choferHizoChecklistHoy(prisma: ScopedPrismaClient, choferId: string): Promise<boolean> {
  const checklist = await prisma.checklistRealizado.findFirst({
    where: { choferId, fechaHora: { gte: inicioDeHoy() } },
  });
  return checklist != null;
}

export type ResultadoChecklistObligatorio = { bloqueado: false } | { bloqueado: true; motivo: string };

/**
 * Si la empresa activó "checklist obligatorio" (regla CHECKLIST_NO_REALIZADO
 * activa en /notificaciones) y el chofer todavía no hizo el checklist
 * pre-salida de hoy, bloquea la acción y avisa a los roles configurados —
 * así el encargado se entera de que alguien intentó saltearse el checklist.
 * Si la regla no está activa, nunca bloquea (comportamiento actual).
 */
export async function verificarChecklistDelDia(
  prisma: ScopedPrismaClient,
  empresaId: string,
  chofer: { id: string; nombre: string }
): Promise<ResultadoChecklistObligatorio> {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "CHECKLIST_NO_REALIZADO");
  if (!regla.activo) return { bloqueado: false };

  const yaHizo = await choferHizoChecklistHoy(prisma, chofer.id);
  if (yaHizo) return { bloqueado: false };

  if (regla.roles.length > 0 && regla.canales.length > 0) {
    const destinatarios = await usuariosDeEmpresaPorRol(prisma, empresaId, regla.roles);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatarios,
      regla.canales,
      "CHECKLIST_NO_REALIZADO",
      `Checklist pendiente: ${chofer.nombre}`,
      `${chofer.nombre} intentó usar la app sin haber completado el checklist pre-salida de hoy.`,
      "/choferes"
    );
  }

  return {
    bloqueado: true,
    motivo: "Tenés que completar el checklist pre-salida de hoy antes de continuar. Volvé al inicio y hacé el checklist primero.",
  };
}
