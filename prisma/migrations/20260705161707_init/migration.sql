-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'ENCARGADO_MANTENIMIENTO', 'MECANICO_INTERNO', 'CHOFER', 'GERENTE', 'CONTADOR');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMION', 'ACOPLADO', 'UTILITARIO', 'OTRO');

-- CreateEnum
CREATE TYPE "EntidadDocumento" AS ENUM ('VEHICULO', 'CHOFER');

-- CreateEnum
CREATE TYPE "AplicaADocumento" AS ENUM ('VEHICULO', 'CHOFER', 'AMBOS');

-- CreateEnum
CREATE TYPE "TipoIntervaloPlan" AS ENUM ('KM', 'TIEMPO', 'AMBOS');

-- CreateEnum
CREATE TYPE "OrigenOT" AS ENUM ('PREVENTIVO', 'CHECKLIST', 'EVENTO_RUTA', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoOT" AS ENUM ('PENDIENTE_APROBACION', 'APROBADA', 'EN_PROGRESO', 'DERIVADA_EXTERNO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PrioridadOT" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoDerivacionExterna" AS ENUM ('ENVIADO', 'PRESUPUESTADO', 'EN_REPARACION', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "ResultadoChecklistItem" AS ENUM ('OK', 'FALLA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "ResultadoChecklistGeneral" AS ENUM ('OK', 'CON_FALLAS');

-- CreateEnum
CREATE TYPE "CategoriaChecklistItem" AS ENUM ('LUCES', 'FRENOS', 'NEUMATICOS', 'FLUIDOS', 'DOCUMENTACION', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoEventoRuta" AS ENUM ('DESPERFECTO', 'INCIDENTE', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('PEAJE', 'VIATICO', 'REPARACION_MENOR', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('PENDIENTE_REVISION', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilChofer" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "numeroLicencia" TEXT,
    "categoriaLicencia" TEXT,
    "legajo" TEXT,
    "fechaIngreso" TIMESTAMP(3),

    CONSTRAINT "PerfilChofer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER,
    "tipo" "TipoVehiculo" NOT NULL DEFAULT 'CAMION',
    "numeroInterno" TEXT,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaAltaFlota" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumentoConfig" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplicaA" "AplicaADocumento" NOT NULL,
    "diasAlertaDefault" INTEGER[] DEFAULT ARRAY[30, 15, 7]::INTEGER[],
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoDocumentoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "entidadTipo" "EntidadDocumento" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "tipoDocumentoId" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "archivoId" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMantenimiento" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoIntervalo" "TipoIntervaloPlan" NOT NULL,
    "intervaloKm" INTEGER,
    "intervaloDias" INTEGER,
    "kmUltimoService" INTEGER,
    "fechaUltimoService" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallerExterno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contactoNombre" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TallerExterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenDeTrabajo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "origen" "OrigenOT" NOT NULL,
    "estado" "EstadoOT" NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "prioridad" "PrioridadOT" NOT NULL DEFAULT 'MEDIA',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaLimite" TIMESTAMP(3),
    "ordenSecuencia" INTEGER,
    "creadoPorId" TEXT,
    "aprobadoPorId" TEXT,
    "asignadoAId" TEXT,
    "planMantenimientoId" TEXT,
    "checklistRealizadoId" TEXT,
    "eventoRutaId" TEXT,
    "tiempoInsumidoMinutos" INTEGER,
    "observacionesMecanico" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenDeTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTHistorialEstado" (
    "id" TEXT NOT NULL,
    "ordenDeTrabajoId" TEXT NOT NULL,
    "actorId" TEXT,
    "estadoAnterior" "EstadoOT",
    "estadoNuevo" "EstadoOT" NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTHistorialEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTRepuesto" (
    "id" TEXT NOT NULL,
    "ordenDeTrabajoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "costoUnitario" DECIMAL(12,2),

    CONSTRAINT "OTRepuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTDerivacionExterna" (
    "id" TEXT NOT NULL,
    "ordenDeTrabajoId" TEXT NOT NULL,
    "tallerExternoId" TEXT NOT NULL,
    "estadoExterno" "EstadoDerivacionExterna" NOT NULL DEFAULT 'ENVIADO',
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presupuestoMonto" DECIMAL(12,2),
    "fechaEstimadaEntrega" TIMESTAMP(3),
    "resultado" TEXT,
    "adjuntoPresupuestoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTDerivacionExterna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplicaA" "TipoVehiculo",
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "categoria" "CategoriaChecklistItem" NOT NULL DEFAULT 'OTRO',
    "requiereObservacionSiFalla" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRealizado" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "kmAlMomento" INTEGER,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultadoGeneral" "ResultadoChecklistGeneral" NOT NULL DEFAULT 'OK',
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,

    CONSTRAINT "ChecklistRealizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRespuesta" (
    "id" TEXT NOT NULL,
    "checklistRealizadoId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "resultado" "ResultadoChecklistItem" NOT NULL,
    "observacion" TEXT,
    "archivoId" TEXT,

    CONSTRAINT "ChecklistRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoRuta" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "tipo" "TipoEventoRuta" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kmAlMomento" INTEGER,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "archivoId" TEXT,

    CONSTRAINT "EventoRuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaCombustible" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kmOdometro" INTEGER NOT NULL,
    "litrosCargados" DECIMAL(10,2) NOT NULL,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "precioLitro" DECIMAL(10,2),
    "estacionServicio" TEXT,
    "archivoTicketId" TEXT NOT NULL,
    "kmRecorridosDesdeUltimaCarga" INTEGER,
    "consumoL100km" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "vehiculoId" TEXT,
    "tipo" "TipoGasto" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "archivoComprobanteId" TEXT,
    "estado" "EstadoGasto" NOT NULL DEFAULT 'PENDIENTE_REVISION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archivo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nombreOriginal" TEXT,
    "mimeType" TEXT,
    "tamanioBytes" INTEGER,
    "subidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArchivoToOrdenDeTrabajo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArchivoToOrdenDeTrabajo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilChofer_usuarioId_key" ON "PerfilChofer"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");

-- CreateIndex
CREATE INDEX "Vehiculo_activo_idx" ON "Vehiculo"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumentoConfig_codigo_key" ON "TipoDocumentoConfig"("codigo");

-- CreateIndex
CREATE INDEX "Documento_entidadTipo_entidadId_tipoDocumentoId_idx" ON "Documento"("entidadTipo", "entidadId", "tipoDocumentoId");

-- CreateIndex
CREATE INDEX "Documento_fechaVencimiento_idx" ON "Documento"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "PlanMantenimiento_vehiculoId_activo_idx" ON "PlanMantenimiento"("vehiculoId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenDeTrabajo_numero_key" ON "OrdenDeTrabajo"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenDeTrabajo_eventoRutaId_key" ON "OrdenDeTrabajo"("eventoRutaId");

-- CreateIndex
CREATE INDEX "OrdenDeTrabajo_estado_idx" ON "OrdenDeTrabajo"("estado");

-- CreateIndex
CREATE INDEX "OrdenDeTrabajo_vehiculoId_idx" ON "OrdenDeTrabajo"("vehiculoId");

-- CreateIndex
CREATE INDEX "OrdenDeTrabajo_asignadoAId_idx" ON "OrdenDeTrabajo"("asignadoAId");

-- CreateIndex
CREATE INDEX "OTHistorialEstado_ordenDeTrabajoId_idx" ON "OTHistorialEstado"("ordenDeTrabajoId");

-- CreateIndex
CREATE UNIQUE INDEX "OTDerivacionExterna_ordenDeTrabajoId_key" ON "OTDerivacionExterna"("ordenDeTrabajoId");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_idx" ON "ChecklistItem"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistRealizado_vehiculoId_idx" ON "ChecklistRealizado"("vehiculoId");

-- CreateIndex
CREATE INDEX "ChecklistRealizado_choferId_idx" ON "ChecklistRealizado"("choferId");

-- CreateIndex
CREATE INDEX "ChecklistRespuesta_checklistRealizadoId_idx" ON "ChecklistRespuesta"("checklistRealizadoId");

-- CreateIndex
CREATE INDEX "EventoRuta_vehiculoId_idx" ON "EventoRuta"("vehiculoId");

-- CreateIndex
CREATE INDEX "EventoRuta_choferId_idx" ON "EventoRuta"("choferId");

-- CreateIndex
CREATE INDEX "CargaCombustible_vehiculoId_fechaHora_idx" ON "CargaCombustible"("vehiculoId", "fechaHora");

-- CreateIndex
CREATE INDEX "Gasto_choferId_idx" ON "Gasto"("choferId");

-- CreateIndex
CREATE INDEX "Gasto_estado_idx" ON "Gasto"("estado");

-- CreateIndex
CREATE INDEX "_ArchivoToOrdenDeTrabajo_B_index" ON "_ArchivoToOrdenDeTrabajo"("B");

-- AddForeignKey
ALTER TABLE "PerfilChofer" ADD CONSTRAINT "PerfilChofer_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumentoConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMantenimiento" ADD CONSTRAINT "PlanMantenimiento_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_planMantenimientoId_fkey" FOREIGN KEY ("planMantenimientoId") REFERENCES "PlanMantenimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_checklistRealizadoId_fkey" FOREIGN KEY ("checklistRealizadoId") REFERENCES "ChecklistRealizado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenDeTrabajo" ADD CONSTRAINT "OrdenDeTrabajo_eventoRutaId_fkey" FOREIGN KEY ("eventoRutaId") REFERENCES "EventoRuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTHistorialEstado" ADD CONSTRAINT "OTHistorialEstado_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTHistorialEstado" ADD CONSTRAINT "OTHistorialEstado_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTRepuesto" ADD CONSTRAINT "OTRepuesto_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTDerivacionExterna" ADD CONSTRAINT "OTDerivacionExterna_ordenDeTrabajoId_fkey" FOREIGN KEY ("ordenDeTrabajoId") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTDerivacionExterna" ADD CONSTRAINT "OTDerivacionExterna_tallerExternoId_fkey" FOREIGN KEY ("tallerExternoId") REFERENCES "TallerExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTDerivacionExterna" ADD CONSTRAINT "OTDerivacionExterna_adjuntoPresupuestoId_fkey" FOREIGN KEY ("adjuntoPresupuestoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRealizado" ADD CONSTRAINT "ChecklistRealizado_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRealizado" ADD CONSTRAINT "ChecklistRealizado_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRealizado" ADD CONSTRAINT "ChecklistRealizado_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRespuesta" ADD CONSTRAINT "ChecklistRespuesta_checklistRealizadoId_fkey" FOREIGN KEY ("checklistRealizadoId") REFERENCES "ChecklistRealizado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRespuesta" ADD CONSTRAINT "ChecklistRespuesta_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRespuesta" ADD CONSTRAINT "ChecklistRespuesta_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRuta" ADD CONSTRAINT "EventoRuta_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRuta" ADD CONSTRAINT "EventoRuta_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRuta" ADD CONSTRAINT "EventoRuta_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_archivoTicketId_fkey" FOREIGN KEY ("archivoTicketId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_archivoComprobanteId_fkey" FOREIGN KEY ("archivoComprobanteId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArchivoToOrdenDeTrabajo" ADD CONSTRAINT "_ArchivoToOrdenDeTrabajo_A_fkey" FOREIGN KEY ("A") REFERENCES "Archivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArchivoToOrdenDeTrabajo" ADD CONSTRAINT "_ArchivoToOrdenDeTrabajo_B_fkey" FOREIGN KEY ("B") REFERENCES "OrdenDeTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
