import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  obtenerNotificacionesPendientesDePopup,
  obtenerNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from "@/app/_actions/notificaciones";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/notificaciones.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let usuarioA: { id: string };
  let usuarioB: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("notificaciones");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    usuarioA = await crearUsuarioDePrueba(empresaId, "ADMIN");
    usuarioB = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearNotificacion(usuarioId: string, overrides: { leida?: boolean; mostradaEn?: Date | null } = {}) {
    return prisma.notificacion.create({
      data: {
        empresaId,
        usuarioId,
        tipo: "NUEVA_ORDEN_COMPRA",
        titulo: `Titulo-${sufijoCorto()}`,
        mensaje: "Mensaje de prueba",
        leida: overrides.leida ?? false,
        mostradaEn: overrides.mostradaEn ?? null,
      },
    });
  }

  describe("obtenerNotificacionesPendientesDePopup", () => {
    it("devuelve solo las pendientes del usuario logueado, y las marca como mostradas", async () => {
      const propia = await crearNotificacion(usuarioA.id);
      await crearNotificacion(usuarioB.id); // de otro usuario: no debe aparecer

      mockearSesion({ id: usuarioA.id, rol: "ADMIN", empresaId });
      const pendientes = await obtenerNotificacionesPendientesDePopup();
      expect(pendientes.map((n) => n.id)).toEqual([propia.id]);

      const actualizada = await prisma.notificacion.findUniqueOrThrow({ where: { id: propia.id } });
      expect(actualizada.mostradaEn).not.toBeNull();

      // La de usuarioB no fue tocada.
      const otra = await prisma.notificacion.findFirstOrThrow({ where: { usuarioId: usuarioB.id } });
      expect(otra.mostradaEn).toBeNull();

      // Llamando de nuevo ya no debería devolver la misma (ya se mostró).
      const segundaLlamada = await obtenerNotificacionesPendientesDePopup();
      expect(segundaLlamada.find((n) => n.id === propia.id)).toBeUndefined();
    });
  });

  describe("obtenerNotificaciones", () => {
    it("solo trae notificaciones propias y cuenta las no leídas propias", async () => {
      // Usuarios frescos para no interferir con los otros bloques de este archivo.
      const userC = await crearUsuarioDePrueba(empresaId, "ADMIN");
      const userD = await crearUsuarioDePrueba(empresaId, "ADMIN");
      await crearNotificacion(userC.id, { leida: false });
      await crearNotificacion(userC.id, { leida: true });
      const deUserD = await crearNotificacion(userD.id, { leida: false });

      mockearSesion({ id: userC.id, rol: "ADMIN", empresaId });
      const { notificaciones, noLeidas } = await obtenerNotificaciones();
      expect(notificaciones.length).toBe(2);
      expect(noLeidas).toBe(1);
      expect(notificaciones.some((n) => n.id === deUserD.id)).toBe(false);
    });
  });

  describe("marcarNotificacionLeida", () => {
    it("un usuario no puede marcar como leída una notificación ajena", async () => {
      const notifDeB = await crearNotificacion(usuarioB.id, { leida: false });

      mockearSesion({ id: usuarioA.id, rol: "ADMIN", empresaId });
      await marcarNotificacionLeida(notifDeB.id);

      const sinCambios = await prisma.notificacion.findUniqueOrThrow({ where: { id: notifDeB.id } });
      expect(sinCambios.leida).toBe(false);

      mockearSesion({ id: usuarioB.id, rol: "ADMIN", empresaId });
      await marcarNotificacionLeida(notifDeB.id);
      const marcada = await prisma.notificacion.findUniqueOrThrow({ where: { id: notifDeB.id } });
      expect(marcada.leida).toBe(true);
    });
  });

  describe("marcarTodasNotificacionesLeidas", () => {
    it("marca todas las no leídas del usuario logueado, sin tocar las de otro usuario", async () => {
      const n1 = await crearNotificacion(usuarioA.id, { leida: false });
      const n2 = await crearNotificacion(usuarioA.id, { leida: false });
      const deOtro = await crearNotificacion(usuarioB.id, { leida: false });

      mockearSesion({ id: usuarioA.id, rol: "ADMIN", empresaId });
      await marcarTodasNotificacionesLeidas();

      expect((await prisma.notificacion.findUniqueOrThrow({ where: { id: n1.id } })).leida).toBe(true);
      expect((await prisma.notificacion.findUniqueOrThrow({ where: { id: n2.id } })).leida).toBe(true);
      expect((await prisma.notificacion.findUniqueOrThrow({ where: { id: deOtro.id } })).leida).toBe(false);
    });
  });
});
