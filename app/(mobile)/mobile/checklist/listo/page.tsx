import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function ChecklistListoPage({
  searchParams,
}: {
  searchParams: Promise<{ fallas?: string }>;
}) {
  const { fallas } = await searchParams;

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-lg font-semibold">Checklist enviado</h1>
      {fallas === "1" ? (
        <p className="text-sm text-muted-foreground">
          Se registraron fallas. Se generó una orden de trabajo para que el encargado de
          mantenimiento la revise.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Todo OK. Buen viaje.</p>
      )}
      <Link href="/mobile/inicio" className={buttonVariants({ className: "w-full" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
