"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CumplimientoAgregado } from "@/lib/estadisticas-guardia";

const NOMBRES: Record<string, string> = {
  checklistSalida: "Checklist salida",
  cierreRuta: "Cierre de ruta",
  tanqueLleno: "Tanque lleno",
};

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatearClavePorGranularidad(clave: string, granularidad: "MES" | "ANIO") {
  if (granularidad === "ANIO") return clave;
  return MESES_CORTOS[Number(clave) - 1] ?? clave;
}

function TooltipPersonalizado({
  active,
  payload,
  label,
  granularidad,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  granularidad: "MES" | "ANIO";
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatearClavePorGranularidad(label, granularidad)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="tabular-nums text-muted-foreground">
          {NOMBRES[p.dataKey] ?? p.dataKey}: {p.value} días
        </p>
      ))}
    </div>
  );
}

export function CumplimientoChart({
  data,
  granularidad,
}: {
  data: CumplimientoAgregado[];
  granularidad: "MES" | "ANIO";
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="clave"
          tickFormatter={(clave: string) => formatearClavePorGranularidad(clave, granularidad)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          content={<TooltipPersonalizado granularidad={granularidad} />}
          cursor={{ fill: "var(--muted)" }}
        />
        <Legend formatter={(value: string) => NOMBRES[value] ?? value} />
        <Bar dataKey="checklistSalida" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="cierreRuta" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="tanqueLleno" fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
