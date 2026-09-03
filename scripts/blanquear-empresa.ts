// Blanquea el historial OPERATIVO de una empresa puntual (para "reiniciar"
// su uso sin arrastrar datos viejos), preservando lo que se cargó en
// Mantenedor y Parámetros: vehículos (patente/marca/etc., pero con
// kmActual/horasEquipoFrio/disponibilidad reseteados), choferes/usuarios,
// talleres externos, catálogo de pañol (stock a 0), plan preventivo
// estándar, planes de mantenimiento por vehículo (intervalos Y último
// service, sin tocar), documentos con vencimientos, plantillas de
// checklist y reglas de notificación.
//
// Por diseño, sin --confirmo SOLO hace un conteo (dry-run) — no borra nada.
// Uso:
//   npx tsx scripts/blanquear-empresa.ts "LA SUPERIOR"              (dry-run)
//   npx tsx scripts/blanquear-empresa.ts "LA SUPERIOR" --confirmo   (borra de verdad)
//
// Corre contra la base de DATABASE_URL en ese momento — revisar el .env
// antes de agregar --confirmo, como en scripts/restaurar-backup.ts.
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Modelos cuyo historial se borra por completo para esta empresa, con el
// `where` que corresponde a cada uno — la mayoría tiene empresaId directo,
// pero varios son hijos de un hijo (OTHistorialEstado, OrdenCompraItem,
// ChecklistRespuesta, etc.) y solo se puede filtrar vía relación. El orden
// de borrado no importa: la transacción desactiva la verificación de FKs
// (mismo truco que restaurar-backup.ts, necesario además por la referencia
// circular real OrdenCompra.presupuestoAprobadoId <-> PresupuestoCompra).
function construirModelos(empresaId: string) {
  return [
    { modelo: "oTHistorialEstado", where: { ordenDeTrabajo: { empresaId } } },
    { modelo: "oTItemPreventivo", where: { empresaId } },
    { modelo: "oTRepuesto", where: { empresaId } },
    { modelo: "factura", where: { empresaId } },
    { modelo: "oTDerivacionExterna", where: { ordenDeTrabajo: { empresaId } } },
    { modelo: "ordenDeTrabajo", where: { empresaId } },
    { modelo: "ordenCompraItem", where: { ordenCompra: { empresaId } } },
    { modelo: "presupuestoCompra", where: { ordenCompra: { empresaId } } },
    { modelo: "ordenCompra", where: { empresaId } },
    { modelo: "checklistRespuesta", where: { checklistRealizado: { vehiculo: { empresaId } } } },
    { modelo: "checklistRealizado", where: { vehiculo: { empresaId } } },
    { modelo: "eventoRuta", where: { empresaId } },
    { modelo: "cargaCombustible", where: { empresaId } },
    { modelo: "gasto", where: { empresaId } },
    { modelo: "observacionGuardia", where: { empresaId } },
    { modelo: "diaNoOperado", where: { empresaId } },
    { modelo: "productoDevuelto", where: { devolucion: { empresaId } } },
    { modelo: "cambioDevolucion", where: { devolucion: { empresaId } } },
    { modelo: "devolucion", where: { empresaId } },
    { modelo: "disponibilidadSnapshot", where: { empresaId } },
    { modelo: "notificacionFallo", where: { empresaId } },
    { modelo: "notificacion", where: { empresaId } },
  ] as const;
}

async function main() {
  const nombreEmpresa = process.argv[2];
  const confirmado = process.argv.includes("--confirmo");

  if (!nombreEmpresa) {
    console.error('Uso: npx tsx scripts/blanquear-empresa.ts "Nombre de la empresa" [--confirmo]');
    process.exit(1);
  }

  const destino = (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;

  try {
    const empresa = await prisma.empresa.findFirst({ where: { nombre: { contains: nombreEmpresa, mode: "insensitive" } } });
    if (!empresa) {
      console.error(`No se encontró ninguna empresa cuyo nombre contenga "${nombreEmpresa}" en ${destino}.`);
      process.exit(1);
    }

    console.log(`Base: ${destino}`);
    console.log(`Empresa encontrada: "${empresa.nombre}" (id: ${empresa.id})`);
    console.log(confirmado ? "\nModo: BORRADO REAL (--confirmo)\n" : "\nModo: DRY-RUN (solo conteo, no se borra nada)\n");

    const modelos = construirModelos(empresa.id);
    let totalFilas = 0;
    for (const { modelo, where } of modelos) {
      const cantidad = await prismaAny[modelo].count({ where });
      totalFilas += cantidad;
      console.log(`  ${modelo.padEnd(20)} ${cantidad}`);
    }

    const whereEmpresa = { empresaId: empresa.id };
    const vehiculos = await prisma.vehiculo.count({ where: whereEmpresa });
    const articulos = await prisma.articuloPanol.count({ where: whereEmpresa });
    const whereArchivoHuerfano = { empresaId: empresa.id, documentos: { none: {} } };
    const archivosHuerfanosPotenciales = await prisma.archivo.count({ where: whereArchivoHuerfano });

    console.log(`\nVehículos a resetear (kmActual/horasEquipoFrio/disponibilidad): ${vehiculos}`);
    console.log(`Artículos de pañol a resetear (stockActual → 0): ${articulos}`);
    console.log(`Archivos que quedarían huérfanos (no referenciados por ningún Documento): ${archivosHuerfanosPotenciales}`);
    console.log(`\nTotal de filas de historial operativo a borrar: ${totalFilas}`);
    console.log("\nSE CONSERVA sin tocar: Documento, PlanMantenimiento, PlanMantenimientoEstandarItem,");
    console.log("TallerExterno, ChecklistTemplate/ChecklistItem, ReglaNotificacion, TipoDocumentoConfig,");
    console.log("Usuario/PerfilChofer, PushSubscription.");

    if (!confirmado) {
      console.log("\nEsto fue un dry-run. Para borrar de verdad, volvé a correr agregando --confirmo al final.");
      return;
    }

    console.log("\nBorrando...");
    await prisma.$executeRawUnsafe("SET session_replication_role = replica");
    try {
      await prisma.$transaction(
        async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txAny = tx as any;
          for (const { modelo, where } of modelos) {
            const resultado = await txAny[modelo].deleteMany({ where });
            console.log(`  ${modelo.padEnd(20)} ${resultado.count} filas borradas`);
          }

          const archivosBorrados = await tx.archivo.deleteMany({ where: whereArchivoHuerfano });
          console.log(`  archivo (huérfanos)   ${archivosBorrados.count} filas borradas`);

          const vehiculosReseteados = await tx.vehiculo.updateMany({
            where: whereEmpresa,
            data: {
              kmActual: 0,
              horasEquipoFrio: null,
              disponible: true,
              motivoNoOperativo: null,
              disponibleActualizadoEn: null,
              disponibleActualizadoPorId: null,
            },
          });
          console.log(`  vehiculo (reset)      ${vehiculosReseteados.count} filas actualizadas`);

          const articulosReseteados = await tx.articuloPanol.updateMany({
            where: whereEmpresa,
            data: { stockActual: 0 },
          });
          console.log(`  articuloPanol (reset) ${articulosReseteados.count} filas actualizadas`);
        },
        { timeout: 60_000 }
      );
    } finally {
      await prisma.$executeRawUnsafe("SET session_replication_role = DEFAULT");
    }

    console.log(`\nListo. "${empresa.nombre}" quedó reiniciada, con lo cargado en Mantenedor/Parámetros intacto.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
