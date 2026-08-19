import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Quita la ciudad repetida y el departamento del despacho
// ("JUZGADO ... DE CALI — CALI — VALLE DEL CAUCA" → "JUZGADO ... DE CALI")
export function limpiarDespacho(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const base = texto.split(/\s*[—–]\s*/)[0].trim();
  return base || null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}
