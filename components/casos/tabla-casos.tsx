"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_ESTADO } from "@/lib/ui/estado-badge";

type ClaveEstado = "completado" | "en_proceso" | "pendiente";

// Deriva el estado de flujo del caso a partir de sus fichas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FICHA_FINAL = new Set(["listo", "aprobada", "exportada", "exportado"]);
function claveEstado(caso: any): ClaveEstado {
  const fichas = Array.isArray(caso.fichas_conciliacion) ? caso.fichas_conciliacion : [];
  if (fichas.some((f: { estado: string }) => FICHA_FINAL.has(f.estado))) return "completado";
  if (fichas.length > 0) return "en_proceso";
  return "pendiente";
}

const FILTROS: { key: "todos" | ClaveEstado; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendientes" },
  { key: "en_proceso", label: "En proceso" },
  { key: "completado", label: "Completados" },
];

// Acento de color por estado (riel a la izquierda + punto en el badge) para escaneo rápido.
const ACENTO: Record<ClaveEstado, string> = {
  pendiente: "#2563eb",  // azul (coincide con el badge)
  en_proceso: "#d97706", // ámbar
  completado: "#16a34a", // verde
};

// Quita la ciudad repetida y el departamento del despacho
// ("JUZGADO ... DE CALI — CALI — VALLE DEL CAUCA" → "JUZGADO ... DE CALI")
function limpiarDespacho(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto.split(/\s*[—–]\s*/)[0].trim();
}

// Convierte texto en MAYÚSCULAS a "Nombre Propio" (deja conectores en minúscula)
const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
function aNombrePropio(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((palabra, i) => {
      if (i > 0 && MINUSCULAS.has(palabra)) return palabra;
      // Mantén tokens con dígitos tal cual (ej. "021")
      if (/\d/.test(palabra)) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

type FichaMin = { id: string; estado: string };

type CasoConFichas = {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  expediente_pensional: string | null;
  despacho: string | null;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
  estado: string;
  created_at: string;
  fichas_conciliacion: FichaMin[] | null;
};

interface TablaCasosProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  casos: any[];
}

export function TablaCasos({ casos }: TablaCasosProps) {
  const lista = casos as CasoConFichas[];
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"todos" | ClaveEstado>("todos");

  // Contadores por estado (KPIs) y lista filtrada por búsqueda + estado.
  const { counts, filtrados } = useMemo(() => {
    const counts: Record<string, number> = { todos: lista.length, pendiente: 0, en_proceso: 0, completado: 0 };
    const conEstado = lista.map((c) => {
      const est = claveEstado(c);
      counts[est]++;
      return { c, est };
    });
    const q = query.trim().toLowerCase();
    const filtrados = conEstado.filter(({ c, est }) => {
      if (filtro !== "todos" && est !== filtro) return false;
      if (!q) return true;
      return [c.nombre_demandante, c.cedula_demandante, c.radicado, c.radicado_bizagi, c.despacho]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
    return { counts, filtrados };
  }, [lista, query, filtro]);

  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <FileText className="w-10 h-10 opacity-30" />
        <p className="text-sm">No hay casos registrados</p>
        <Link
          href="/casos/nuevo"
          className="text-sm text-primary hover:underline font-medium"
        >
          Registrar primer caso →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Barra de herramientas: búsqueda + filtros con contadores (KPIs) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-border">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar demandante, cédula o radicado…"
            className="w-full h-9 pl-9 pr-3 rounded-full bg-muted/70 border border-transparent text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-ring/40 focus:ring-2 focus:ring-ring/20 focus:outline-none transition-all"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 sm:ml-auto overflow-x-auto">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all flex items-center gap-1.5",
                filtro === f.key ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span className="tabular-nums opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabla con encabezado fijo (scroll interno) ── */}
      <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[200px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted [&>th]:bg-muted">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Demandante</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Radicado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Despacho</th>
              <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Sin resultados para el filtro o la búsqueda actual.
                </td>
              </tr>
            )}
            {filtrados.map(({ c: caso, est: clave }) => {
              const fichaLista = clave === "completado";
              const sinFicha = clave === "pendiente";
              const est = WORKFLOW_ESTADO[clave];

              return (
                <tr key={caso.id} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors group">
                  {/* Demandante (ancla) con riel de color por estado */}
                  <td className="px-4 py-3 border-l-[3px]" style={{ borderLeftColor: ACENTO[clave] }}>
                    <p className="font-semibold text-foreground text-sm leading-tight">{aNombrePropio(caso.nombre_demandante)}</p>
                    {caso.cedula_demandante && (
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">C.C. {caso.cedula_demandante}</p>
                    )}
                  </td>

                  {/* Radicado */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground/70 tabular-nums">{caso.radicado}</span>
                    {caso.radicado_bizagi && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tabular-nums">{caso.radicado_bizagi}</p>
                    )}
                  </td>

                  {/* Despacho */}
                  <td className="px-4 py-3 text-sm text-muted-foreground min-w-[240px]">
                    {caso.despacho ? aNombrePropio(limpiarDespacho(caso.despacho)) : "—"}
                  </td>

                  {/* Estado */}
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${est.clase}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACENTO[clave] }} />
                      {est.label}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/generador/${caso.id}/params`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-[0.98] border-primary text-primary hover:bg-[var(--sidebar)] hover:border-[var(--sidebar)] hover:text-white"
                      >
                        F. Conciliación
                      </Link>
                      {fichaLista ? (
                        <Link
                          href={`/demanda/${caso.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-[0.98] border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
                        >
                          Contestación Dda
                        </Link>
                      ) : (
                        <span
                          title={sinFicha ? "Genera y cierra la ficha de conciliación primero" : "La ficha de conciliación aún no está lista"}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground/60 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pie: resumen del filtro */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
        <span>Mostrando <strong className="text-foreground tabular-nums">{filtrados.length}</strong> de {lista.length} procesos</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Contestación Dda se habilita al cerrar la conciliación
        </span>
      </div>
    </div>
  );
}
