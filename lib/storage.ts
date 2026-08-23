import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { put, get } from "@vercel/blob";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

/**
 * Con BLOB_READ_WRITE_TOKEN configurado, los archivos van a Vercel Blob
 * (acceso 'private': solo se leen desde el server con el token, nunca por
 * URL directa). Sin el token (dev local sin store creado todavía), cae a
 * disco local. En ambos casos el cliente solo ve `/api/archivos/[id]`
 * (ver route.ts, que exige sesión) — el `Archivo.url` guardado en la base
 * nunca es la URL real de Blob, así que el mecanismo de guardado se puede
 * cambiar acá sin tocar el resto del código.
 */
const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
const usaBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const rutaBlob = (archivoId: string) => `archivos/${archivoId}`;

// Todos los formularios de la app suben fotos (evidencia de checklist,
// facturas, tickets de combustible/gastos) o, en el caso de presupuestos de
// compra, opcionalmente un PDF — nunca ningún otro tipo. Se valida acá,
// en el único punto de entrada de subida, para no depender de que cada
// formulario respete su propio `accept` (que es solo una sugerencia del
// navegador, no una garantía).
const MIME_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/pdf",
]);
const TAMANIO_MAXIMO_BYTES = 15 * 1024 * 1024;

export async function guardarArchivo(
  prisma: ScopedPrismaClient,
  empresaId: string,
  file: File,
  subidoPorId?: string
) {
  if (!MIME_PERMITIDOS.has(file.type)) {
    throw new Error("Tipo de archivo no permitido. Subí una foto (JPG, PNG, HEIC) o un PDF.");
  }
  if (file.size > TAMANIO_MAXIMO_BYTES) {
    throw new Error("El archivo es demasiado grande (máximo 15 MB).");
  }

  const archivo = await prisma.archivo.create({
    data: {
      empresaId,
      url: "",
      nombreOriginal: file.name,
      mimeType: file.type,
      tamanioBytes: file.size,
      subidoPorId,
    },
  });

  if (usaBlob()) {
    await put(rutaBlob(archivo.id), file, { access: "private", addRandomSuffix: false });
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, archivo.id), buffer);
  }

  return prisma.archivo.update({
    where: { id: archivo.id },
    data: { url: `/api/archivos/${archivo.id}` },
  });
}

/**
 * findUniqueOrThrow acá ya viene filtrado por empresaId gracias al cliente
 * scoped (ver lib/tenant-prisma.ts): un id de otra empresa tira igual que un
 * id inexistente, así que un archivo ajeno nunca se puede leer.
 */
export async function leerArchivo(prisma: ScopedPrismaClient, archivoId: string) {
  const archivo = await prisma.archivo.findUniqueOrThrow({ where: { id: archivoId } });
  const mimeType = archivo.mimeType ?? "application/octet-stream";

  if (usaBlob()) {
    const resultado = await get(rutaBlob(archivo.id), { access: "private" });
    if (!resultado || resultado.statusCode !== 200) throw new Error("Archivo no encontrado en Blob");
    const buffer = Buffer.from(await new Response(resultado.stream).arrayBuffer());
    return { buffer, mimeType };
  }

  const buffer = await readFile(path.join(UPLOAD_DIR, archivo.id));
  return { buffer, mimeType };
}
