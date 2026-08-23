"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, CheckCircle2, MousePointer2, Loader2, Check, Upload, FileDown } from "lucide-react";

// Recorrido tipo video: 5 escenas encadenadas en bucle.
const ESCENAS = [
  { id: "reparto",  cap: "Abre la ficha desde el caso",   dur: 2600 },
  { id: "ingesta",  cap: "La IA analiza el traslado",     dur: 2900 },
  { id: "llenado",  cap: "Prellena hechos y pretensiones", dur: 3200 },
  { id: "riesgo",   cap: "Calcula el riesgo procesal",    dur: 2200 },
  { id: "descarga", cap: "Genera y descarga el documento", dur: 3200 },
] as const;
// El "clic" del cursor ocurre ~850 ms después de entrar (cuando ya llegó al botón).
const CLICK_DELAY = 850;

// Posición del cursor (en %) por escena.
const CURSOR: Record<string, { top: string; left: string; click: boolean }> = {
  reparto:  { top: "30%", left: "20%", click: true },
  ingesta:  { top: "45%", left: "55%", click: false },
  llenado:  { top: "62%", left: "72%", click: false },
  riesgo:   { top: "62%", left: "72%", click: false },
  descarga: { top: "86%", left: "62%", click: true },
};

export function DemoTour() {
  const [i, setI] = useState(0);
  const [pressed, setPressed] = useState(false);
  const esc = ESCENAS[i].id;

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setI(2); return; }
    setPressed(false);
    const t = setTimeout(() => setI((n) => (n + 1) % ESCENAS.length), ESCENAS[i].dur);
    // Clic del cursor (solo escenas con botón): llega y luego pulsa.
    let tDown: ReturnType<typeof setTimeout> | undefined;
    let tUp: ReturnType<typeof setTimeout> | undefined;
    if (CURSOR[ESCENAS[i].id].click) {
      tDown = setTimeout(() => setPressed(true), CLICK_DELAY);
      tUp = setTimeout(() => setPressed(false), CLICK_DELAY + 600);
    }
    return () => { clearTimeout(t); if (tDown) clearTimeout(tDown); if (tUp) clearTimeout(tUp); };
  }, [i]);

  const cur = CURSOR[esc];

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/5 blur-2xl" aria-hidden />

      {/* Ventana de la app */}
      <div className="relative bg-card border border-border rounded-2xl card-shadow-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-10 bg-primary text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="ml-3 text-[11px] font-semibold text-white/90">LEGIUX · Generador de ficha</span>
        </div>

        {/* Escenario */}
        <div className="relative h-[340px] bg-primary/[0.04] overflow-hidden">
          <div key={esc} className="absolute inset-0 p-4 animate-fade-up">
            {esc === "reparto" && <EscReparto />}
            {esc === "ingesta" && <EscIngesta />}
            {(esc === "llenado" || esc === "riesgo") && <EscFicha riesgo={esc === "riesgo"} />}
            {esc === "descarga" && <EscDescarga descargado={pressed} />}
          </div>

          {/* Cursor animado */}
          <div
            className="pointer-events-none absolute z-20 transition-all duration-700 ease-out"
            style={{ top: cur.top, left: cur.left }}
            aria-hidden
          >
            {pressed && <span className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-primary/30 animate-ripple" />}
            <MousePointer2 className={cn("w-5 h-5 text-primary fill-white drop-shadow transition-transform duration-150", pressed && "scale-90")} />
          </div>
        </div>

        {/* Pie: subtítulo de la escena */}
        <div className="px-5 py-3 border-t border-border bg-card flex items-center gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="font-medium text-foreground">{ESCENAS[i].cap}</span>
        </div>
      </div>

      {/* Indicador de progreso (barras por escena) */}
      <div className="mt-4 flex items-center gap-1.5">
        {ESCENAS.map((e, n) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setI(n)}
            className={cn("h-1.5 rounded-full transition-all", n === i ? "w-8 bg-primary" : "w-4 bg-border hover:bg-muted-foreground/40")}
            aria-label={e.cap}
          />
        ))}
      </div>
    </div>
  );
}

