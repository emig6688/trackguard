export type TipoDocumentoCatalogo = {
  codigo: string;
  nombre: string;
  aplicaA: "VEHICULO" | "CHOFER" | "AMBOS";
};

/**
 * Tipos de documento con los que arranca toda empresa (vehículo y chofer).
 * Sin esto, el desplegable "Tipo de documento" queda vacío y no se puede
 * cargar ninguna documentación — no hay pantalla para crearlos a mano. Lo
 * usan prisma/seed.ts y crearEmpresa (app/_actions/plataforma.ts); la
 * migración 20261104120000_sembrar_tipos_documento repone los mismos
 * códigos en las empresas que se dieron de alta antes de este arreglo.
 */
export const TIPOS_DOCUMENTO_ESTANDAR: TipoDocumentoCatalogo[] = [
  { codigo: "VTV", nombre: "VTV / RTO", aplicaA: "VEHICULO" },
  { codigo: "SEGURO", nombre: "Seguro", aplicaA: "VEHICULO" },
  { codigo: "HABILITACION_BROMATOLOGICA", nombre: "Habilitación bromatológica", aplicaA: "VEHICULO" },
  { codigo: "SENASA_VEHICULO", nombre: "Habilitación SENASA (vehículo)", aplicaA: "VEHICULO" },
  { codigo: "LICENCIA_TRANSITO", nombre: "Licencia de tránsito", aplicaA: "VEHICULO" },
  { codigo: "LICENCIA_CONDUCIR", nombre: "Licencia de conducir", aplicaA: "CHOFER" },
  { codigo: "LIBRETA_SANITARIA", nombre: "Libreta sanitaria", aplicaA: "CHOFER" },
  { codigo: "SENASA_CHOFER", nombre: "Habilitación SENASA (chofer)", aplicaA: "CHOFER" },
];
