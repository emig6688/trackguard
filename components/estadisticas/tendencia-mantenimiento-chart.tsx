"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TendenciaMantenimiento } from "@/lib/estadisticas";

function formatearMes(mes: string) {
  const [anio, mesNum] = mes.split("-").map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }).replace(".", "");
}

function TooltipPersonalizado({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label ? formatearMes(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function TendenciaMantenimientoChart({ data }: { data: TendenciaMantenimiento[] }) {
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
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: "var(--muted)" }} />
        <Legend
          formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="preventivo" name="Preventivo" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="correctivo" name="Correctivo" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
