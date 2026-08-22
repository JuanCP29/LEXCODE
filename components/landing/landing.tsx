"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ArrowRight, Sparkles, CheckCircle2, FileText, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// Secciones que el "documento" va generando en el bucle de la animación.
const SECCIONES = [
  { label: "Síntesis de los hechos", lineas: [92, 84, 66] },
  { label: "Pretensiones", lineas: [88, 60] },
  { label: "Cuantía", lineas: [48], valor: "$ 6.664.086" },
  { label: "Evaluación del riesgo", badge: "MEDIO ALTO" },
];
const TOTAL = SECCIONES.length + 1; // +1 para el estado final "Ficha lista"

// Línea rotativa de capacidades bajo el texto principal.
const FRASES = [
  "Extrae los hechos y las pretensiones del traslado",
  "Calcula el riesgo con base en 627.775 casos",
  "Genera la ficha, el poder y los memoriales",
];

export function Landing() {
  // step 0 = analizando; 1..N = revela sección n-1; TOTAL = ficha lista; luego reinicia.
  const [step, setStep] = useState(0);
  const [frase, setFrase] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStep(TOTAL); return; }
    const dur = [1200, 850, 850, 850, 850, 2400];
    let t: ReturnType<typeof setTimeout>;
    const tick = (s: number) => {
      setStep(s);
      const next = s >= TOTAL ? 0 : s + 1;
      t = setTimeout(() => tick(next), dur[Math.min(s, dur.length - 1)]);
    };
    tick(0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const i = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 2600);
    return () => clearInterval(i);
  }, []);

  const listo = step >= TOTAL;

  return (
    <main className="relative min-h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Fondo atmosférico (glows suaves) */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute -top-40 -right-32 w-[38rem] h-[38rem] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute top-1/3 -left-48 w-[32rem] h-[32rem] rounded-full bg-[#6ea8e6]/10 blur-3xl" />
      </div>

      {/* Barra superior mínima */}
      <header className="relative z-10 w-full">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Logo size="md" />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Ingresar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Héroe */}
      <section className="relative z-10 flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 w-full grid lg:grid-cols-[1.02fr_1fr] gap-12 lg:gap-16 items-center py-12">

          {/* Izquierda: mensaje */}
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary/70">
              <Sparkles className="w-3.5 h-3.5" /> Collegia Abogados · LEGIUX
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-balance">
              De los documentos del proceso a la <span className="text-primary">ficha lista</span>, en minutos.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
              LEGIUX lee el traslado, extrae los hechos y las pretensiones, calcula el riesgo
              y arma tus documentos jurídicos automatizados. Menos digitación, más criterio.
            </p>

            {/* Línea rotativa de capacidades */}
            <div className="mt-4 h-6 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span key={frase} className="text-foreground/80 animate-fade-up">
                {FRASES[frase]}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all card-shadow"
              >
                Ingresar <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Ventajas */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
              <Ventaja icon={Zap} titulo="Automatiza" texto="Lee los PDF y prellena las secciones." />
              <Ventaja icon={FileText} titulo="Genera" texto="Ficha, poder y memoriales listos." />
              <Ventaja icon={ShieldCheck} titulo="Evalúa" texto="Riesgo con base histórica real." />
            </div>

            {/* Métricas / prueba social */}
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm border-t border-border pt-6 max-w-xl">
              <span className="flex items-baseline gap-1.5">
                <b className="text-foreground text-lg tabular-nums">627.775</b>
                <span className="text-muted-foreground">casos en la base de riesgo</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-baseline gap-1.5">
                <b className="text-foreground text-lg tabular-nums">3</b>
                <span className="text-muted-foreground">documentos automatizados</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-baseline gap-1.5">
                <b className="text-foreground text-lg">v3</b>
                <span className="text-muted-foreground">formato oficial Colpensiones</span>
              </span>
            </div>
          </div>

          {/* Derecha: documento que se auto-ensambla */}
          <div className="relative">
            {/* halo suave detrás */}
            <div className="absolute -inset-6 rounded-[2rem] bg-primary/5 blur-2xl" aria-hidden />
            <div className="relative bg-card border border-border rounded-2xl card-shadow-md overflow-hidden">
              {/* Encabezado del documento */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-primary text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 ring-2 ring-[#6ea8e6]">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm font-semibold truncate">Ficha de Conciliación</span>
                </div>
                {listo ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-green-400/20 text-green-200 border border-green-300/30">
                    <CheckCircle2 className="w-3 h-3" /> Lista
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/15 text-white/90 border border-white/20">
                    <Sparkles className="w-3 h-3 animate-pulse" /> IA
                  </span>
                )}
              </div>

              {/* Cuerpo: secciones */}
              <div className="p-5 space-y-4 bg-primary/[0.04]">
                {SECCIONES.map((sec, i) => {
                  const revelada = step > i;
                  const activa = step === i + 1; // recién generada (muestra el cursor)
                  return (
                    <div
                      key={sec.label}
                      className={cn(
                        "rounded-xl border bg-card p-3.5 transition-all duration-500",
                        activa && "ring-2 ring-primary/15",
                        revelada ? "opacity-100 translate-y-0 border-border" : "opacity-55 translate-y-1 border-dashed border-border"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">{sec.label}</span>
                        {revelada
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          : <span className="w-3.5 h-3.5 rounded-full bg-muted animate-pulse shrink-0" />}
                      </div>

                      {sec.badge ? (
                        revelada
                          ? <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">{sec.badge}</span>
                          : <span className="inline-block h-4 w-24 rounded bg-muted animate-pulse" />
                      ) : (
                        <div className="space-y-1.5">
                          {(sec.lineas ?? []).map((w, k) => (
                            <div
                              key={k}
                              className={cn(
                                "h-2 rounded-full transition-colors duration-500",
                                revelada ? "bg-foreground/15" : "bg-muted animate-pulse"
                              )}
                              style={{ width: `${w}%` }}
                            />
                          ))}
                          {sec.valor && (
                            <p className={cn("pt-1 text-sm font-semibold tabular-nums transition-opacity duration-500", revelada ? "opacity-100 text-foreground" : "opacity-0")}>
                              {sec.valor}
                            </p>
                          )}
                          {activa && <span className="inline-block w-[2px] h-3.5 bg-primary/70 align-middle animate-caret" aria-hidden />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pie: estado */}
              <div className="px-5 py-3 border-t border-border bg-card flex items-center gap-2 text-xs">
                {listo ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Ficha generada — lista para revisar y descargar
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    {step === 0 ? "Analizando el traslado de la demanda…" : "Generando las secciones de la ficha…"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Collegia Abogados — Cali, Colombia. Uso interno.
      </footer>
    </main>
  );
}

function Ventaja({ icon: Icon, titulo, texto }: { icon: React.ElementType; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="w-8 h-8 rounded-lg bg-primary-subtle flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </span>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="text-xs text-muted-foreground leading-snug">{texto}</p>
    </div>
  );
}
