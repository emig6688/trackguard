import { NextResponse } from "next/server";
import { requireSession, AutorizacionError } from "@/lib/permisos";
import { leerArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { prisma } = await requireSession();
    const { id } = await params;
    const { buffer, mimeType } = await leerArchivo(prisma, id);
    return new NextResponse(buffer, {
      headers: { "Content-Type": mimeType, "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof AutorizacionError) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
