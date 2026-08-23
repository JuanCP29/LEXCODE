"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ArrowRight, Sparkles, CheckCircle2, FileText, ShieldCheck, Zap } from "lucide-react";
import { DemoTour } from "@/components/landing/demo-tour";

// Línea rotativa de capacidades bajo el texto principal.
const FRASES = [
  "Extrae los hechos y las pretensiones del traslado",
  "Calcula el riesgo procesal del caso",
  "Genera la ficha, el poder y los memoriales",
];

export function Landing() {
  const [frase, setFrase] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const i = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 2600);
    return () => clearInterval(i);
  }, []);

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
              Del expediente al <span className="text-primary">documento</span>, en minutos.
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

          </div>

          {/* Derecha: mini-tour de la app (Asignaciones · Reparto · Ficha) */}
          <DemoTour />
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
