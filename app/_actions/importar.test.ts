import { describe, it, expect, beforeAll, afterAll } from "vitest";
import ExcelJS from "exceljs";
import {
  importarPanolExcel,
  importarVehiculosExcel,
  importarChoferesExcel,
} from "@/app/_actions/importar";
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

// Construye un .xlsx real en memoria (fila 1 = encabezado, ignorada por
// leerFilas; a partir de la fila 2, los datos) con el mismo orden de columnas
// que documentan los comentarios de app/_actions/importar.ts, y lo envuelve
// en un File tal como llegaría desde un <input type="file">.
async function crearArchivoXlsx(filas: (string | number)[][], nombre = "import.xlsx"): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Datos");
  hoja.addRow(["encabezado"]);
  for (const fila of filas) hoja.addRow(fila);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function formDataConArchivo(file: File) {
  const fd = new FormData();
  fd.set("archivo", file);
  return fd;
}

describe("app/_actions/importar.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let admin: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("importar");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("importarPanolExcel", () => {
    it("crea un artículo por cada fila válida", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombre = `Art-${sufijoCorto()}`;
      const file = await crearArchivoXlsx([[nombre, "Repuesto de prueba", "UN", 10, 2]]);

      const resultado = await importarPanolExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(0);

      const articulo = await prisma.articuloPanol.findFirstOrThrow({ where: { nombre } });
      expect(articulo.stockActual).toBe(10);
      expect(articulo.stockMinimo).toBe(2);
      expect(articulo.empresaId).toBe(empresaId);
    });

    it("reporta una fila inválida con su número y motivo, sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const nombreValido = `Art-${sufijoCorto()}`;
      // Fila 2: nombre vacío -> inválida. Fila 3: válida.
      const file = await crearArchivoXlsx([
        ["", "sin nombre", "UN", 1, 0],
        [nombreValido, "", "UN", 1, 0],
      ]);

      const resultado = await importarPanolExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].fila).toBe(2);
      expect(resultado.errores?.[0].motivo).toEqual(expect.any(String));
      expect(resultado.errores?.[0].motivo.length).toBeGreaterThan(0);

      const creado = await prisma.articuloPanol.findFirst({ where: { nombre: nombreValido } });
      expect(creado).not.toBeNull();
    });

    it("rechaza un archivo que no sea .xlsx", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const fd = new FormData();
      fd.set("archivo", new File(["no soy un excel"], "notas.txt", { type: "text/plain" }));
      const resultado = await importarPanolExcel(undefined, fd);
      expect(resultado.error).toMatch(/excel/i);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede importar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const file = await crearArchivoXlsx([[`Art-${sufijoCorto()}`, "", "UN", 1, 0]]);
      await expect(importarPanolExcel(undefined, formDataConArchivo(file))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("importarVehiculosExcel", () => {
    it("crea un vehículo por cada fila válida y le aplica el plan estándar", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const patente = `IMP${sufijoCorto()}`;
      const file = await crearArchivoXlsx([
        [patente, "Marca", "Modelo", 2020, "camion", "INT-1", 1000, 50, "furgon", "electrico"],
      ]);

      const resultado = await importarVehiculosExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(0);

      const vehiculo = await prisma.vehiculo.findFirstOrThrow({ where: { patente } });
      expect(vehiculo.tipo).toBe("CAMION");
      expect(vehiculo.kmActual).toBe(1000);
      expect(vehiculo.empresaId).toBe(empresaId);
    });

    it("reporta una fila con tipo inválido sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const patenteValida = `IMP${sufijoCorto()}`;
      const file = await crearArchivoXlsx([
        [`IMP${sufijoCorto()}`, "Marca", "Modelo", 2020, "NOEXISTE", "", 0, 0, "", ""],
        [patenteValida, "Marca", "Modelo", 2020, "camion", "", 0, 0, "", ""],
      ]);

      const resultado = await importarVehiculosExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].fila).toBe(2);

      const creado = await prisma.vehiculo.findFirst({ where: { patente: patenteValida } });
      expect(creado).not.toBeNull();
    });

    it("rechaza una patente duplicada por fila, sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const patenteExistente = `IMP${sufijoCorto()}`;
      await prisma.vehiculo.create({
        data: { empresaId, patente: patenteExistente, marca: "Test", modelo: "Test", tipo: "CAMION" },
      });
      const patenteNueva = `IMP${sufijoCorto()}`;
      const file = await crearArchivoXlsx([
        [patenteExistente, "Marca", "Modelo", 2020, "camion", "", 0, 0, "", ""],
        [patenteNueva, "Marca", "Modelo", 2020, "camion", "", 0, 0, "", ""],
      ]);

      const resultado = await importarVehiculosExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].fila).toBe(2);
      expect(resultado.errores?.[0].motivo).toMatch(new RegExp(patenteExistente));

      const nueva = await prisma.vehiculo.findFirst({ where: { patente: patenteNueva } });
      expect(nueva).not.toBeNull();
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede importar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const file = await crearArchivoXlsx([[`IMP${sufijoCorto()}`, "Marca", "Modelo", 2020, "camion", "", 0, 0, "", ""]]);
      await expect(importarVehiculosExcel(undefined, formDataConArchivo(file))).rejects.toThrow(AutorizacionError);
    });
  });

  describe("importarChoferesExcel", () => {
    it("crea un usuario CHOFER con su perfil por cada fila válida", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const email = `test-vitest-import-${sufijoCorto()}@example.local`;
      const file = await crearArchivoXlsx([
        ["Chofer de prueba", email, "clave123", "", "", "LIC-1", "B", "L-1", "2020-01-01"],
      ]);

      const resultado = await importarChoferesExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(0);

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { email },
        include: { perfilChofer: true },
      });
      expect(usuario.rol).toBe("CHOFER");
      expect(usuario.perfilChofer?.numeroLicencia).toBe("LIC-1");
    });

    it("reporta un email inválido sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const emailValido = `test-vitest-import-${sufijoCorto()}@example.local`;
      const file = await crearArchivoXlsx([
        ["Chofer malo", "no-es-un-email", "clave123", "", "", "", "", "", ""],
        ["Chofer bueno", emailValido, "clave123", "", "", "", "", "", ""],
      ]);

      const resultado = await importarChoferesExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].fila).toBe(2);

      const creado = await prisma.usuario.findUnique({ where: { email: emailValido } });
      expect(creado).not.toBeNull();
    });

    it("rechaza un email duplicado por fila, sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const existente = await crearUsuarioDePrueba(empresaId, "CHOFER");
      const emailNuevo = `test-vitest-import-${sufijoCorto()}@example.local`;
      const file = await crearArchivoXlsx([
        ["Chofer duplicado", existente.email, "clave123", "", "", "", "", "", ""],
        ["Chofer nuevo", emailNuevo, "clave123", "", "", "", "", "", ""],
      ]);

      const resultado = await importarChoferesExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(1);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].fila).toBe(2);
      expect(resultado.errores?.[0].motivo).toMatch(/ya existe/i);

      const nuevo = await prisma.usuario.findUnique({ where: { email: emailNuevo } });
      expect(nuevo).not.toBeNull();
    });

    it("rechaza un DNI duplicado por fila, sin abortar el resto", async () => {
      mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
      const dniExistente = `DNI${sufijoCorto()}`;
      await prisma.usuario.create({
        data: {
          empresaId,
          email: `test-vitest-import-${sufijoCorto()}@example.local`,
          nombre: "Existente",
          passwordHash: "x",
          rol: "CHOFER",
          dni: dniExistente,
        },
      });
      const emailNuevo = `test-vitest-import-${sufijoCorto()}@example.local`;
      const file = await crearArchivoXlsx([
        ["Chofer con dni duplicado", emailNuevo, "clave123", dniExistente, "", "", "", "", ""],
      ]);

      const resultado = await importarChoferesExcel(undefined, formDataConArchivo(file));
      expect(resultado.creados).toBe(0);
      expect(resultado.errores).toHaveLength(1);
      expect(resultado.errores?.[0].motivo).toMatch(/dni/i);
    });

    it("un rol fuera de ROLES_ADMIN_MANTENIMIENTO no puede importar", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const file = await crearArchivoXlsx([
        ["X", `test-vitest-import-${sufijoCorto()}@example.local`, "clave123", "", "", "", "", "", ""],
      ]);
      await expect(importarChoferesExcel(undefined, formDataConArchivo(file))).rejects.toThrow(AutorizacionError);
    });
  });
});
