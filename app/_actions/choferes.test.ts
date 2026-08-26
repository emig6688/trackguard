import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearChofer, actualizarChofer, darDeBajaChofer, reactivarChofer } from "@/app/_actions/choferes";
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
  return `test-vitest-chofer-${sufijoCorto()}@example.local`;
}

// Igual que usuarios.ts: email/dni de Usuario son únicos en TODA la tabla
// (no por empresa), así que se levantan dos empresas de prueba para poder
// verificar el rechazo de duplicados cruzados entre empresas.
describe("app/_actions/choferes.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };
  let encargadoMantenimiento: { id: string };

  let empresaId2: string;
  let prisma2: ScopedPrismaClient;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("choferes");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
    encargadoMantenimiento = await crearUsuarioDePrueba(empresaId, "ENCARGADO_MANTENIMIENTO");

    const empresa2 = await crearEmpresaDePrueba("choferes2");
    empresaId2 = empresa2.empresaId;
    prisma2 = empresa2.prisma;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
    await borrarEmpresaDePrueba(empresaId2);
  });

  function datosChoferValidos(overrides: Record<string, string> = {}) {
    return {
      nombre: "Chofer Test",
      email: emailUnico(),
      password: "test1234",
      telefono: "1122334455",
      numeroLicencia: "LIC-123",
      categoriaLicencia: "D1",
      legajo: "LEG-1",
      ...overrides,
    };
  }

  describe("crearChofer", () => {
    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un chofer", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(crearChofer(undefined, formData(datosChoferValidos()))).rejects.toThrow(AutorizacionError);
    });

    it("valida los campos requeridos", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearChofer(undefined, formData({ email: "no-es-un-email" }));
      expect(resultado?.fieldErrors?.nombre).toBeTruthy();
      expect(resultado?.fieldErrors?.email).toBeTruthy();
      expect(resultado?.fieldErrors?.password).toBeTruthy();
    });

    it("ADMIN crea un chofer con su perfil, y redirige a /choferes/:id", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const email = emailUnico();
      let choferId: string | undefined;
      try {
        await crearChofer(undefined, formData(datosChoferValidos({ email })));
      } catch (err) {
        if (!(err instanceof RedirectDeTest)) throw err;
        choferId = err.url.split("/").pop();
      }
      const creado = await prisma.usuario.findUniqueOrThrow({
        where: { email },
        include: { perfilChofer: true },
      });
      expect(creado.rol).toBe("CHOFER");
      expect(creado.empresaId).toBe(empresaId);
      expect(creado.perfilChofer?.numeroLicencia).toBe("LIC-123");
      expect(creado.perfilChofer?.categoriaLicencia).toBe("D1");
      if (choferId) expect(creado.id).toBe(choferId);
    });

    it("ENCARGADO_MANTENIMIENTO también puede crear un chofer", async () => {
      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      const email = emailUnico();
      await expect(crearChofer(undefined, formData(datosChoferValidos({ email })))).rejects.toThrow(RedirectDeTest);
      const creado = await prisma.usuario.findUniqueOrThrow({ where: { email } });
      expect(creado.rol).toBe("CHOFER");
    });

    it("rechaza un email ya usado por un usuario de OTRA empresa (email es único global)", async () => {
      const emailCruzado = emailUnico();
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailCruzado,
          nombre: "Usuario otra empresa",
          passwordHash: "x",
          rol: "CHOFER",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearChofer(undefined, formData(datosChoferValidos({ email: emailCruzado })));
      expect(resultado?.error).toMatch(/ya existe un usuario con ese email/i);
    });

    it("rechaza un DNI ya usado por un usuario de OTRA empresa (dni es único global)", async () => {
      const dniCruzado = `${Date.now()}`.slice(-8);
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          dni: dniCruzado,
          nombre: "Usuario otra empresa DNI",
          passwordHash: "x",
          rol: "CHOFER",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearChofer(
        undefined,
        formData(datosChoferValidos({ dni: dniCruzado }))
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese dni/i);
    });
  });

  describe("actualizarChofer", () => {
    async function crearChoferDePrueba() {
      return prisma.usuario.create({
        data: {
          empresaId,
          email: emailUnico(),
          nombre: "Chofer Original",
          passwordHash: "x",
          rol: "CHOFER",
          perfilChofer: { create: { numeroLicencia: "ORIG-1" } },
        },
      });
    }

    it("edita nombre, teléfono, dni y perfil, y redirige al detalle", async () => {
      const chofer = await crearChoferDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nuevoEmail = emailUnico();
      const fd = formData(
        datosChoferValidos({ email: nuevoEmail, nombre: "Chofer Editado", numeroLicencia: "NUEVA-99" })
      );
      await expect(actualizarChofer(chofer.id, undefined, fd)).rejects.toThrow(RedirectDeTest);

      const actualizado = await prisma.usuario.findUniqueOrThrow({
        where: { id: chofer.id },
        include: { perfilChofer: true },
      });
      expect(actualizado.nombre).toBe("Chofer Editado");
      expect(actualizado.email).toBe(nuevoEmail);
      expect(actualizado.perfilChofer?.numeroLicencia).toBe("NUEVA-99");
    });

    it("rechaza un email ya usado por otro usuario", async () => {
      const chofer1 = await crearChoferDePrueba();
      const chofer2 = await crearChoferDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarChofer(
        chofer2.id,
        undefined,
        formData(datosChoferValidos({ email: chofer1.email }))
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese email/i);
    });

    it("rechaza un DNI ya usado por un usuario de otra empresa", async () => {
      const dniCruzado = `${Date.now()}`.slice(-8) + "2";
      await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          dni: dniCruzado,
          nombre: "Usuario otra empresa DNI 2",
          passwordHash: "x",
          rol: "CHOFER",
        },
      });
      const chofer = await crearChoferDePrueba();
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await actualizarChofer(
        chofer.id,
        undefined,
        formData(datosChoferValidos({ email: chofer.email, dni: dniCruzado }))
      );
      expect(resultado?.error).toMatch(/ya existe un usuario con ese dni/i);
    });

    it("no puede editar un chofer de otra empresa (aislamiento por tenant)", async () => {
      const choferDeOtraEmpresa = await prisma2.usuario.create({
        data: {
          empresaId: empresaId2,
          email: emailUnico(),
          nombre: "De otra empresa",
          passwordHash: "x",
          rol: "CHOFER",
        },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(
        actualizarChofer(choferDeOtraEmpresa.id, undefined, formData(datosChoferValidos({ email: emailUnico() })))
      ).rejects.toThrow();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede editar un chofer", async () => {
      const chofer = await crearChoferDePrueba();
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(
        actualizarChofer(chofer.id, undefined, formData(datosChoferValidos({ email: emailUnico() })))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("darDeBajaChofer / reactivarChofer", () => {
    it("da de baja y reactiva un chofer", async () => {
      const chofer = await prisma.usuario.create({
        data: { empresaId, email: emailUnico(), nombre: "Chofer Baja", passwordHash: "x", rol: "CHOFER" },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });

      await darDeBajaChofer(chofer.id, formData({ observacion: "Renunció" }));
      const dado_de_baja = await prisma.usuario.findUniqueOrThrow({ where: { id: chofer.id } });
      expect(dado_de_baja.activo).toBe(false);
      expect(dado_de_baja.observacionBaja).toBe("Renunció");
      expect(dado_de_baja.fechaBaja).not.toBeNull();

      await reactivarChofer(chofer.id);
      const reactivado = await prisma.usuario.findUniqueOrThrow({ where: { id: chofer.id } });
      expect(reactivado.activo).toBe(true);
      expect(reactivado.observacionBaja).toBeNull();
      expect(reactivado.fechaBaja).toBeNull();
    });

    it("exige un motivo para dar de baja", async () => {
      const chofer = await prisma.usuario.create({
        data: { empresaId, email: emailUnico(), nombre: "Chofer Baja 2", passwordHash: "x", rol: "CHOFER" },
      });
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      await expect(darDeBajaChofer(chofer.id, formData({ observacion: "" }))).rejects.toThrow();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede dar de baja ni reactivar un chofer", async () => {
      const chofer = await prisma.usuario.create({
        data: { empresaId, email: emailUnico(), nombre: "Chofer Baja 3", passwordHash: "x", rol: "CHOFER" },
      });
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(darDeBajaChofer(chofer.id, formData({ observacion: "Motivo" }))).rejects.toThrow(
        AutorizacionError
      );
      await expect(reactivarChofer(chofer.id)).rejects.toThrow(AutorizacionError);
    });
  });
});
