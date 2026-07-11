"use client";

import { useState } from "react";
import { type TipoSeccion, BADGE_TIPO } from "@/lib/ia/secciones";
import { Button } from "@/components/ui/button";
import { Check, Pencil, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CajaIAProps {
  seccionKey: string;
  tipo: TipoSeccion;
  label: string;
  descripcion: string;
  valor: string;
  onChange: (valor: string) => void;
  onRegenerar?: () => Promise<void>;
}

export function CajaIA({
  seccionKey,
  tipo,
  label,
  descripcion,
  valor,
  onChange,
  onRegenerar,
}: CajaIAProps) {
  const [editando, setEditando] = useState(tipo === "MANUAL");
  const [regenerando, setRegenerando] = useState(false);
  const [aceptado, setAceptado] = useState(false);
  const badge = BADGE_TIPO[tipo];

  async function handleRegenerar() {
    if (!onRegenerar) return;
    setRegenerando(true);
    setAceptado(false);
    try {
      await onRegenerar();
    } finally {
      setRegenerando(false);
    }
  }

  function handleAceptar() {
    setEditando(false);
    setAceptado(true);
  }

  return (
    <div className={cn(
      "rounded-lg border-2 transition-colors",
      aceptado ? "border-green-200 bg-green-50/30" : "border-border bg-card"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full border",
            badge.clase
          )}>
            {badge.label}
          </span>
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>

        <div className="flex items-center gap-1.5">
          {tipo !== "MANUAL" && !editando && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => { setEditando(true); setAceptado(false); }}
            >
              <Pencil className="w-3 h-3" /> Editar
            </Button>
          )}

          {tipo === "AUTO" && onRegenerar && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={handleRegenerar}
              disabled={regenerando}
            >
              {regenerando
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />
              }
              Regenerar
            </Button>
          )}

          {(editando || !aceptado) && valor && (
            <Button
              size="sm"
              className="h-7 px-2 text-xs gap-1 bg-green-600 hover:bg-green-700"
              onClick={handleAceptar}
            >
              <Check className="w-3 h-3" /> Aceptar
            </Button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {tipo === "MANUAL" || editando ? (
          <textarea
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder={tipo === "MANUAL"
              ? `Diligenciar manualmente: ${descripcion}`
              : "Edita el contenido generado..."
            }
            rows={6}
            className="w-full text-sm resize-y rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        ) : (
          <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed min-h-[60px]">
            {valor || (
              <span className="text-muted-foreground italic">{descripcion}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
