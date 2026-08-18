import type { TipoIntervaloPlan } from "@/app/generated/prisma/client";

export type ItemCatalogoMantenimiento = {
  categoria: string;
  nombre: string;
  tipoIntervalo: TipoIntervaloPlan;
  intervaloKm?: number;
  intervaloDias?: number;
  intervaloHoras?: number;
};

/**
 * Catálogo estándar de mantenimiento preventivo para camiones con equipo de frío.
 * Combina dos fuentes: la planilla de checklist del taller (inspecciones periódicas
 * por calendario, sin valores de km) y el análisis de la industria (Fleetio, Whip
 * Around, Thermo King/Carrier) que sí define km/horas concretos para cada recambio.
 * Semanal/Quincenal/Mensual de la planilla se mapean a 7/15/30 días.
 */
export const CATALOGO_MANTENIMIENTO_ESTANDAR: ItemCatalogoMantenimiento[] = [
  // --- Inspecciones periódicas (planilla del taller, por calendario) ---
  { categoria: "Estructura vehículo", nombre: "Calibración de ruedas", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Estructura vehículo", nombre: "Rotar los neumáticos", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Estructura vehículo", nombre: "Revisar presión de neumáticos", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Estructura vehículo", nombre: "Revisión general estado de térmico", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Estructura vehículo", nombre: "Revisión general estado de paragolpes", tipoIntervalo: "TIEMPO", intervaloDias: 7 },

  { categoria: "Sistema de combustible", nombre: "Inspección visual de bomba de inyección", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de combustible", nombre: "Revisión de filtro de combustible y limpieza de tanque", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de combustible", nombre: "Revisar posibles fugas de combustible", tipoIntervalo: "TIEMPO", intervaloDias: 7 },

  { categoria: "Frenos, suspensión y dirección", nombre: "Revisión y engrase del sistema de dirección general", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Revisar nivel de hidrolina de la dirección hidráulica", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Limpieza y regulación de zapatas y tambores (D y P)", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Limpieza y regulación de pastillas de freno", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Verificar y regular el juego libre del freno de mano", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Verificar y probar el freno de motor", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Revisión del sistema de tubería de aire", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Inspección de muelles y amortiguadores", tipoIntervalo: "TIEMPO", intervaloDias: 30 },

  { categoria: "Sistema de motor", nombre: "Revisión de aceite de motor", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Revisión de filtro de aceite de motor", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Revisión de filtro de aire", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Revisión de refrigerante del radiador", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Revisar posibles fugas de aceite, agua y gasolina", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Revisar soportes del motor", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Verificar estado de las mangueras", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema de motor", nombre: "Ajustar tensión de las correas", tipoIntervalo: "TIEMPO", intervaloDias: 7 },

  { categoria: "Sistema de transmisión", nombre: "Revisar cruzetas delanteras y posterior", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Sistema de transmisión", nombre: "Revisión general del sistema de embrague", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Sistema de transmisión", nombre: "Revisar niveles de aceite de caja/corona/diferencial", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Sistema de transmisión", nombre: "Revisar nivel del líquido de embrague", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Sistema de transmisión", nombre: "Revisar soportes de la caja de velocidad", tipoIntervalo: "TIEMPO", intervaloDias: 15 },
  { categoria: "Sistema de transmisión", nombre: "Revisar los templadores de la corona", tipoIntervalo: "TIEMPO", intervaloDias: 15 },

  { categoria: "Múltiple de escape", nombre: "Verificar posibles fugas del silenciador o del escape", tipoIntervalo: "TIEMPO", intervaloDias: 7 },

  { categoria: "Sistema eléctrico", nombre: "Revisión de accesorios y sistema de luces", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Mantenimiento de la batería", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Revisión del sistema de arranque", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Revisión del sistema de carga del alternador", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Revisar los cables eléctricos", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Revisar el líquido de depósito del trico", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Revisar manómetros del tablero", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Sistema eléctrico", nombre: "Prueba de carga de batería", tipoIntervalo: "TIEMPO", intervaloDias: 180 },

  { categoria: "Equipo de frío", nombre: "Revisión visual de pérdidas del equipo de frío", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Equipo de frío", nombre: "Revisión de radiadores del equipo de frío", tipoIntervalo: "TIEMPO", intervaloDias: 7 },
  { categoria: "Equipo de frío", nombre: "Controlar presión y nivel de líquido refrigerante", tipoIntervalo: "TIEMPO", intervaloDias: 7 },

  { categoria: "Carrocería y aislación térmica", nombre: "Inspección de burletes de puertas y estanqueidad térmica", tipoIntervalo: "TIEMPO", intervaloDias: 30 },
  { categoria: "Carrocería y aislación térmica", nombre: "Inspección de piso y paredes aislantes", tipoIntervalo: "TIEMPO", intervaloDias: 30 },
  { categoria: "Carrocería y aislación térmica", nombre: "Calibración de sondas de temperatura propias", tipoIntervalo: "TIEMPO", intervaloDias: 90 },

  // --- Recambios y servicios mayores (análisis de industria, por km/horas) ---
  { categoria: "Sistema de motor", nombre: "Cambio de aceite y filtro de aceite del motor", tipoIntervalo: "KM", intervaloKm: 15000 },
  { categoria: "Sistema de motor", nombre: "Cambio de filtro de combustible", tipoIntervalo: "KM", intervaloKm: 15000 },
  { categoria: "Sistema de motor", nombre: "Cambio de filtro de aire del motor", tipoIntervalo: "KM", intervaloKm: 30000 },
  { categoria: "Sistema de motor", nombre: "Cambio preventivo de correas y mangueras del motor", tipoIntervalo: "KM", intervaloKm: 100000 },
  { categoria: "Sistema de motor", nombre: "Cambio de refrigerante del motor", tipoIntervalo: "AMBOS", intervaloKm: 200000, intervaloDias: 730 },

  { categoria: "Sistema de transmisión", nombre: "Cambio de aceite de caja de cambios", tipoIntervalo: "KM", intervaloKm: 90000 },
  { categoria: "Sistema de transmisión", nombre: "Cambio de aceite de diferencial", tipoIntervalo: "KM", intervaloKm: 90000 },
  { categoria: "Sistema de transmisión", nombre: "Lubricación de crucetas y cardán", tipoIntervalo: "KM", intervaloKm: 22500 },
  { categoria: "Sistema de transmisión", nombre: "Inspección y lubricación de rodamientos de rueda", tipoIntervalo: "AMBOS", intervaloKm: 40000, intervaloDias: 365 },

  { categoria: "Frenos, suspensión y dirección", nombre: "Inspección a fondo de pastillas/campanas y sistema neumático", tipoIntervalo: "KM", intervaloKm: 20000 },
  { categoria: "Frenos, suspensión y dirección", nombre: "Cambio de cartucho desecante del secador de aire", tipoIntervalo: "AMBOS", intervaloKm: 100000, intervaloDias: 365 },

  { categoria: "Neumáticos y suspensión", nombre: "Alineación", tipoIntervalo: "KM", intervaloKm: 40000 },
  { categoria: "Neumáticos y suspensión", nombre: "Inspección de suspensión (bujes y amortiguadores)", tipoIntervalo: "KM", intervaloKm: 20000 },

  { categoria: "Equipo de frío", nombre: "Servicio A del equipo de frío (aceite motor auxiliar, filtro de aceite y de combustible)", tipoIntervalo: "HORAS", intervaloHoras: 500 },
  { categoria: "Equipo de frío", nombre: "Servicio B del equipo de frío (Servicio A + filtro de aire, correas y mangueras)", tipoIntervalo: "HORAS", intervaloHoras: 3000 },
  { categoria: "Equipo de frío", nombre: "Servicio C / anual del equipo de frío (compresor, condensador, evaporador)", tipoIntervalo: "HORAS", intervaloHoras: 6000 },
  { categoria: "Equipo de frío", nombre: "Revisión de carga de gas refrigerante", tipoIntervalo: "HORAS", intervaloHoras: 3000 },
  { categoria: "Equipo de frío", nombre: "Cambio de refrigerante del motor auxiliar del equipo de frío", tipoIntervalo: "HORAS", intervaloHoras: 12000 },
];
