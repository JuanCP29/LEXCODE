"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, CheckCircle2, Users, ListChecks, MousePointer2, Loader2, Check } from "lucide-react";

const PASOS = [
  { k: "Asignaciones", d: "Asigna los casos al equipo" },
  { k: "Reparto", d: "Abre la ficha desde el caso" },
  { k: "Generar ficha", d: "La IA arma la ficha" },
];

export function DemoTour() {
  const [scr, setScr] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setScr(1); return; }
    const i = setInterval(() => setScr((s) => (s + 1) % PASOS.length), 3200);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/5 blur-2xl" aria-hidden />

      {/* Ventana de la app */}
      <div className="relative bg-card border border-border rounded-2xl card-shadow-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-10 bg-primary text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="ml-3 text-[11px] font-semibold text-white/90">LEGIUX · {PASOS[scr].k}</span>
        </div>
        <div className="relative h-[320px] bg-primary/[0.04]">
          <div key={scr} className="absolute inset-0 p-4 animate-fade-up">
            {scr === 0 && <PantallaAsignaciones />}
            {scr === 1 && <PantallaReparto />}
            {scr === 2 && <PantallaFicha />}
          </div>
        </div>
      </div>

      {/* Pasos (clicables) */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {PASOS.map((p, i) => (
          <button
            key={p.k}
            type="button"
            onClick={() => setScr(i)}
            className={cn(
              "text-left rounded-lg border px-3 py-2 transition-all",
              i === scr ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0", i === scr ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              <span className={cn("text-xs font-semibold truncate", i === scr ? "text-foreground" : "text-muted-foreground")}>{p.k}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{p.d}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pantalla 1: Asignaciones ──
function PantallaAsignaciones() {
  const rows = [
    { n: "Jose Leoncio Garces Valencia", c: "16472041", sel: true },
    { n: "Nelsy Medina Hernández", c: "1113625225", sel: true },
    { n: "Gilma Elsa Díaz García", c: "20677554", sel: false },
    { n: "Alberto Lora Valencia", c: "10539081", sel: false },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ListChecks className="w-4 h-4 text-primary" /> Asignaciones
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary text-white">
          <Users className="w-3 h-3" /> Asignar a Camila
        </span>
      </div>
      <div className="space-y-1.5 flex-1">
        {rows.map((r) => (
          <div key={r.c} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors", r.sel ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-card")}>
            <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", r.sel ? "bg-primary border-primary" : "border-input")}>
              {r.sel && <Check className="w-3 h-3 text-white" />}
            </span>
            <span className="text-xs font-medium text-foreground flex-1 truncate">{r.n}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{r.c}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> 2 casos asignados a Camila C.
      </div>
    </div>
  );
}

// ── Pantalla 2: Reparto ──
function PantallaReparto() {
  const rows = [
    { n: "Carlos J. Arias Caicedo", d: "Juzgado 021 Laboral", est: "proc", hot: true },
    { n: "Wilson Lugo", d: "Juzgado 021 Laboral", est: "proc" },
    { n: "Rocío Daza Ussa", d: "Juzgado 021 Laboral", est: "pend" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
        <FileText className="w-4 h-4 text-primary" /> Reparto <span className="text-muted-foreground font-normal">· 61 procesos</span>
      </div>
      <div className="space-y-2 flex-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
            <span className={cn("relative inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-semibold shrink-0", r.hot ? "bg-primary text-white border-primary ring-2 ring-[#6ea8e6]" : "border-primary text-primary")}>
              F. Conciliación
              {r.hot && <MousePointer2 className="absolute -right-3.5 -bottom-3 w-4 h-4 text-primary fill-white drop-shadow" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{r.n}</p>
              <p className="text-[10px] text-muted-foreground truncate">{r.d}</p>
            </div>
            <PillEstado est={r.est} />
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Un clic en <b className="text-foreground">F. Conciliación</b> abre el generador →
      </div>
    </div>
  );
}

function PillEstado({ est }: { est: string }) {
  const [txt, cls] =
    est === "proc"
      ? ["En proceso", "bg-amber-50 text-amber-700 border-amber-200"]
      : ["Pendiente", "bg-blue-50 text-blue-700 border-blue-200"];
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", cls)}>{txt}</span>;
}

// ── Pantalla 3: Ficha generándose ──
function PantallaFicha() {
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
          <SecGen label="Cuantía" />
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Generando la ficha…
      </div>
    </div>
  );
}

function SecOK({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
      <span className="text-[11px] font-semibold text-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-foreground/10" />
    </div>
  );
}
function SecGen({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
      <span className="text-[11px] font-semibold text-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
    </div>
  );
}
