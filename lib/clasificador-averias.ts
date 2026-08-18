import type { AreaReparacionOT } from "@/app/generated/prisma/client";

/**
 * Palabras y frases típicas que un chofer usa para describir cada tipo de
 * avería. Se buscan como substring sobre el texto normalizado (sin acentos,
 * en minúsculas), así que alcanza con la forma singular/raíz más común.
 */
const PALABRAS_CLAVE: Record<Exclude<AreaReparacionOT, "OTRO">, string[]> = {
  FRENOS: [
    "freno",
    "frena",
    "frenar",
    "frenado",
    "pastilla",
    "campana de freno",
    "disco de freno",
    "cinta de freno",
    "liquido de freno",
    "pedal de freno",
    "abs",
    "patina",
  ],
  SUSPENSION: [
    "elastico",
    "ballesta",
    "amortiguador",
    "suspension",
    "muelle",
    "resorte",
    "parrilla",
    "buje",
    "rotula",
    "rebota",
    "salta mucho",
  ],
  ESTRUCTURA: [
    "rasp",
    "rayon",
    "espejo",
    "paragolpes",
    "chapa",
    "abollad",
    "choque",
    "golpe",
    "vidrio",
    "parabrisas",
    "guardabarro",
    "chasis",
    "carroceria",
    "puerta no cierra",
    "oxidad",
  ],
  MOTOR: [
    "motor",
    "aceite",
    "humea",
    "humo",
    "sobrecalient",
    "temperatura",
    "correa",
    "turbo",
    "inyector",
    "bujia",
    "no arranca",
    "pierde potencia",
    "radiador",
    "refrigerante",
    "anticongelante",
    "recalent",
  ],
  ELECTRICO: [
    "bateria",
    "luz",
    "luces",
    "farol",
    "tablero",
    "fusible",
    "cableado",
    "no enciende",
    "alternador",
    "cortocircuito",
    "chispa",
  ],
  NEUMATICOS: [
    "cubierta",
    "neumatico",
    "rueda",
    "pinchaz",
    "pinchad",
    "desgaste de goma",
    "llanta",
    "presion de aire",
    "rin",
  ],
};

const CATEGORIAS_NORMALIZADAS = (
  Object.entries(PALABRAS_CLAVE) as [Exclude<AreaReparacionOT, "OTRO">, string[]][]
).map(([area, palabras]) => ({
  area,
  palabras: palabras.map(normalizar),
}));

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "");
}

/**
 * Interpreta la descripción libre de un chofer y sugiere el área de
 * reparación más probable en base a coincidencias de palabras clave.
 * Ante empate se queda con la primera categoría que llegó a ese puntaje.
 * Sin ninguna coincidencia devuelve OTRO.
 */
export function clasificarAreaReparacion(descripcion: string): AreaReparacionOT {
  const texto = normalizar(descripcion);

  let mejorArea: AreaReparacionOT = "OTRO";
  let mejorPuntaje = 0;

  for (const { area, palabras } of CATEGORIAS_NORMALIZADAS) {
    const puntaje = palabras.filter((palabra) => texto.includes(palabra)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorArea = area;
    }
  }

  return mejorArea;
}

/**
 * Qué palabras clave puntuales de un área matchearon en una descripción —
 * a diferencia de clasificarAreaReparacion (que solo dice el área ganadora),
 * esto permite distinguir dos problemas distintos que caen en la misma área
 * (ej. "puerta del térmico rota" vs. "paragolpes suelto", ambos ESTRUCTURA
 * pero sin ninguna palabra en común) — ver buscarOTAbiertaMismoProblema en
 * lib/ot.ts. OTRO no tiene palabras clave, así que siempre devuelve vacío.
 */
export function palabrasClaveCoincidentes(descripcion: string, area: AreaReparacionOT): string[] {
  if (area === "OTRO") return [];
  const texto = normalizar(descripcion);
  const entry = CATEGORIAS_NORMALIZADAS.find((c) => c.area === area);
  if (!entry) return [];
  return entry.palabras.filter((palabra) => texto.includes(palabra));
}

export const AREA_REPARACION_LABEL: Record<AreaReparacionOT, string> = {
  FRENOS: "Frenos",
  SUSPENSION: "Suspensión",
  ESTRUCTURA: "Estructura / carrocería",
  MOTOR: "Motor",
  ELECTRICO: "Eléctrico",
  NEUMATICOS: "Neumáticos",
  OTRO: "Otro",
};
