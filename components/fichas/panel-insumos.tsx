"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileSearch, Landmark, BookMarked, Tags, User,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Insumos = {
  fuentes: {
    traslado: { nombre: string; caracteres: number } | null;
    actos: { numero: string | null; tipo: string | null; fecha: string | null }[];
    directriz: { nombre: string; codigo: string | null; metodo: string } | null;
    tipologia: boolean;
    perfil: boolean;
  };
  validacion: {
    sectionNumber: number;
    title: string;
    generable: boolean;
    faltantes: string[];
    resolverComoNA: boolean;
  }[];
};

function FilaFuente({
  Icon, label, ok, detalle, linkFaltante,
}: {
  Icon: React.ElementType;
  label: string;
  ok: boolean;
  detalle?: string;
  linkFaltante?: { href: string; texto: string };
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className={cn("w-3.5 h-3.5 shrink-0", ok ? "text-green-600" : "text-muted-foreground/50")} />
      <span className="text-xs font-medium text-foreground flex-1">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600">
          <CheckCircle2 className="w-3 h-3" />
          {detalle ?? "Disponible"}
        </span>
      ) : linkFaltante ? (
        <Link href={linkFaltante.href} className="text-[10px] font-semibold text-[#1a4a8a] hover:underline">
          {linkFaltante.texto} →
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <XCircle className="w-3 h-3" /> Faltante
        </span>
      )}
    </div>
  );
}

export function PanelInsumos({ casoId }: { casoId: string }) {
  const [insumos, setInsumos] = useState<Insumos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    fetch(`/api/casos/${casoId}/insumos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setInsumos(body))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [casoId]);

  if (cargando) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Evaluando insumos del caso...
      </div>
    );
  }
  if (!insumos) return null;

  const { fuentes, validacion } = insumos;
  const noGenerables = validacion.filter((v) => !v.generable && !v.resolverComoNA);
  const comoNA = validacion.filter((v) => !v.generable && v.resolverComoNA);
  const todoOk = noGenerables.length === 0;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden bg-card",
      todoOk ? "border-green-300 dark:border-green-800" : "border-orange-300 dark:border-orange-800"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-5 py-3.5 border-b border-border",
        todoOk ? "bg-green-50 dark:bg-green-950/20" : "bg-orange-50 dark:bg-orange-950/20"
      )}>
        {todoOk
          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
        }
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Insumos para la generación</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {todoOk
              ? "Todas las secciones tienen sus fuentes disponibles"
              : `${noGenerables.length} sección${noGenerables.length !== 1 ? "es" : ""} quedará${noGenerables.length !== 1 ? "n" : ""} sin contenido por falta de insumos`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="px-5 py-3 divide-y divide-border/60">
        <FilaFuente
          Icon={FileSearch}
          label="Traslado de la demanda"
          ok={!!fuentes.traslado}
          detalle={fuentes.traslado ? fuentes.traslado.nombre : undefined}
          linkFaltante={{ href: `/casos/${casoId}`, texto: "Cargar documento" }}
        />
        <FilaFuente
          Icon={Landmark}
          label="Actos administrativos"
          ok={fuentes.actos.length > 0}
          detalle={fuentes.actos.length > 0 ? `${fuentes.actos.length} cargado${fuentes.actos.length !== 1 ? "s" : ""}` : undefined}
          linkFaltante={{ href: `/casos/${casoId}`, texto: "Cargar (opcional)" }}
        />
        <FilaFuente
          Icon={Tags}
          label="Tipología asignada"
          ok={fuentes.tipologia}
          linkFaltante={{ href: `/casos/${casoId}`, texto: "Asignar" }}
        />
        <FilaFuente
          Icon={BookMarked}
          label="Directriz Colpensiones"
          ok={!!fuentes.directriz}
          detalle={fuentes.directriz ? `${fuentes.directriz.codigo ?? ""} ${fuentes.directriz.nombre}`.trim().slice(0, 40) : undefined}
          linkFaltante={{ href: `/configuracion/directrices`, texto: "Gestionar" }}
        />
        <FilaFuente
          Icon={User}
          label="Perfil del abogado (sección 19)"
          ok={fuentes.perfil}
          linkFaltante={{ href: `/configuracion`, texto: "Completar" }}
        />
      </div>

      {expandido && (
        <div className="px-5 py-3 border-t border-border bg-muted/20 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Impacto por sección
          </p>
          {noGenerables.map((v) => (
            <p key={v.sectionNumber} className="text-[11px] text-orange-600 dark:text-orange-400">
              <span className="font-semibold">Sec. {v.sectionNumber}</span> — {v.title.slice(0, 60)}: quedará vacía (falta: {v.faltantes.join(", ")})
            </p>
          ))}
          {comoNA.map((v) => (
            <p key={v.sectionNumber} className="text-[11px] text-muted-foreground">
              <span className="font-semibold">Sec. {v.sectionNumber}</span> — {v.title.slice(0, 60)}: se resolverá como N/A
            </p>
          ))}
          {noGenerables.length === 0 && comoNA.length === 0 && (
            <p className="text-[11px] text-green-600">Las 19 secciones tienen fuente disponible.</p>
          )}
        </div>
      )}
    </div>
  );
}
