"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Clock, CheckCircle2, ChevronDown, ChevronRight,
  FileText, ExternalLink, Mail, FileSignature,
  AlertCircle, StickyNote,
} from "lucide-react";

type Accion = {
  id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
};

type Caso = {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  pretension: string | null;
};

type Pendiente = {
  id: string;
  motivo: string;
  descripcion: string | null;
  estado: string;
  created_at: string;
  resuelto_at: string | null;
  casos: Caso;
  acciones_pendiente: Accion[];
};

// Grilla compartida entre el encabezado y las filas (chevron + 6 columnas).
const GRID_COLS =
  "grid items-center gap-x-3 md:gap-x-4 grid-cols-[18px_minmax(0,1fr)_auto] " +
  "md:grid-cols-[18px_minmax(0,1.4fr)_minmax(0,1.15fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_auto_auto]";

const MOTIVO_LABEL: Record<string, string> = {
  sin_traslado_demanda: "Sin traslado de demanda en Bizagi",
  documento_ilegible:   "Documento no procesable (requiere transcripción)",
  insumos_incompletos:  "Insumos incompletos para generar ficha",
};

const ACCION_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  memorial_generado: { label: "Memorial generado",         Icon: FileText,      color: "text-orange-600" },
  enviado_portal:    { label: "Enviado — Portal RJ",       Icon: ExternalLink,  color: "text-blue-600"   },
  enviado_correo:    { label: "Enviado — Gmail",           Icon: Mail,          color: "text-red-500"    },
  poder_generado:    { label: "Poder de sustitución",      Icon: FileSignature, color: "text-purple-600" },
  documento_error:   { label: "Documento no procesable",   Icon: AlertCircle,   color: "text-orange-600" },
  nota:              { label: "Nota",                      Icon: StickyNote,    color: "text-yellow-600" },
};

function Badge({ estado }: { estado: string }) {
  return estado === "pendiente" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
      <Clock className="w-2.5 h-2.5" /> Pendiente
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle2 className="w-2.5 h-2.5" /> Resuelto
    </span>
  );
}

