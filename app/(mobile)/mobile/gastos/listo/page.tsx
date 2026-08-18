import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function GastoListoPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-lg font-semibold">Gasto registrado</h1>
      <Link href="/mobile/inicio" className={buttonVariants({ className: "w-full" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
