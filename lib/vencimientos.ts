export type EstadoVencimiento = "VENCIDO" | "PROXIMO" | "VIGENTE";

export function diasHastaVencimiento(fechaVencimiento: Date, ahora: Date = new Date()): number {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function calcularEstadoVencimiento(
  fechaVencimiento: Date,
  diasAlerta: number[] = [30, 15, 7]
): EstadoVencimiento {
  const diffDias = diasHastaVencimiento(fechaVencimiento);
  const maxDiasAlerta = diasAlerta.length > 0 ? Math.max(...diasAlerta) : 30;

  if (diffDias < 0) return "VENCIDO";
  if (diffDias <= maxDiasAlerta) return "PROXIMO";
  return "VIGENTE";
}

export const ESTADO_VENCIMIENTO_LABEL: Record<EstadoVencimiento, string> = {
  VENCIDO: "Vencido",
  PROXIMO: "Próximo a vencer",
  VIGENTE: "Vigente",
};

export const ESTADO_VENCIMIENTO_VARIANT: Record<
  EstadoVencimiento,
  "destructive" | "warning" | "success"
> = {
  VENCIDO: "destructive",
  PROXIMO: "warning",
  VIGENTE: "success",
};
