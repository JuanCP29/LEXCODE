"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Undo2, UserCheck, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { FoqsLoader } from "@/components/ui/foqs-loader";

type Devuelto = {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  devolucion_motivo: string | null;
  devuelto_at: string | null;
  devuelto_por_nombre: string | null;
};
type Usuario = { id: string; nombre: string; rol: string; esYo: boolean };

const MIN = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
const t = (s: string | null) => !s ? "—" : s.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MIN.has(p)) || /\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—";

export function DevolucionesPanel() {
  const [lista, setLista] = useState<Devuelto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [asignarA, setAsignarA] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/devoluciones");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      setLista(body.devoluciones ?? []);
      setUsuarios(body.usuarios ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nombreUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nombre ?? "";

  async function asignar(ids: string[], userId: string) {
    if (!ids.length || !userId) return;
    setAsignando(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/cola/asignar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_ids: ids, asignado_a: userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al asignar");
      setLista((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSel(new Set());
      setAsignarA("");
      setMsg(`${ids.length} caso${ids.length !== 1 ? "s" : ""} reasignado${ids.length !== 1 ? "s" : ""} a ${nombreUsuario(userId)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setAsignando(false);
    }
  }

  const todos = lista.length > 0 && lista.every((c) => sel.has(c.id));
  const toggleTodos = () => setSel(todos ? new Set() : new Set(lista.map((c) => c.id)));
  const toggleUno = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Undo2 className="w-4 h-4 text-amber-600" /> {lista.length} caso{lista.length !== 1 ? "s" : ""} devuelto{lista.length !== 1 ? "s" : ""}
        </span>
        {msg && <span className="text-[11px] text-green-700 dark:text-green-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {msg}</span>}
        {error && <span className="text-[11px] text-destructive inline-flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</span>}
      </div>

      {/* Barra de reasignación masiva */}
      {sel.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-primary/5 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{sel.size} seleccionado{sel.size !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2 ml-auto">
            <select value={asignarA} onChange={(e) => setAsignarA(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Reasignar a…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.esYo ? "Yo" : u.nombre}{u.rol ? ` · ${u.rol}` : ""}</option>)}
            </select>
            <button type="button" onClick={() => asignar(Array.from(sel), asignarA)} disabled={!asignarA || asignando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {asignando ? <FoqsLoader size="sm" /> : <UserCheck className="w-3.5 h-3.5" />} Reasignar
            </button>
            <button type="button" onClick={() => setSel(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Limpiar</button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><FoqsLoader size="sm" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Undo2 className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No hay casos devueltos</p>
          <p className="text-xs text-muted-foreground/60">Cuando un sustanciador devuelva un caso mal asignado, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[200px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted [&>th]:bg-muted">
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={todos} onChange={toggleTodos} className="w-4 h-4 align-middle" /></th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Demandante</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Radicado</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Despacho</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Causal de devolución</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Devuelto</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Reasignar</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className={cn("border-b border-border last:border-0 transition-colors", sel.has(c.id) ? "bg-primary/5" : "hover:bg-muted/30")}>
                  <td className="px-4 py-3 border-l-[3px] border-amber-500">
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleUno(c.id)} className="w-4 h-4 align-middle" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground text-sm leading-tight">{t(c.nombre_demandante)}</p>
                    {c.cedula_demandante && <p className="text-xs text-muted-foreground tabular-nums mt-0.5">C.C. {c.cedula_demandante}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground/70 tabular-nums">{c.radicado}</span>
                    {c.radicado_bizagi && <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tabular-nums">{c.radicado_bizagi}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground min-w-[200px]">{t(c.despacho)}</td>
                  {/* Causal de devolución */}
                  <td className="px-4 py-3 min-w-[220px] max-w-[300px]">
                    <span className="inline-flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <Undo2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{c.devolucion_motivo}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] text-muted-foreground">
                    {c.devuelto_por_nombre && <p className="text-foreground/80">{t(c.devuelto_por_nombre)}</p>}
                    <p>{fecha(c.devuelto_at)}</p>
                  </td>
                  {/* Reasignar */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex justify-end">
                      <div className="relative">
                        <UserCheck className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <select value="" onChange={(e) => { if (e.target.value) asignar([c.id], e.target.value); }}
                          aria-label="Reasignar caso"
                          className="appearance-none text-xs font-semibold rounded-md border border-primary text-primary bg-card pl-7 pr-6 py-1.5 cursor-pointer hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-ring transition-colors">
                          <option value="">Reasignar</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.esYo ? "Yo" : u.nombre}{u.rol ? ` · ${u.rol}` : ""}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/70" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