// ── Escena: Reparto (clic en F. Conciliación) ──
function EscReparto() {
  const rows = [
    { n: "Andrés Felipe Rojas", d: "Juzgado 021 Laboral", hot: true },
    { n: "Diana Marcela Ruiz", d: "Juzgado 014 Laboral" },
    { n: "Carlos Andrés Mora", d: "Juzgado 006 Laboral" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
        <FileText className="w-4 h-4 text-primary" /> Reparto <span className="text-muted-foreground font-normal">· 61 procesos</span>
      </div>
      <div className="space-y-2">
        {rows.map((r, k) => (
          <div key={k} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-semibold shrink-0", r.hot ? "bg-primary text-white border-primary ring-2 ring-[#6ea8e6]" : "border-primary text-primary")}>
              F. Conciliación
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{r.n}</p>
              <p className="text-[10px] text-muted-foreground truncate">{r.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Escena: Ingesta (sube PDF + progreso) ──
function EscIngesta() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
        <Upload className="w-4 h-4 text-primary" /> Ingesta y procesamiento
      </div>
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] p-4 flex flex-col items-center gap-2 text-center">
        <FileText className="w-7 h-7 text-primary" />
        <p className="text-xs font-medium text-foreground">Traslado de la demanda.pdf</p>
        <p className="text-[10px] text-muted-foreground">1.2 MB · subido</p>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Analizando…</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary animate-grow" />
        </div>
      </div>
    </div>
  );
}

// ── Escena: Ficha (llenado / riesgo) ──
function EscFicha({ riesgo }: { riesgo: boolean }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex items-center gap-1 flex-1 last:flex-none">
            <span className={cn("w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0",
              n <= 2 ? "bg-primary text-white" : n === 3 ? "bg-primary text-white ring-4 ring-primary/10" : "bg-muted text-muted-foreground border border-border")}>
              {n <= 2 ? <Check className="w-3 h-3" /> : n}
            </span>
            {n < 5 && <span className={cn("h-px flex-1", n < 3 ? "bg-primary/40" : "bg-border")} />}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
        <div className="px-3 py-2 bg-primary text-white text-[11px] font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Ficha de Conciliación
        </div>
        <div className="p-3 space-y-2.5">
          <SecOK label="Síntesis de los hechos" />
          <SecOK label="Pretensiones" />
          {riesgo ? (
            <>
              <SecOK label="Cuantía" valor="$ 6.664.086" />
              <div className="flex items-center gap-2 animate-fade-up">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="text-[11px] font-semibold text-foreground shrink-0">Riesgo</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">MEDIO ALTO</span>
              </div>
            </>
          ) : (
            <SecGen label="Cuantía" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Escena: Descarga (ficha lista + botón) ──
function EscDescarga({ descargado }: { descargado: boolean }) {
  return (
    <div className="h-full flex flex-col">
      <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
        <div className="px-3 py-2 bg-primary text-white text-[11px] font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Ficha de Conciliación</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-400/20 text-green-200 border border-green-300/30">
            <CheckCircle2 className="w-3 h-3" /> Lista
          </span>
        </div>
        <div className="p-3 space-y-2.5">
          <SecOK label="Síntesis de los hechos" />
          <SecOK label="Pretensiones" />
          <SecOK label="Cuantía" valor="$ 6.664.086" />
          <SecOK label="Recomendación" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between min-h-[36px]">
        {descargado ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 animate-fade-up">
            <CheckCircle2 className="w-4 h-4" /> PDF descargado
          </span>
        ) : <span />}
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-primary text-white transition-transform duration-150", descargado && "scale-95")}>
          <FileDown className="w-4 h-4" /> Descargar PDF
        </span>
      </div>
    </div>
  );
}

function SecOK({ label, valor }: { label: string; valor?: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
      <span className="text-[11px] font-semibold text-foreground shrink-0">{label}</span>
      {valor
        ? <span className="ml-auto text-[11px] font-semibold text-foreground tabular-nums">{valor}</span>
        : <div className="flex-1 h-1.5 rounded-full bg-foreground/10" />}
    </div>
  );
}
function SecGen({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
      <span className="text-[11px] font-semibold text-foreground shrink-0">{label}</span>
      <span className="inline-block w-[2px] h-3.5 bg-primary/70 align-middle animate-caret" aria-hidden />
      <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
    </div>
  );
}
