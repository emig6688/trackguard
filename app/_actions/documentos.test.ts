import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { crearDocumento } from "@/app/_actions/documentos";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/documentos.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };
  let vehiculoId: string;
  let tipoDocumentoId: string;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("documentos");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTDOC${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
    vehiculoId = vehiculo.id;

    const tipoDocumento = await prisma.tipoDocumentoConfig.create({
      data: { empresaId, codigo: `VTV-${sufijoCorto()}`, nombre: "VTV", aplicaA: "VEHICULO" },
    });
    tipoDocumentoId = tipoDocumento.id;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("crearDocumento", () => {
    it("crea un documento para un vehículo y revalida las rutas", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearDocumento(
        `/vehiculos/${vehiculoId}`,
        undefined,
        formData({
          entidadTipo: "VEHICULO",
          entidadId: vehiculoId,
          tipoDocumentoId,
          fechaVencimiento: "2027-01-01",
          numeroDocumento: "ABC123",
        })
      );
      expect(resultado?.success).toBe(true);
      const documento = await prisma.documento.findFirstOrThrow({ where: { entidadId: vehiculoId } });
      expect(documento.numeroDocumento).toBe("ABC123");
      expect(documento.entidadTipo).toBe("VEHICULO");
      expect(documento.empresaId).toBe(empresaId);
    });

    it("rechaza sin tipoDocumentoId (fieldErrors)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearDocumento(
        "/documentos",
        undefined,
        formData({ entidadTipo: "VEHICULO", entidadId: vehiculoId, tipoDocumentoId: "", fechaVencimiento: "2027-01-01" })
      );
      expect(resultado?.fieldErrors?.tipoDocumentoId).toBeTruthy();
    });

    it("rechaza sin fecha de vencimiento (fieldErrors)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearDocumento(
        "/documentos",
        undefined,
        formData({ entidadTipo: "VEHICULO", entidadId: vehiculoId, tipoDocumentoId, fechaVencimiento: "" })
      );
      expect(resultado?.fieldErrors?.fechaVencimiento).toBeTruthy();
    });

    it("rechaza un entidadTipo fuera del enum (fieldErrors)", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const resultado = await crearDocumento(
        "/documentos",
        undefined,
        formData({
          entidadTipo: "OTRO",
          entidadId: vehiculoId,
          tipoDocumentoId,
          fechaVencimiento: "2027-01-01",
        })
      );
      expect(resultado?.fieldErrors?.entidadTipo).toBeTruthy();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede crear un documento", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      await expect(
        crearDocumento(
          "/documentos",
          undefined,
          formData({
            entidadTipo: "VEHICULO",
            entidadId: vehiculoId,
            tipoDocumentoId,
            fechaVencimiento: "2027-01-01",
          })
        )
      ).rejects.toThrow(AutorizacionError);
    });
  });
});