function FilaAccion({ accion }: { accion: Accion }) {
  const cfg = ACCION_CONFIG[accion.tipo] ?? { label: accion.tipo, Icon: AlertCircle, color: "text-muted-foreground" };
  const { Icon } = cfg;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{cfg.label}</p>
        {accion.descripcion && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{accion.descripcion}</p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {new Date(accion.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

function FilaPendiente({ pendiente, onResuelto }: { pendiente: Pendiente; onResuelto: (id: string) => void }) {
  const [expandido, setExpandido] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const caso = pendiente.casos;
  const acciones = pendiente.acciones_pendiente ?? [];

  async function resolver() {
    setResolviendo(true);
    try {
      await fetch(`/api/pendientes/${pendiente.id}/resolver`, { method: "POST" });
      onResuelto(pendiente.id);
    } finally {
      setResolviendo(false);
    }
  }

  return (
    <div
      className={cn(
        "border-b border-border last:border-0 border-l-[3px] transition-colors",
        pendiente.estado === "pendiente" ? "bg-card" : "bg-muted/20"
      )}
      style={{ borderLeftColor: pendiente.estado === "pendiente" ? "#ea580c" : "#16a34a" }}
    >
      {/* Fila principal */}
      <div
        className={cn(GRID_COLS, "px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors")}
        onClick={() => setExpandido(!expandido)}
      >
        {/* Chevron */}
        <button type="button" className="text-muted-foreground shrink-0">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Demandante (ancla) */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{caso.nombre_demandante}</p>
          <p className="md:hidden text-[11px] font-mono text-muted-foreground truncate">{caso.radicado}</p>
        </div>

        {/* Radicado (+ bizagi) */}
        <div className="hidden md:block min-w-0">
          <span className="font-mono text-xs text-foreground/70 tabular-nums">{caso.radicado}</span>
          {caso.radicado_bizagi && (
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tabular-nums truncate">{caso.radicado_bizagi}</p>
          )}
        </div>

        {/* Despacho */}
        <div className="hidden md:block min-w-0 text-xs text-muted-foreground truncate">{caso.despacho ?? "—"}</div>

        {/* Observación */}
        <div className="hidden md:block min-w-0">
          <p className="text-xs text-muted-foreground truncate">{MOTIVO_LABEL[pendiente.motivo] ?? pendiente.motivo}</p>
          {acciones.length > 0 && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{acciones.length} acción{acciones.length !== 1 ? "es" : ""}</p>
          )}
        </div>

        {/* Estado */}
        <div className="hidden md:block"><Badge estado={pendiente.estado} /></div>

        {/* Fecha */}
        <div className="text-[11px] text-muted-foreground whitespace-nowrap text-right md:text-left">
          {new Date(pendiente.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
        </div>
      </div>

      {/* Panel expandido */}
      {expandido && (
        <div className="px-10 pb-4 space-y-3">
          {/* Info básica */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Radicado</p>
              <p className="font-mono text-foreground">{caso.radicado}</p>
            </div>
            {caso.radicado_bizagi && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Bizagi</p>
                <p className="text-foreground">{caso.radicado_bizagi}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Despacho</p>
              <p className="text-foreground truncate">{caso.despacho ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pretensión</p>
              <p className="text-foreground capitalize">{caso.pretension ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Estado</p>
              <Badge estado={pendiente.estado} />
            </div>
            {pendiente.resuelto_at && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Resuelto</p>
                <p className="text-foreground">{new Date(pendiente.resuelto_at).toLocaleDateString("es-CO")}</p>
              </div>
            )}
          </div>

          {/* Historial de acciones */}
          <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/40">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Historial de acciones
              </p>
            </div>
            <div className="px-3 divide-y divide-border">
              {acciones.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">Sin acciones registradas.</p>
              ) : (
                acciones
                  .slice()
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((a) => <FilaAccion key={a.id} accion={a} />)
              )}
            </div>
          </div>

          {/* Acciones disponibles */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <a
              href={`/generador/${caso.id}/params`}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Ir al caso →
            </a>
            {pendiente.estado === "pendiente" && (
              <button
                type="button"
                disabled={resolviendo}
                onClick={resolver}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {resolviendo ? "Guardando..." : "Marcar como resuelto"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TablaPendientes({ pendientes }: { pendientes: any[] }) {
  const router = useRouter();
  const [lista, setLista] = useState<Pendiente[]>(pendientes as Pendiente[]);
  const [filtro, setFiltro] = useState<"todos" | "pendiente" | "resuelto">("pendiente");

  function onResuelto(id: string) {
    setLista((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, estado: "resuelto", resuelto_at: new Date().toISOString() }
          : p
      )
    );
    router.refresh();
  }

  const filtrados = lista.filter((p) => filtro === "todos" || p.estado === filtro);

  return (
    <div>
      {/* Filtros */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-muted/20">
        {(["pendiente", "resuelto", "todos"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors",
              filtro === f
                ? "bg-card border border-border text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "pendiente" ? "Pendientes" : f === "resuelto" ? "Resueltos" : "Todos"}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {lista.filter((p) => f === "todos" || p.estado === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {filtro === "pendiente" ? "No hay casos pendientes" : "No hay registros"}
          </p>
          <p className="text-xs text-muted-foreground/60">
            Los casos se añaden automáticamente desde el módulo F. Conciliación
          </p>
        </div>
      ) : (
        <>
          {/* Encabezado de columnas */}
          <div className={cn(GRID_COLS, "px-4 py-2.5 border-l-[3px] border-transparent border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide")}>
            <span />
            <span>Demandante</span>
            <span className="hidden md:block">Radicado</span>
            <span className="hidden md:block">Despacho</span>
            <span className="hidden md:block">Observación</span>
            <span className="hidden md:block">Estado</span>
            <span className="text-right md:text-left">Fecha</span>
          </div>
          {filtrados.map((p) => (
            <FilaPendiente key={p.id} pendiente={p} onResuelto={onResuelto} />
          ))}
        </>
      )}
    </div>
  );
}
