import "dotenv/config";
import { vi } from "vitest";

// Mocks globales para poder testear app/_actions/*.ts llamándolas
// directamente (sin servidor Next.js real detrás) contra una base de datos
// real. Todo lo que sigue reemplaza únicamente el borde con el mundo
// exterior (sesión, redirect/cache de Next, proveedores externos, guardado
// físico de archivos) — la lógica de negocio de cada action corre tal cual,
// contra Prisma real.

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// redirect() de Next corta la ejecución tirando un error especial pensado
// para que el framework lo intercepte durante el render — fuera de ese
// contexto (como acá) no tiene sentido dejar que corra la implementación
// real. Se reemplaza por un error propio, fácil de identificar en un test
// con `expect(...).rejects.toThrow(RedirectDeTest)`.
export class RedirectDeTest extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    redirect: (url: string) => {
      throw new RedirectDeTest(url);
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Proveedores externos: nunca deben dispararse de verdad desde un test,
// sin importar qué haya configurado en el .env local.
vi.mock("@/lib/email", () => ({
  enviarEmail: vi.fn().mockResolvedValue({ enviado: true }),
}));
vi.mock("@/lib/whatsapp", () => ({
  enviarWhatsapp: vi.fn().mockResolvedValue({ enviado: true }),
}));
vi.mock("@/lib/push", () => ({
  enviarPush: vi.fn().mockResolvedValue(undefined),
}));

// guardarArchivo real crea la fila en Archivo (necesaria: varias FK apuntan
// ahí) pero además escribe el archivo físico en Blob/disco — eso sí se
// reemplaza, no aporta nada a un test y ensucia el filesystem del proyecto.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    guardarArchivo: vi.fn(
      async (
        prisma: { archivo: { create: (args: unknown) => Promise<unknown> } },
        empresaId: string,
        file: File,
        subidoPorId?: string
      ) =>
        prisma.archivo.create({
          data: {
            empresaId,
            url: "/test/fake-archivo",
            nombreOriginal: file.name,
            mimeType: file.type,
            tamanioBytes: file.size,
            subidoPorId,
          },
        })
    ),
  };
});
