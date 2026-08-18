import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function EventoListoPage({
  searchParams,
}: {
  searchParams: Promise<{ sinNovedades?: string }>;
}) {
  const { sinNovedades } = await searchParams;

  return (
    <div className="space-y-4 text-center">
      {sinNovedades === "1" ? (
        <>
          <h1 className="text-lg font-semibold">Ruta cerrada sin novedades</h1>
          <p className="text-sm text-muted-foreground">Buen descanso.</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold">Ruta cerrada — reporte enviado</h1>
          <p className="text-sm text-muted-foreground">
            Se generó una orden de trabajo para que el encargado de mantenimiento lo revise.
          </p>
        </>
      )}
      <Link href="/mobile/inicio" className={buttonVariants({ className: "w-full" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
