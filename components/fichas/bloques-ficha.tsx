"use client";

import { Label } from "@/components/ui/label";
import { EditorRico } from "@/components/fichas/editor-rico";

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

// Módulo de texto: ahora editor enriquecido (negrita/cursiva/subrayado + barra
// flotante sobre la selección), con contador de palabras y restaurar sugerencia.
// Mantiene la misma API; el valor entra/sale como HTML (acepta texto plano heredado).
export function ModuloTexto({ value, onChange, sugerencia, placeholder, minHeight = 160, maxHeight = 360, tablas = false }: {
  value: string;
  onChange: (v: string) => void;
  sugerencia?: string | null;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  tablas?: boolean;
}) {
  return (
    <EditorRico
      value={value}
      onChange={onChange}
      sugerencia={sugerencia}
      placeholder={placeholder}
      minHeight={minHeight}
      maxHeight={maxHeight}
      tablas={tablas}
    />
  );
}
