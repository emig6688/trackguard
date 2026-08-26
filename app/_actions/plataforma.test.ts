import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearEmpresa,
  alternarActivoEmpresa,
  actualizarEmpresa,
  actualizarAdminEmpresa,
} from "@/app/_actions/plataforma";
import { AutorizacionError } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// plataforma.ts es el módulo de SUPERADMIN: gestiona TODAS las empresas
// usando el cliente de Prisma crudo (sin scoping), así que estos tests
// trabajan directo contra `prisma` (no el scoped de una empresa) y arman su
// propia sesión SUPERADMIN (sin empresaId).
describe("app/_actions/plataforma.ts", () => {
  // Empresa fixture creada con el harness (para actualizarEmpresa/
  // actualizarAdminEmpresa, que no ejercitan crearEmpresa).
  let empresaId: string;
  let adminId: string;
  // Empresas creadas directamente por la acción crearEmpresa bajo test —
  // se acumulan acá para poder borrarlas todas en afterAll.
  const empresaIdsCreadas: string[] = [];

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("plataforma");
    empresaId = empresa.empresaId;
    const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
    adminId = admin.id;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
    for (const id of empresaIdsCreadas) {
      await borrarEmpresaDePrueba(id);
    }
  });

  describe("crearEmpresa", () => {
    it("un rol que no es SUPERADMIN no puede crear una empresa", async () => {
      mockearSesion({ id: adminId, rol: "ADMIN", empresaId });
      const fd = formData({
        nombreEmpresa: "No debería crearse",
        nombreAdmin: "Admin",
        email: `test-vitest-plataforma-${sufijoCorto()}@example.local`,
        password: "test1234",
      });
      await expect(crearEmpresa(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("valida los campos requeridos", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const resultado = await crearEmpresa(undefined, formData({}));
      expect(resultado?.fieldErrors?.nombreEmpresa).toBeTruthy();
      expect(resultado?.fieldErrors?.nombreAdmin).toBeTruthy();
      expect(resultado?.fieldErrors?.email).toBeTruthy();
      expect(resultado?.fieldErrors?.password).toBeTruthy();
    });

    it("crea una empresa nueva con su primer usuario ADMIN, el checklist estándar, y redirige", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const nombreEmpresa = `TEST_VITEST_plataforma_creada_${sufijoCorto()}`;
      const email = `test-vitest-plataforma-${sufijoCorto()}@example.local`;
      const fd = formData({ nombreEmpresa, nombreAdmin: "Admin Nuevo", email, password: "test1234" });

      await expect(crearEmpresa(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const nuevaEmpresa = await prisma.empresa.findFirstOrThrow({ where: { nombre: nombreEmpresa } });
      empresaIdsCreadas.push(nuevaEmpresa.id);

      const nuevoAdmin = await prisma.usuario.findFirstOrThrow({
        where: { empresaId: nuevaEmpresa.id, rol: "ADMIN" },
      });
      expect(nuevoAdmin.email).toBe(email);
      expect(nuevoAdmin.nombre).toBe("Admin Nuevo");

      const template = await prisma.checklistTemplate.findFirstOrThrow({
        where: { empresaId: nuevaEmpresa.id },
        include: { items: true },
      });
      expect(template.items).toHaveLength(9);
    });

    it("rechaza un email ya usado por otro usuario", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      // adminId (creado en beforeAll) ya tiene un email real en la tabla.
      const adminExistente = await prisma.usuario.findUniqueOrThrow({ where: { id: adminId } });
      const fd = formData({
        nombreEmpresa: `TEST_VITEST_plataforma_dup_${sufijoCorto()}`,
        nombreAdmin: "Otro admin",
        email: adminExistente.email,
        password: "test1234",
      });
      const resultado = await crearEmpresa(undefined, fd);
      expect(resultado?.error).toMatch(/ya existe un usuario/i);
      // No debe haber quedado una empresa huérfana (todo en una transacción).
      const empresaOrfana = await prisma.empresa.findFirst({
        where: { nombre: { startsWith: "TEST_VITEST_plataforma_dup_" } },
      });
      expect(empresaOrfana).toBeNull();
    });
  });

  describe("alternarActivoEmpresa", () => {
    it("activa/desactiva una empresa", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      await alternarActivoEmpresa(empresaId, false);
      expect((await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).activo).toBe(false);
      await alternarActivoEmpresa(empresaId, true);
      expect((await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } })).activo).toBe(true);
    });

    it("un rol que no es SUPERADMIN no puede alternar el estado de una empresa", async () => {
      mockearSesion({ id: adminId, rol: "ADMIN", empresaId });
      await expect(alternarActivoEmpresa(empresaId, false)).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarEmpresa", () => {
    it("actualiza los datos de contacto de la empresa", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const resultado = await actualizarEmpresa(
        empresaId,
        undefined,
        formData({
          nombre: "MEAT S.A. Actualizada",
          emailContacto: "contacto@example.local",
          telefono: "1234",
          direccion: "Calle Falsa 123",
          contactoNombre: "Juan Pérez",
        })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
      expect(actualizada.nombre).toBe("MEAT S.A. Actualizada");
      expect(actualizada.emailContacto).toBe("contacto@example.local");
      expect(actualizada.contactoNombre).toBe("Juan Pérez");
    });

    it("un emailContacto vacío se guarda como null", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      await actualizarEmpresa(
        empresaId,
        undefined,
        formData({ nombre: "Nombre Empresa", emailContacto: "", telefono: "", direccion: "", contactoNombre: "" })
      );
      const actualizada = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
      expect(actualizada.emailContacto).toBeNull();
    });

    it("valida que el nombre sea requerido", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const resultado = await actualizarEmpresa(empresaId, undefined, formData({ nombre: "" }));
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
    });

    it("un rol que no es SUPERADMIN no puede actualizar una empresa", async () => {
      mockearSesion({ id: adminId, rol: "ADMIN", empresaId });
      await expect(
        actualizarEmpresa(empresaId, undefined, formData({ nombre: "Intento no autorizado" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("actualizarAdminEmpresa", () => {
    it("actualiza nombre, email y contraseña del ADMIN de la empresa", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const nuevoEmail = `test-vitest-admin-editado-${sufijoCorto()}@example.local`;
      const resultado = await actualizarAdminEmpresa(
        adminId,
        empresaId,
        undefined,
        formData({ nombre: "Admin Editado", email: nuevoEmail, telefono: "999", password: "nuevaPass123" })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizado = await prisma.usuario.findUniqueOrThrow({ where: { id: adminId } });
      expect(actualizado.nombre).toBe("Admin Editado");
      expect(actualizado.email).toBe(nuevoEmail);
    });

    it("rechaza si el usuarioId no es ADMIN de esa empresa", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const noAdmin = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const resultado = await actualizarAdminEmpresa(
        noAdmin.id,
        empresaId,
        undefined,
        formData({ nombre: "X", email: `test-vitest-x-${sufijoCorto()}@example.local`, telefono: "" })
      );
      expect(resultado?.error).toMatch(/no se encontró ese administrador/i);
    });

    it("rechaza un email ya usado por otro usuario", async () => {
      mockearSesion({ id: "superadmin-test", rol: "SUPERADMIN", empresaId: null });
      const otro = await crearUsuarioDePrueba(empresaId, "GERENTE");
      const resultado = await actualizarAdminEmpresa(
        adminId,
        empresaId,
        undefined,
        formData({ nombre: "Admin", email: otro.email, telefono: "" })
      );
      expect(resultado?.error).toMatch(/ya existe un usuario/i);
    });

    it("un rol que no es SUPERADMIN no puede actualizar el admin de una empresa", async () => {
      mockearSesion({ id: adminId, rol: "ADMIN", empresaId });
      await expect(
        actualizarAdminEmpresa(
          adminId,
          empresaId,
          undefined,
          formData({ nombre: "X", email: "x@example.local", telefono: "" })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });
});
