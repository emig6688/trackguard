import { NextResponse } from "next/server";
import { requireSession } from "@/lib/permisos";
import { leerArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { prisma } = await requireSession();
  const { id } = await params;

  try {
    const { buffer, mimeType } = await leerArchivo(prisma, id);
    return new NextResponse(buffer, { headers: { "Content-Type": mimeType } });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
