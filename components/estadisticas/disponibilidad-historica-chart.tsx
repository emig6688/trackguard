"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DisponibilidadMensual } from "@/lib/estadisticas";

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
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label ? formatearMes(label) : ""}</p>
      <p className="tabular-nums text-muted-foreground">{payload[0].value}% disponible</p>
    </div>
  );
}

export function DisponibilidadHistoricaChart({ data }: { data: DisponibilidadMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="mes"
          tickFormatter={formatearMes}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<TooltipPersonalizado />} cursor={{ stroke: "var(--muted-foreground)" }} />
        <Line
          type="monotone"
          dataKey="disponibilidadPromedio"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
