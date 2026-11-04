-- Repone los tipos de documento estándar en las empresas dadas de alta desde
-- /plataforma antes de este arreglo: crearEmpresa no los sembraba (solo
-- prisma/seed.ts), así que el desplegable "Tipo de documento" quedaba vacío y
-- no se podía cargar documentación de vehículos ni choferes. Solo agrega los
-- códigos que faltan (no pisa ni duplica nada) — mismo catálogo que
-- lib/catalogo-tipos-documento.ts.
INSERT INTO "TipoDocumentoConfig" ("id", "empresaId", "codigo", "nombre", "aplicaA")
SELECT
  'tdc_' || md5(e."id" || t."codigo"),
  e."id",
  t."codigo",
  t."nombre",
  t."aplicaA"::"AplicaADocumento"
FROM "Empresa" e
CROSS JOIN (
  VALUES
    ('VTV', 'VTV / RTO', 'VEHICULO'),
    ('SEGURO', 'Seguro', 'VEHICULO'),
    ('HABILITACION_BROMATOLOGICA', 'Habilitación bromatológica', 'VEHICULO'),
    ('SENASA_VEHICULO', 'Habilitación SENASA (vehículo)', 'VEHICULO'),
    ('LICENCIA_TRANSITO', 'Licencia de tránsito', 'VEHICULO'),
    ('LICENCIA_CONDUCIR', 'Licencia de conducir', 'CHOFER'),
    ('LIBRETA_SANITARIA', 'Libreta sanitaria', 'CHOFER'),
    ('SENASA_CHOFER', 'Habilitación SENASA (chofer)', 'CHOFER')
) AS t("codigo", "nombre", "aplicaA")
WHERE NOT EXISTS (
  SELECT 1 FROM "TipoDocumentoConfig" x
  WHERE x."empresaId" = e."id" AND x."codigo" = t."codigo"
);
