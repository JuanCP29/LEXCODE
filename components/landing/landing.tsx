"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FoqsLogo } from "@/components/ui/foqs-logo";
import { ArrowRight, Sparkles, CheckCircle2, FileText, ShieldCheck, Zap, Scale, Lightbulb } from "lucide-react";
import { DemoTour } from "@/components/landing/demo-tour";

// Línea rotativa de capacidades bajo el texto principal.
const FRASES = [
  "Extrae los hechos y las pretensiones del traslado",
  "Asocia las pretensiones y arma tus documentos jurídicos",
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
    <main className="relative min-h-screen bg-[#0a1a30] text-[#eaf1f9] flex flex-col overflow-hidden">
      {/* Fondo atmosférico (glows de marca) */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute -top-40 -right-32 w-[40rem] h-[40rem] rounded-full bg-[#35b9db]/12 blur-3xl" />
        <div className="absolute top-1/3 -left-52 w-[34rem] h-[34rem] rounded-full bg-[#1e4a7a]/30 blur-3xl" />
      </div>

      {/* Barra superior mínima */}
      <header className="relative z-10 w-full">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <FoqsLogo size="md" tone="dark" />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#35b9db] hover:underline"
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
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#7fb7d6]">
              <Sparkles className="w-3.5 h-3.5 text-[#35b9db]" /> Inteligencia legal · Enfoque real
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-balance text-white">
              Del expediente al <span className="text-[#35b9db]">documento</span>, en minutos.
            </h1>
            <p className="mt-5 text-lg text-[#9db2cc] max-w-xl leading-relaxed">
              FoQs lee el traslado, extrae los hechos y las pretensiones, asocia las pretensiones
              y arma tus documentos jurídicos automatizados. Menos digitación, más criterio.
            </p>

            {/* Línea rotativa de capacidades */}
            <div className="mt-4 h-6 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#35b9db] shrink-0" />
              <span key={frase} className="text-[#cdd9e8] animate-fade-up">
                {FRASES[frase]}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#35b9db] text-[#08131f] text-sm font-semibold hover:bg-[#54c6e6] active:scale-[0.98] transition-all shadow-[0_8px_28px_-8px_rgba(53,185,219,.55)]"
              >
                Ingresar <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Ventajas */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-3xl">
              <Ventaja icon={Zap} titulo="Automatiza" texto="Lee los PDF y prellena las secciones." />
              <Ventaja icon={FileText} titulo="Genera" texto="Ficha, poder y memoriales listos." />
              <Ventaja icon={Lightbulb} titulo="Analiza" texto="Identifica el problema jurídico y sugiere." />
              <Ventaja icon={Scale} titulo="Acompaña" texto="Optimiza tu criterio jurídico." />
              <Ventaja icon={ShieldCheck} titulo="Evalúa" texto="Riesgo con base histórica real." />
            </div>

          </div>

          {/* Derecha: mini-tour de la app (Asignaciones · Reparto · Ficha) */}
          <DemoTour />
        </div>
      </section>

      <footer className="relative z-10 max-w-6xl mx-auto px-6 py-6 text-xs text-[#5f7592]">
        © {new Date().getFullYear()} Collegia Abogados — Cali, Colombia. Uso interno.
      </footer>
    </main>
  );
}

function Ventaja({ icon: Icon, titulo, texto }: { icon: React.ElementType; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="w-8 h-8 rounded-lg bg-[#35b9db]/12 border border-[#35b9db]/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#35b9db]" />
      </span>
      <p className="text-sm font-semibold text-white">{titulo}</p>
      <p className="text-xs text-[#8ea2bd] leading-snug">{texto}</p>
    </div>
  );
}
