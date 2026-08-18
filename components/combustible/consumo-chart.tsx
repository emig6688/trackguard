"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ConsumoChart({ data }: { data: { patente: string; consumoPromedio: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="patente" fontSize={12} />
        <YAxis fontSize={12} unit=" L/100km" width={90} />
        <Tooltip formatter={(value) => `${value} L/100km`} />
        <Bar dataKey="consumoPromedio" fill="var(--color-primary, #6366f1)" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
