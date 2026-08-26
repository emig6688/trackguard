import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearUsuario, actualizarUsuario, darDeBajaUsuario, reactivarUsuario } from "@/app/_actions/usuarios";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function emailUnico() {
  return `test-vitest-usuario-${sufijoCorto()}@example.local`;
}

// email/dni de Usuario son únicos en TODA la tabla (no por empresa) — ver
// comentarios en app/_actions/usuarios.ts. Por eso este archivo levanta DOS
// empresas de prueba, para poder verificar que un duplicado ES rechazado
// aunque pertenezca a otra empresa.
describe("app/_actions/usuarios.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  let empresaId2: string;
  let prisma2: ScopedPrismaClient;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("usuarios");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");

    const empresa2 = await crearEmpresaDePrueba("usuarios2");
    empresaId2 = empresa2.empresaId;
    prisma2 = empresa2.prisma;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
    await borrarEmpresaDePrueba(empresaId2);
  });

  describe("crearUsuario", () => {
    it("un rol fuera de ADMIN no puede crear un usuario", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      const fd = formData({
        nombre: "Test",
        email: emailUnico(),
        password: "test1234",
        rol: "GERENTE",
      });
      await expect(crearUsuario(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("valida los campos requeridos", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearUsuario(undefined, formData({ email: "no-es-un-email" }));
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
      expect(resultado?.fieldErrors?.email).toBeTruthy();
      expect(resultado?.fieldErrors?.password).toBeTruthy();
      expect(resultado?.fieldErrors?.rol).toBeTruthy();
    });

    it("crea un usuario y redirige a /usuarios", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const email = emailUnico();
      const fd = formData({
        nombre: "Nuevo Usuario",
        email,
        password: "test1234",
        telefono: "1122334455",
        rol: "GERENTE",
      });
      await expect(crearUsuario(undefined, fd)).rejects.toThrow(RedirectDeTest);
      const creado = await prisma.usuario.findUniqueOrThrow({ where: { email } });
      expect(creado.nombre).toBe("Nuevo Usuario");
      expect(creado.rol).toBe("GERENTE");
      expect(creado.empresaId).toBe(empresaId);
    });

    it("rechaza un email ya usado por otro usuario de la MISMA empresa", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const adminExistente = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
      const fd = formData({ nombre: "Duplicado", email: adminExistente.email, password: "test1234", rol: "GERENTE" });
      const resultado = await crearUsuario(undefined, fd);
      expect(resultado?.error).toMatch(/ya existe un usuario con ese email/i);
    });

    it("rechaza un email ya usado por un usuario de OTRA empresa (email es único global)", async () => {
      const emailCruzado = emailUnico();
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailCruzado,
          nombre: "Usuario otra empresa",
          passwordHash: "x",
          rol: "GERENTE",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearUsuario(
        undefined,
        formData({ nombre: "Intento", email: emailCruzado, password: "test1234", rol: "GERENTE" })
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese email/i);
    });

    it("rechaza un DNI ya usado por otro usuario de OTRA empresa (dni es único global)", async () => {
      const dniCruzado = `${Date.now()}`.slice(-8);
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          dni: dniCruzado,
          nombre: "Usuario otra empresa DNI",
          passwordHash: "x",
          rol: "GERENTE",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearUsuario(
        undefined,
        formData({ nombre: "Intento", email: emailUnico(), dni: dniCruzado, password: "test1234", rol: "GERENTE" })
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese dni/i);
    });
  });

  describe("actualizarUsuario", () => {
    it("edita nombre, email, teléfono y rol, y redirige al detalle", async () => {
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nuevoEmail = emailUnico();
      const fd = formData({ nombre: "Editado", email: nuevoEmail, telefono: "555", rol: "CONTADOR" });
      await expect(actualizarUsuario(usuario.id, undefined, fd)).rejects.toThrow(RedirectDeTest);
      const actualizado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(actualizado.nombre).toBe("Editado");
      expect(actualizado.email).toBe(nuevoEmail);
      expect(actualizado.rol).toBe("CONTADOR");
    });

    it("rechaza un email ya usado por otro usuario", async () => {
      const usuario1 = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const usuario2 = await crearUsuarioDePrueba(empresaId, "CONTADOR");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarUsuario(
        usuario2.id,
        undefined,
        formData({ nombre: "X", email: usuario1.email, telefono: "", rol: "CONTADOR" })
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese email/i);
    });

    it("rechaza un DNI ya usado por otro usuario de otra empresa", async () => {
      const dniCruzado = `${Date.now()}`.slice(-8) + "1";
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          dni: dniCruzado,
          nombre: "Usuario otra empresa DNI 2",
          passwordHash: "x",
          rol: "GERENTE",
        },
      });
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarUsuario(
        usuario.id,
        undefined,
        formData({ nombre: "X", email: usuario.email, dni: dniCruzado, telefono: "", rol: "GERENTE" })
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese dni/i);
    });

    it("no puede editar un usuario de otra empresa (aislamiento por tenant)", async () => {
      const usuarioDeOtraEmpresa = await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          nombre: "De otra empresa",
          passwordHash: "x",
          rol: "GERENTE",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(
        actualizarUsuario(
          usuarioDeOtraEmpresa.id,
          undefined,
          formData({ nombre: "Hackeado", email: emailUnico(), telefono: "", rol: "GERENTE" })
        )
      ).rejects.toThrow();
    });

    it("un rol fuera de ADMIN no puede editar un usuario", async () => {
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(
        actualizarUsuario(usuario.id, undefined, formData({ nombre: "X", email: emailUnico(), telefono: "", rol: "GERENTE" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("darDeBajaUsuario / reactivarUsuario", () => {
    it("da de baja y reactiva un usuario", async () => {
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });

      await darDeBajaUsuario(usuario.id, formData({ observacion: "Renunció" }));
      const dado_de_baja = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(dado_de_baja.activo).toBe(false);
      expect(dado_de_baja.observacionBaja).toBe("Renunció");
      expect(dado_de_baja.fechaBaja).not.toBeNull();

      await reactivarUsuario(usuario.id);
      const reactivado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      expect(reactivado.activo).toBe(true);
      expect(reactivado.observacionBaja).toBeNull();
      expect(reactivado.fechaBaja).toBeNull();
    });

    it("exige un motivo para dar de baja", async () => {
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(darDeBajaUsuario(usuario.id, formData({ observacion: "" }))).rejects.toThrow();
    });

    it("un rol fuera de ADMIN no puede dar de baja ni reactivar un usuario", async () => {
      const usuario = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(darDeBajaUsuario(usuario.id, formData({ observacion: "Motivo" }))).rejects.toThrow(
        AutorizacionError
      );
      await expect(reactivarUsuario(usuario.id)).rejects.toThrow(AutorizacionError);
    });
  });
});
