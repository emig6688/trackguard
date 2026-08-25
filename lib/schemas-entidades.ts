import { z } from "zod";
import { optionalInt, normalizarDni } from "@/lib/zod-helpers";

// Compartidos entre el alta individual (app/_actions/*.ts) y la importación
// masiva (app/_actions/importar.ts) — un archivo "use server" solo puede
// exportar funciones async, así que estos schemas no pueden vivir ahí.

export const articuloSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  descripcion: z.string().trim().optional(),
  unidadMedida: z.string().trim().optional(),
  stockActual: z.coerce.number().int().min(0).default(0),
  stockMinimo: z.coerce.number().int().min(0).default(0),
});

export const vehiculoSchema = z.object({
  patente: z.string().trim().min(3, "Patente requerida").max(20),
  marca: z.string().trim().min(1, "Marca requerida"),
  modelo: z.string().trim().min(1, "Modelo requerido"),
  anio: optionalInt({ min: 1980, max: 2100 }),
  tipo: z.enum(["CAMION", "ACOPLADO", "UTILITARIO", "OTRO"]),
  numeroInterno: z.string().trim().optional(),
  kmActual: z.coerce.number().int().min(0).default(0),
  horasEquipoFrio: optionalInt({ min: 0 }),
  tipoCarroceria: z.string().trim().optional(),
  equipoFrioTipo: z.string().trim().optional(),
});

export const crearChoferSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  email: z.string().trim().email("Email inválido"),
  dni: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizarDni(v) : undefined)),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  telefono: z.string().trim().optional(),
  numeroLicencia: z.string().trim().optional(),
  categoriaLicencia: z.string().trim().optional(),
  legajo: z.string().trim().optional(),
  fechaIngreso: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});
