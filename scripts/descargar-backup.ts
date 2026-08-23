// Descarga el backup más reciente (o uno puntual por fecha) subido por
// app/api/cron/backup-diario/route.ts, para poder inspeccionarlo o pasarlo
// a scripts/restaurar-backup.ts. Necesita BLOB_READ_WRITE_TOKEN en el
// entorno (el mismo que usa la app en producción — pedíselo a quien tenga
// acceso al proyecto de Vercel si corrés esto en otra máquina).
//
// Uso:
//   npx tsx scripts/descargar-backup.ts                 # el más reciente
//   npx tsx scripts/descargar-backup.ts 2026-08-20       # una fecha puntual
import "dotenv/config";
import fs from "fs";
import path from "path";
import { list } from "@vercel/blob";

async function main() {
  const fechaPedida = process.argv[2];
  const { blobs } = await list({ prefix: "backups/" });
  if (blobs.length === 0) {
    console.error("No hay backups subidos todavía.");
    process.exit(1);
  }

  const elegido = fechaPedida
    ? blobs.find((b) => b.pathname.includes(fechaPedida))
    : blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];

  if (!elegido) {
    console.error(`No se encontró un backup para "${fechaPedida}". Disponibles:`);
    blobs.forEach((b) => console.error(` - ${b.pathname}`));
    process.exit(1);
  }

  const respuesta = await fetch(elegido.url);
  if (!respuesta.ok) throw new Error(`No se pudo descargar ${elegido.pathname}: ${respuesta.status}`);
  const buffer = Buffer.from(await respuesta.arrayBuffer());

  const destino = path.join(process.cwd(), path.basename(elegido.pathname));
  fs.writeFileSync(destino, buffer);
  console.log(`Descargado: ${destino} (${buffer.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
