"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, Loader2, BookMarked, AlertTriangle, CheckCircle2 } from "lucide-react";

type GrupoTipologia = {
  id: string;
  nombre: string;
  hijas: { id: string; nombre: string }[];
};

type DirectrizAplicable = {
  id: string;
  nombre: string;
  codigo: string | null;
  fecha_directriz: string | null;
};

export function SelectorTipologia({
  casoId,
  tipologiaActual,
}: {
  casoId: string;
  tipologiaActual: string | null;
}) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<GrupoTipologia[]>([]);
  const [seleccion, setSeleccion] = useState<string>(tipologiaActual ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directrices, setDirectrices] = useState<DirectrizAplicable[]>([]);
  const [metodo, setMetodo] = useState<string>("");
  const [cargandoDir, setCargandoDir] = useState(false);
  // Guardia de orden: si se disparan varias cargas seguidas, solo aplica la última respuesta.
  const dirReqId = useRef(0);

  useEffect(() => {
    fetch("/api/tipologias")
      .then((r) => r.json())
      .then((body) => setGrupos(body.tipologias ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarDirectrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarDirectrices() {
    const reqId = ++dirReqId.current;
    setCargandoDir(true);
    try {
      const res = await fetch(`/api/casos/${casoId}/directrices-aplicables`);
      if (res.ok) {
        const body = await res.json();
        // Descarta respuestas obsoletas: solo la última carga disparada actualiza el estado.
        if (reqId !== dirReqId.current) return;
        setDirectrices(body.directrices ?? []);
        setMetodo(body.metodo ?? "");
      }
    } finally {
      if (reqId === dirReqId.current) setCargandoDir(false);
    }
  }

  async function handleCambio(nueva: string) {
    const anterior = seleccion;
    setSeleccion(nueva);
    setGuardando(true);
    setGuardado(false);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${casoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipologia_id: nueva || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo guardar la tipología");
      }
    } catch (e) {
      setSeleccion(anterior);
      setError(e instanceof Error ? e.message : "No se pudo guardar la tipología");
      return;
    } finally {
      setGuardando(false);
    }
    setGuardado(true);
    void cargarDirectrices().catch(() => setError("Tipología guardada; no se pudieron actualizar las directrices."));
    router.refresh();
    setTimeout(() => setGuardado(false), 2500);
  }

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d3148]">
        <div className="flex items-center gap-2">
          <Tags className="w-4 h-4 text-[#6b7dff]" />
          <h2 className="text-sm font-semibold text-white">Tipología del caso</h2>
        </div>
        {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
        {guardado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Guardado
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <select
          value={seleccion}
          disabled={guardando}
          onChange={(e) => handleCambio(e.target.value)}
          className="w-full rounded-md border border-[#2d3148] bg-[#0f1117] text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6b7dff]"
        >
          <option value="">Sin tipología asignada</option>
          {grupos.map((g) => (
            <optgroup key={g.id} label={g.nombre}>
              <option value={g.id}>{g.nombre} (general)</option>
              {g.hijas.map((h) => (
                <option key={h.id} value={h.id}>{h.nombre}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Directrices aplicables */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <BookMarked className="w-3 h-3" />
            Directrices Colpensiones aplicables
            {cargandoDir && <Loader2 className="w-3 h-3 animate-spin" />}
          </p>

          {!cargandoDir && directrices.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-orange-400 bg-orange-950/20 border border-orange-900/40 rounded-md px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {seleccion
                  ? "No hay directrices asociadas a esta tipología. Las secciones 15-18 de la ficha requerirán insumo manual."
                  : "Asigna una tipología para resolver las directrices aplicables."}
              </span>
            </div>
          )}

          {directrices.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 rounded-md border border-[#2d3148] bg-[#0f1117] px-3 py-2">
              <BookMarked className="w-3.5 h-3.5 text-[#6b7dff] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white truncate">
                  {d.codigo && <span className="font-mono text-[#6b7dff] mr-1.5">{d.codigo}</span>}
                  {d.nombre}
                </p>
              </div>
              {metodo === "pretension" && (
                <span className="text-[9px] text-gray-500 shrink-0">por pretensión</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
