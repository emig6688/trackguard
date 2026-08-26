"use server";

import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireRole, ROLES_ADMIN_MANTENIMIENTO } from "@/lib/permisos";
import { aplicarPlanEstandarAVehiculo } from "@/lib/plan-mantenimiento-estandar";
import { articuloSchema, vehiculoSchema, crearChoferSchema } from "@/lib/schemas-entidades";

export type ImportarResultado = {
  error?: string;
  creados?: number;
  errores?: { fila: number; motivo: string }[];
};

type FilaExcel = { numero: number; valores: unknown[] };

// Los tres schemas comparten el mismo criterio de "primer motivo alcanza": no
// tiene sentido mostrarle al usuario los 5 errores de una fila mala, con el
// primero ya sabe qué campo corregir.
function primerMotivo(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

function celda(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String((v as { text: unknown }).text).trim() || undefined;
    if ("result" in v) return String((v as { result: unknown }).result).trim() || undefined;
    return undefined;
  }
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

async function leerFilas(file: File): Promise<FilaExcel[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const hoja = workbook.worksheets[0];
  if (!hoja) return [];

  const filas: FilaExcel[] = [];
  hoja.eachRow((row, numero) => {
    if (numero === 1) return; // fila de encabezado, no es dato
    const valores = (row.values as unknown[]).slice(1); // values[0] siempre es undefined en ExcelJS
    const vacia = valores.every((v) => celda(v) === undefined);
    if (!vacia) filas.push({ numero, valores });
  });
  return filas;
}

// Mismo criterio que lib/storage.ts (único punto de entrada de subida valida
// tipo/tamaño): el `accept=".xlsx"` del input es solo una sugerencia del
// navegador, no una garantía — acá se valida de verdad antes de intentar
// parsearlo con ExcelJS.
const TAMANIO_MAXIMO_IMPORT_BYTES = 5 * 1024 * 1024;

// Devuelve el File válido, o un string con el motivo de rechazo.
function archivoDeFormData(formData: FormData): File | string {
  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    return "Subí un archivo Excel.";
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return "El archivo tiene que ser un Excel (.xlsx) — descargá la plantilla y completala.";
  }
  if (file.size > TAMANIO_MAXIMO_IMPORT_BYTES) {
    return "El archivo es demasiado grande (máximo 5 MB).";
  }
  return file;
}

export async function importarPanolExcel(
  _prevState: ImportarResultado | undefined,
  formData: FormData
): Promise<ImportarResultado> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const resultadoArchivo = archivoDeFormData(formData);
  if (typeof resultadoArchivo === "string") return { error: resultadoArchivo };
  const file = resultadoArchivo;

  const filas = await leerFilas(file);
  const errores: { fila: number; motivo: string }[] = [];
  let creados = 0;

  for (const { numero, valores } of filas) {
    const parsed = articuloSchema.safeParse({
      nombre: celda(valores[0]),
      descripcion: celda(valores[1]),
      unidadMedida: celda(valores[2]),
      stockActual: celda(valores[3]),
      stockMinimo: celda(valores[4]),
    });
    if (!parsed.success) {
      errores.push({ fila: numero, motivo: primerMotivo(parsed.error) });
      continue;
    }
    await prisma.articuloPanol.create({ data: { ...parsed.data, empresaId: user.empresaId! } });
    creados++;
  }

  if (creados > 0) revalidatePath("/panol");
  return { creados, errores };
}

export async function importarVehiculosExcel(
  _prevState: ImportarResultado | undefined,
  formData: FormData
): Promise<ImportarResultado> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const resultadoArchivo = archivoDeFormData(formData);
  if (typeof resultadoArchivo === "string") return { error: resultadoArchivo };
  const file = resultadoArchivo;

  const filas = await leerFilas(file);
  const errores: { fila: number; motivo: string }[] = [];
  let creados = 0;

  for (const { numero, valores } of filas) {
    const parsed = vehiculoSchema.safeParse({
      patente: celda(valores[0]),
      marca: celda(valores[1]),
      modelo: celda(valores[2]),
      anio: celda(valores[3]),
      tipo: celda(valores[4])?.toUpperCase(),
      numeroInterno: celda(valores[5]),
      kmActual: celda(valores[6]),
      horasEquipoFrio: celda(valores[7]),
      tipoCarroceria: celda(valores[8]),
      equipoFrioTipo: celda(valores[9]),
    });
    if (!parsed.success) {
      errores.push({ fila: numero, motivo: primerMotivo(parsed.error) });
      continue;
    }
    try {
      const vehiculo = await prisma.vehiculo.create({
        data: { ...parsed.data, empresaId: user.empresaId! },
      });
      await aplicarPlanEstandarAVehiculo(prisma, user.empresaId!, vehiculo.id);
      creados++;
    } catch {
      errores.push({ fila: numero, motivo: `Ya existe un vehículo con la patente ${parsed.data.patente}.` });
    }
  }

  if (creados > 0) revalidatePath("/vehiculos");
  return { creados, errores };
}

export async function importarChoferesExcel(
  _prevState: ImportarResultado | undefined,
  formData: FormData
): Promise<ImportarResultado> {
  const { user, prisma } = await requireRole(ROLES_ADMIN_MANTENIMIENTO);
  const resultadoArchivo = archivoDeFormData(formData);
  if (typeof resultadoArchivo === "string") return { error: resultadoArchivo };
  const file = resultadoArchivo;

  const filas = await leerFilas(file);
  const errores: { fila: number; motivo: string }[] = [];
  let creados = 0;

  for (const { numero, valores } of filas) {
    const parsed = crearChoferSchema.safeParse({
      nombre: celda(valores[0]),
      email: celda(valores[1]),
      password: celda(valores[2]),
      dni: celda(valores[3]),
      telefono: celda(valores[4]),
      numeroLicencia: celda(valores[5]),
      categoriaLicencia: celda(valores[6]),
      legajo: celda(valores[7]),
      fechaIngreso: celda(valores[8]),
    });
    if (!parsed.success) {
      errores.push({ fila: numero, motivo: primerMotivo(parsed.error) });
      continue;
    }

    const { email, dni, password, nombre, telefono, ...perfil } = parsed.data;

    // email/dni únicos en toda la tabla, no por empresa — mismo criterio que
    // crearChofer en app/_actions/choferes.ts.
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      errores.push({ fila: numero, motivo: `Ya existe un usuario con el email ${email}.` });
      continue;
    }
    if (dni) {
      const dniExistente = await prisma.usuario.findUnique({ where: { dni } });
      if (dniExistente) {
        errores.push({ fila: numero, motivo: `Ya existe un usuario con el DNI ${dni}.` });
        continue;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.usuario.create({
      data: {
        empresaId: user.empresaId!,
        email,
        dni,
        passwordHash,
        nombre,
        telefono,
        rol: "CHOFER",
        perfilChofer: { create: perfil },
      },
    });
    creados++;
  }

  if (creados > 0) revalidatePath("/choferes");
  return { creados, errores };
}
