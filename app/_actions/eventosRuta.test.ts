import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registrarEventoRuta, cerrarRutaSinNovedades } from "@/app/_actions/eventosRuta";
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

describe("app/_actions/eventosRuta.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let templateId: string;
  let vehiculoGeneral: { id: string; patente: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("eventosRuta");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    const template = await prisma.checklistTemplate.create({
      data: { empresaId, nombre: "Checklist test" },
    });
    templateId = template.id;

    vehiculoGeneral = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTEVR${sufijoCorto()}`, marca: "Test", modelo: "Test" },
    });
  });

  afterAll(async () => {
    // ChecklistRealizado no tiene empresaId propio (ver comentario en
    // schema.prisma) y por lo tanto no está en MODELOS_CON_EMPRESA — el
    // borrado genérico de borrarEmpresaDePrueba no lo alcanza, y sus FKs a
    // Vehiculo/ChecklistTemplate/Usuario bloquean el borrado de esos modelos.
    // Se limpia acá a mano antes de delegar el resto al helper compartido.
    await prisma.checklistRealizado.deleteMany({ where: { vehiculo: { empresaId } } });
    await borrarEmpresaDePrueba(empresaId);
  });

  async function crearVehiculo() {
    return prisma.vehiculo.create({
      data: { empresaId, patente: `TSTEVR${sufijoCorto()}`, marca: "Test", modelo: "Test" },
    });
  }

  async function crearChecklistPresalida(choferId: string, vehiculoId: string, horasAtras = 0) {
    return prisma.checklistRealizado.create({
      data: {
        templateId,
        vehiculoId,
        choferId,
        momento: "PRESALIDA",
        fechaHora: new Date(Date.now() - horasAtras * 60 * 60 * 1000),
      },
    });
  }

  describe("registrarEventoRuta", () => {
    it("un rol fuera de ROLES_MOBILE_CHOFER no puede registrar un evento de ruta", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      const fd = formData({ vehiculoId: vehiculoGeneral.id, tipo: "DESPERFECTO", descripcion: "Test" });
      await expect(registrarEventoRuta(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("exige vehiculoId", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(undefined, formData({ tipo: "DESPERFECTO", descripcion: "Test" }));
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("exige un tipo de evento válido", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(
        undefined,
        formData({ vehiculoId: "cualquiera", descripcion: "Test" })
      );
      expect(resultado?.error).toMatch(/tipo de evento/i);
    });

    it("exige descripción", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(
        undefined,
        formData({ vehiculoId: "cualquiera", tipo: "DESPERFECTO" })
      );
      expect(resultado?.error).toMatch(/describí/i);
    });

    it("rechaza un vehículo inexistente", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(
        undefined,
        formData({ vehiculoId: "no-existe-123", tipo: "DESPERFECTO", descripcion: "Test" })
      );
      expect(resultado?.error).toMatch(/vehículo inválido/i);
    });

    it("bloquea si el checklist obligatorio está activo y el chofer no lo hizo hoy", async () => {
      const regla = await prisma.reglaNotificacion.create({
        data: { empresaId, tipo: "CHECKLIST_NO_REALIZADO", activo: true, roles: [], canales: [] },
      });
      try {
        const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
        mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
        const resultado = await registrarEventoRuta(
          undefined,
          formData({ vehiculoId: vehiculoGeneral.id, tipo: "DESPERFECTO", descripcion: "Test" })
        );
        expect(resultado?.error).toMatch(/checklist/i);
      } finally {
        await prisma.reglaNotificacion.delete({ where: { id: regla.id } });
      }
    });

    it("sin ningún checklist pre-salida hecho hoy, no hay reparto abierto para cerrar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(
        undefined,
        formData({ vehiculoId: vehiculoGeneral.id, tipo: "DESPERFECTO", descripcion: "Test" })
      );
      expect(resultado?.error).toMatch(/no tenés ningún reparto abierto/i);
    });

    it("si el checklist de hoy fue con otro vehículo, exige cerrar con ese", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculoA = await crearVehiculo();
      const vehiculoB = await crearVehiculo();
      await crearChecklistPresalida(chofer.id, vehiculoA.id);
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await registrarEventoRuta(
        undefined,
        formData({ vehiculoId: vehiculoB.id, tipo: "DESPERFECTO", descripcion: "Test" })
      );
      expect(resultado?.error).toMatch(new RegExp(vehiculoA.patente));
    });

    it("registra el evento, genera una OT nueva con área y prioridad clasificadas, y redirige", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      await crearChecklistPresalida(chofer.id, vehiculo.id);
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });

      const descripcion = `Se rompieron los frenos ${sufijoCorto()}`;
      const archivo = new File(["contenido"], "foto.jpg", { type: "image/jpeg" });
      const fd = formData({ vehiculoId: vehiculo.id, tipo: "DESPERFECTO", descripcion });
      fd.set("archivo", archivo);
      fd.set("tanqueLleno", "on");
      await expect(registrarEventoRuta(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const evento = await prisma.eventoRuta.findFirstOrThrow({ where: { descripcion } });
      expect(evento.tipo).toBe("DESPERFECTO");
      expect(evento.choferId).toBe(chofer.id);
      expect(evento.vehiculoId).toBe(vehiculo.id);
      expect(evento.tanqueLleno).toBe(true);
      expect(evento.archivoId).not.toBeNull();

      const ot = await prisma.ordenDeTrabajo.findFirstOrThrow({ where: { eventoRutaId: evento.id } });
      expect(ot.areaReparacion).toBe("FRENOS");
      expect(ot.prioridad).toBe("ALTA");
      expect(ot.estado).toBe("PENDIENTE_APROBACION");
      expect(ot.origen).toBe("EVENTO_RUTA");
    });

    it("una OT nace APROBADA sin asignar si la empresa activó auto-aprobación de mecánicos", async () => {
      await prisma.empresa.update({ where: { id: empresaId }, data: { autoAprobacionMecanicosActiva: true } });
      try {
        const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
        const vehiculo = await crearVehiculo();
        await crearChecklistPresalida(chofer.id, vehiculo.id);
        mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });

        const descripcion = `No enciende el motor ${sufijoCorto()}`;
        await expect(
          registrarEventoRuta(undefined, formData({ vehiculoId: vehiculo.id, tipo: "INCIDENTE", descripcion }))
        ).rejects.toThrow(RedirectDeTest);

        const evento = await prisma.eventoRuta.findFirstOrThrow({ where: { descripcion } });
        const ot = await prisma.ordenDeTrabajo.findFirstOrThrow({ where: { eventoRutaId: evento.id } });
        expect(ot.estado).toBe("APROBADA");
        expect(ot.prioridad).toBe("URGENTE");
      } finally {
        await prisma.empresa.update({ where: { id: empresaId }, data: { autoAprobacionMecanicosActiva: false } });
      }
    });

    it("si ya hay una OT abierta con el mismo problema, agrega la novedad ahí en vez de crear una nueva", async () => {
      const vehiculo = await crearVehiculo();
      const chofer1 = await crearUsuarioDePrueba(empresaId, "CHOFER");
      await crearChecklistPresalida(chofer1.id, vehiculo.id);
      mockearSesion({ id: chofer1.id, rol: "CHOFER", empresaId });

      const descripcion1 = `Pierde liquido de freno ${sufijoCorto()}`;
      await expect(
        registrarEventoRuta(undefined, formData({ vehiculoId: vehiculo.id, tipo: "DESPERFECTO", descripcion: descripcion1 }))
      ).rejects.toThrow(RedirectDeTest);
      expect(await prisma.ordenDeTrabajo.count({ where: { vehiculoId: vehiculo.id } })).toBe(1);

      // Un segundo chofer reporta un problema de la misma área (FRENOS) con
      // alguna palabra clave en común mientras la OT del primer reporte sigue
      // abierta: no debe crear una OT nueva, sino agregarse a la existente.
      const chofer2 = await crearUsuarioDePrueba(empresaId, "CHOFER");
      await crearChecklistPresalida(chofer2.id, vehiculo.id);
      mockearSesion({ id: chofer2.id, rol: "CHOFER", empresaId });
      const descripcion2 = `Pastilla de freno gastada ${sufijoCorto()}`;
      await expect(
        registrarEventoRuta(undefined, formData({ vehiculoId: vehiculo.id, tipo: "DESPERFECTO", descripcion: descripcion2 }))
      ).rejects.toThrow(RedirectDeTest);

      expect(await prisma.ordenDeTrabajo.count({ where: { vehiculoId: vehiculo.id } })).toBe(1);
      const otActualizada = await prisma.ordenDeTrabajo.findFirstOrThrow({ where: { vehiculoId: vehiculo.id } });
      expect(otActualizada.descripcion).toContain("[Reiterado");
      expect(otActualizada.descripcion).toContain(descripcion2);
    });
  });

  describe("cerrarRutaSinNovedades", () => {
    it("un rol fuera de ROLES_MOBILE_CHOFER no puede cerrar ruta sin novedades", async () => {
      const gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(
        cerrarRutaSinNovedades(undefined, formData({ vehiculoId: vehiculoGeneral.id }))
      ).rejects.toThrow(AutorizacionError);
    });

    it("exige vehiculoId", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await cerrarRutaSinNovedades(undefined, formData({}));
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("rechaza un vehículo inexistente", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await cerrarRutaSinNovedades(undefined, formData({ vehiculoId: "no-existe-456" }));
      expect(resultado?.error).toMatch(/vehículo inválido/i);
    });

    it("sin ningún checklist pre-salida hecho hoy, no hay reparto abierto para cerrar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await cerrarRutaSinNovedades(undefined, formData({ vehiculoId: vehiculoGeneral.id }));
      expect(resultado?.error).toMatch(/no tenés ningún reparto abierto/i);
    });

    it("si el checklist de hoy fue con otro vehículo, exige cerrar con ese", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculoA = await crearVehiculo();
      const vehiculoB = await crearVehiculo();
      await crearChecklistPresalida(chofer.id, vehiculoA.id);
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const resultado = await cerrarRutaSinNovedades(undefined, formData({ vehiculoId: vehiculoB.id }));
      expect(resultado?.error).toMatch(new RegExp(vehiculoA.patente));
    });

    it("cierra la ruta sin novedades: crea el evento, suma horas de equipo de frío y actualiza el km", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const vehiculo = await crearVehiculo();
      await crearChecklistPresalida(chofer.id, vehiculo.id, 2); // pre-salida hace 2hs
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });

      const fd = formData({ vehiculoId: vehiculo.id, kmAlMomento: "12345" });
      fd.set("tanqueLleno", "on");
      await expect(cerrarRutaSinNovedades(undefined, fd)).rejects.toThrow(RedirectDeTest);

      const evento = await prisma.eventoRuta.findFirstOrThrow({
        where: { choferId: chofer.id, vehiculoId: vehiculo.id },
      });
      expect(evento.tipo).toBe("OBSERVACION");
      expect(evento.descripcion).toBe("Cierre de ruta sin novedades.");
      expect(evento.tanqueLleno).toBe(true);

      const vehiculoActualizado = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculo.id } });
      expect(vehiculoActualizado.kmActual).toBe(12345);
      expect(vehiculoActualizado.horasEquipoFrio).toBe(2);
    });
  });
});
