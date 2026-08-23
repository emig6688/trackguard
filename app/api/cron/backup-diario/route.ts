import { NextResponse } from "next/server";
import { gzipSync } from "zlib";
import { put, list, del } from "@vercel/blob";
import { generarBackupCompleto } from "@/lib/backup";

const PREFIJO = "backups/";
const RETENCION_DIAS = 14;

/**
 * Corre una vez al día (ver vercel.json). Mientras el proyecto de Supabase
 * esté en el plan free (sin PITR ni backups diarios reales, ver
 * DEPLOY.md#backups), este es el único resguardo real de los datos: un
 * volcado completo de todas las tablas a un JSON comprimido, subido como
 * blob privado. Para restaurar, ver scripts/restaurar-backup.ts.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const backup = await generarBackupCompleto();
  const json = JSON.stringify(backup);
  const comprimido = gzipSync(Buffer.from(json, "utf-8"));

  const fecha = backup.generadoEn.slice(0, 10); // YYYY-MM-DD
  const pathname = `${PREFIJO}${fecha}.json.gz`;
  const subido = await put(pathname, comprimido, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/gzip",
  });

  const { blobs } = await list({ prefix: PREFIJO });
  const limite = new Date();
  limite.setDate(limite.getDate() - RETENCION_DIAS);
  const vencidos = blobs.filter((b) => b.uploadedAt < limite);
  if (vencidos.length > 0) {
    await del(vencidos.map((b) => b.url));
  }

  return NextResponse.json({
    ok: true,
    pathname: subido.pathname,
    tamanioBytes: comprimido.length,
    conteos: backup.conteos,
    backupsBorrados: vencidos.map((b) => b.pathname),
  });
}
