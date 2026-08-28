"use client";

import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Pencil, RotateCcw } from "lucide-react";

/**
 * Bloques de UI compartidos por el generador de Ficha y el de Contestación:
 * tarjeta de sección (Bloque), etiqueta de campo (Campo) y editor de texto con
 * contador de palabras + sugerencia IA (ModuloTexto). Fuente única del estilo.
 */
export function Bloque({ numero, titulo, children, icono }: { numero?: number; titulo: string; children: React.ReactNode; icono?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-primary/5 border-l-4 border-l-primary">
        <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 ring-2 ring-[#6ea8e6]">
          {icono ?? numero}
        </span>
        <h3 className="text-[15px] font-bold text-foreground">{titulo}</h3>
      </div>
      <div className="px-6 py-5 space-y-5 bg-muted/40 dark:bg-transparent">{children}</div>
    </div>
  );
}

export function Campo({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function contarPalabras(s: string): number {
  const t = (s ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// Módulo de texto con IA: autoexpansión, contador de palabras, marca "editado"
// y botón para restaurar la sugerencia original de la IA.
export function ModuloTexto({ value, onChange, sugerencia, placeholder, minHeight = 140, maxHeight = 340 }: {
  value: string;
  onChange: (v: string) => void;
  sugerencia?: string | null;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const alto = Math.min(Math.max(minHeight, el.scrollHeight), maxHeight);
    el.style.height = `${alto}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, minHeight, maxHeight]);

  const editado = !!(sugerencia && sugerencia.trim() && value !== sugerencia);
  const palabras = contarPalabras(value);

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight, maxHeight }}
        className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/25 resize-none"
      />
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{palabras} palabra{palabras === 1 ? "" : "s"}</span>
        {editado && value.trim() && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Pencil className="w-3 h-3" /> editado
          </span>
        )}
        {editado && (
          <button
            type="button"
            onClick={() => onChange(sugerencia as string)}
            className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar sugerencia IA
          </button>
        )}
      </div>
    </div>
  );
}
