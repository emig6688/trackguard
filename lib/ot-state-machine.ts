import type { EstadoOT, Rol } from "@/app/generated/prisma/client";

const ROLES_GESTION: Rol[] = ["ADMIN", "ENCARGADO_MANTENIMIENTO"];

const TRANSICIONES: Partial<Record<EstadoOT, Partial<Record<EstadoOT, Rol[]>>>> = {
  PENDIENTE_APROBACION: {
    APROBADA: ROLES_GESTION,
    CANCELADA: ROLES_GESTION,
  },
  APROBADA: {
    EN_PROGRESO: [...ROLES_GESTION, "MECANICO_INTERNO"],
    DERIVADA_EXTERNO: ROLES_GESTION,
    CANCELADA: ROLES_GESTION,
  },
  EN_PROGRESO: {
    COMPLETADA: [...ROLES_GESTION, "MECANICO_INTERNO"],
    DERIVADA_EXTERNO: ROLES_GESTION,
    CANCELADA: ROLES_GESTION,
  },
  DERIVADA_EXTERNO: {
    COMPLETADA: ROLES_GESTION,
    EN_PROGRESO: ROLES_GESTION,
    CANCELADA: ROLES_GESTION,
  },
};

/**
 * Para MECANICO_INTERNO además se exige ser el asignado a la OT (chequeo aparte en la Server Action,
 * porque acá no tenemos el id de usuario contra el que comparar).
 */
export function puedeTransicionar(estadoActual: EstadoOT, estadoNuevo: EstadoOT, rol: Rol): boolean {
  return TRANSICIONES[estadoActual]?.[estadoNuevo]?.includes(rol) ?? false;
}

export function transicionesDisponibles(estadoActual: EstadoOT, rol: Rol): EstadoOT[] {
  const posibles = TRANSICIONES[estadoActual] ?? {};
  return (Object.keys(posibles) as EstadoOT[]).filter((estadoNuevo) =>
    posibles[estadoNuevo]?.includes(rol)
  );
}
