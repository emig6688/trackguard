// Herramienta de emergencia para restaurar un backup generado por
// app/api/cron/backup-diario/route.ts. Se corre a mano, apuntando
// DATABASE_URL (en .env, o exportada antes del comando) a la base que se
// quiere restaurar — nunca se dispara sola.
//
// Uso:
//   npx tsx scripts/restaurar-backup.ts ruta/al/backup-2026-08-23.json.gz --confirmo
//
// Requiere --confirmo a propósito: no hay forma de "probar en seco" sin
// insertar de verdad, así que el flag obliga a confirmar que DATABASE_URL
// apunta a donde se quiere de verdad antes de tocar nada.
import "dotenv/config";
import fs from "fs";
import zlib from "zlib";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MODELOS_BACKUP } from "../lib/backup-modelos";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function revivirFechas(valor: unknown): unknown {
  if (typeof valor === "string" && ISO_DATE_RE.test(valor)) return new Date(valor);
  if (Array.isArray(valor)) return valor.map(revivirFechas);
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, val] of Object.entries(valor)) salida[clave] = revivirFechas(val);
    return salida;
  }
  return valor;
}

async function main() {
  const archivo = process.argv[2];
  const confirmado = process.argv.includes("--confirmo");

  if (!archivo) {
    console.error("Uso: npx tsx scripts/restaurar-backup.ts <archivo.json.gz> --confirmo");
    process.exit(1);
  }
  if (!confirmado) {
    const destino = (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@");
    console.error(
      `Esto inserta datos en la base de DATABASE_URL (${destino || "no configurada"}).\n` +
        "Revisá tu .env y, si es la base correcta, volvé a correr agregando --confirmo al final."
    );
    process.exit(1);
  }

  const buffer = fs.readFileSync(archivo);
  const json = archivo.endsWith(".gz") ? zlib.gunzipSync(buffer).toString("utf-8") : buffer.toString("utf-8");
  const backup = JSON.parse(json) as { generadoEn: string; modelos: Record<string, unknown[]> };

  const destino = (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@");
  console.log(`Backup generado el ${backup.generadoEn}.`);
  console.log(`Restaurando en: ${destino}`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // Se desactiva la verificación de foreign keys mientras se inserta: el
  // orden de MODELOS_BACKUP es mayormente padres-antes-que-hijos, pero hay
  // una referencia circular real en el schema (OrdenCompra.presupuestoAprobadoId
  // <-> PresupuestoCompra.ordenCompraId) que ningún orden lineal resuelve
  // solo. session_replication_role=replica es la misma técnica que usa
  // pg_restore para este mismo problema.
  await prisma.$executeRawUnsafe("SET session_replication_role = replica");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;
    for (const modelo of MODELOS_BACKUP) {
      const filasCrudas = backup.modelos[modelo] ?? [];
      if (filasCrudas.length === 0) continue;
      const filas = filasCrudas.map(revivirFechas);
      const resultado = await prismaAny[modelo].createMany({ data: filas, skipDuplicates: true });
      console.log(`${modelo}: ${resultado.count}/${filas.length} filas insertadas`);
    }
  } finally {
    await prisma.$executeRawUnsafe("SET session_replication_role = DEFAULT");
    await prisma.$disconnect();
  }

  console.log("Restauración terminada.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
