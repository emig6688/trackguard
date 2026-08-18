"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CostoMensual } from "@/lib/costos";

function formatearMes(mes: string) {
  const [anio, mesNum] = mes.split("-").map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }).replace(".", "");
}

function formatearMonedaCorta(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function formatearMoneda(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function TooltipPersonalizado({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label ? formatearMes(label) : ""}</p>
      <p className="tabular-nums text-muted-foreground">{formatearMoneda(payload[0].value)}</p>
    </div>
  );
}

export function CostosMensualesChart({ data }: { data: CostoMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="mes"
          tickFormatter={formatearMes}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatearMonedaCorta}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="monto" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
