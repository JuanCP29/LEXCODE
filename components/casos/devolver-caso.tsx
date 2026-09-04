"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, AlertCircle, X } from "lucide-react";
import { FoqsLoader } from "@/components/ui/foqs-loader";

const MOTIVOS = [
  "No corresponde a mi despacho",
  "Radicado / demandante incorrecto",
  "Falta de competencia / conflicto",
  "Otro",
];

export function DevolverCaso({ casoId, demandante }: { casoId: string; demandante?: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function devolver() {
    setEnviando(true);
    setError(null);
    const texto = motivo === "Otro" ? detalle.trim() : (detalle.trim() ? `${motivo} — ${detalle.trim()}` : motivo);
    try {
      const res = await fetch(`/api/casos/${casoId}/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: texto }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo devolver");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo devolver");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/60 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
        title="Devolver caso mal asignado"
      >
        <Undo2 className="w-3.5 h-3.5" /> Devolver
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !enviando && setAbierto(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl card-shadow-md p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Undo2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Devolver caso</h3>
                  {demandante && <p className="text-[11px] text-muted-foreground">{demandante}</p>}
                </div>
              </div>
              <button onClick={() => !enviando && setAbierto(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              El caso volverá al pool de <strong>Asignaciones</strong> para que un coordinador lo reasigne. Indica el motivo.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Motivo</label>
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25">
                  {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {motivo === "Otro" ? "Describe el motivo" : "Detalle (opcional)"}
                </label>
                <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={3}
                  placeholder="Contexto para el coordinador…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 resize-none" />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAbierto(false)} disabled={enviando}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button type="button" onClick={devolver} disabled={enviando || (motivo === "Otro" && detalle.trim().length < 3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 active:scale-[0.99] transition-all disabled:opacity-60">
                  {enviando ? <><FoqsLoader size="sm" /> Devolviendo…</> : <><Undo2 className="w-4 h-4" /> Devolver caso</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
