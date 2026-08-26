import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  obtenerVapidPublicKey,
  guardarPushSubscription,
  eliminarPushSubscription,
  enviarPushDePrueba,
} from "@/app/_actions/pushSubscriptions";
import { AutorizacionError } from "@/lib/permisos";
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

describe("app/_actions/pushSubscriptions.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let usuario: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("push");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    usuario = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("obtenerVapidPublicKey", () => {
    it("devuelve el valor de la variable de entorno (o null si no está seteada)", async () => {
      const resultado = await obtenerVapidPublicKey();
      expect(resultado).toBe(process.env.VAPID_PUBLIC_KEY ?? null);
    });
  });

  describe("guardarPushSubscription", () => {
    it("crea una suscripción nueva ligada al usuario logueado", async () => {
      mockearSesion({ id: usuario.id, rol: "ADMIN", empresaId });
      const endpoint = `https://push.example.local/ep-${sufijoCorto()}`;
      await guardarPushSubscription(
        { endpoint, keys: { p256dh: "clave-p256dh", auth: "clave-auth" } },
        "Mozilla/5.0 test"
      );
      const sub = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } });
      expect(sub.usuarioId).toBe(usuario.id);
      expect(sub.empresaId).toBe(empresaId);
      expect(sub.p256dh).toBe("clave-p256dh");
    });

    it("un upsert sobre el mismo endpoint actualiza en vez de duplicar", async () => {
      mockearSesion({ id: usuario.id, rol: "ADMIN", empresaId });
      const endpoint = `https://push.example.local/ep-${sufijoCorto()}`;
      await guardarPushSubscription({ endpoint, keys: { p256dh: "a", auth: "b" } });
      await guardarPushSubscription({ endpoint, keys: { p256dh: "nueva-clave", auth: "b2" } });

      const coincidencias = await prisma.pushSubscription.findMany({ where: { endpoint } });
      expect(coincidencias).toHaveLength(1);
      expect(coincidencias[0].p256dh).toBe("nueva-clave");
    });

    it("requiere sesión", async () => {
      mockearSesion(null);
      await expect(
        guardarPushSubscription({ endpoint: `https://x/${sufijoCorto()}`, keys: { p256dh: "a", auth: "b" } })
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("eliminarPushSubscription", () => {
    it("borra la suscripción propia por endpoint", async () => {
      mockearSesion({ id: usuario.id, rol: "ADMIN", empresaId });
      const endpoint = `https://push.example.local/ep-${sufijoCorto()}`;
      await guardarPushSubscription({ endpoint, keys: { p256dh: "a", auth: "b" } });

      await eliminarPushSubscription(endpoint);
      const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      expect(sub).toBeNull();
    });

    it("no borra la suscripción de otro usuario aunque se conozca el endpoint", async () => {
      const otro = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: otro.id, rol: "GERENTE", empresaId });
      const endpoint = `https://push.example.local/ep-${sufijoCorto()}`;
      await guardarPushSubscription({ endpoint, keys: { p256dh: "a", auth: "b" } });

      mockearSesion({ id: usuario.id, rol: "ADMIN", empresaId });
      await eliminarPushSubscription(endpoint);

      const sigueViva = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      expect(sigueViva).not.toBeNull();
    });
  });

  describe("enviarPushDePrueba", () => {
    it("no falla al mandarse un push de prueba a sí mismo (enviarPush está mockeado)", async () => {
      mockearSesion({ id: usuario.id, rol: "ADMIN", empresaId });
      await expect(enviarPushDePrueba()).resolves.toBeUndefined();
    });

    it("requiere sesión", async () => {
      mockearSesion(null);
      await expect(enviarPushDePrueba()).rejects.toThrow(AutorizacionError);
    });
  });
});
