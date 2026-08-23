import "server-only";
import { prisma } from "@/lib/prisma";
import { MODELOS_BACKUP } from "@/lib/backup-modelos";

export type BackupJSON = {
  generadoEn: string;
  version: 1;
  modelos: Record<string, unknown[]>;
  conteos: Record<string, number>;
};

/**
 * Dump completo de todas las tablas de negocio a un solo objeto JSON.
 * Decimal y Date de Prisma ya serializan solos a string/ISO via su propio
 * toJSON() (decimal.js y Date lo definen) — no hace falta convertir nada acá.
 *
 * Es un volcado plano (no un pg_dump real): sirve para poder reconstruir los
 * datos ante un desastre mientras el plan free de Supabase no da backups
 * reales, no reemplaza una migración de plan cuando sea posible pagarla.
 */
export async function generarBackupCompleto(): Promise<BackupJSON> {
  const modelos: Record<string, unknown[]> = {};
  const conteos: Record<string, number> = {};

  for (const modelo of MODELOS_BACKUP) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[modelo];
    const filas = await delegate.findMany();
    modelos[modelo] = filas;
    conteos[modelo] = filas.length;
  }

  return { generadoEn: new Date().toISOString(), version: 1, modelos, conteos };
}
