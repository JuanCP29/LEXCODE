"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { FoqsLogo } from "@/components/ui/foqs-logo";
import { ArrowRight, Sparkles, CheckCircle2, FileText, ShieldCheck, Zap, Scale, Lightbulb } from "lucide-react";
import { DemoTour, ESCENAS } from "@/components/landing/demo-tour";

// Línea rotativa de capacidades bajo el texto principal.
const FRASES = [
  "Extrae los hechos y las pretensiones del traslado",
  "Asocia las pretensiones y arma tus documentos jurídicos",
];

// Ventajas (orden: Automatiza, Genera, Analiza, Acompaña, Evalúa).
const VENTAJAS = [
  { icon: Zap, titulo: "Automatiza", texto: "Lee los PDF y prellena las secciones." },
  { icon: FileText, titulo: "Genera", texto: "Ficha, poder y memoriales listos." },
  { icon: Lightbulb, titulo: "Analiza", texto: "Identifica el problema jurídico y sugiere." },
  { icon: Scale, titulo: "Acompaña", texto: "Optimiza tu criterio jurídico." },
  { icon: ShieldCheck, titulo: "Evalúa", texto: "Riesgo con base histórica real." },
];
// Escena del demo (0..4) ↔ ventaja resaltada, y ventaja → escena a la que salta al clic.
// Es una involución: [reparto→Automatiza, ingesta→Analiza, llenado→Genera, riesgo→Evalúa, descarga→Acompaña].
const MAPA = [0, 2, 1, 4, 3];

export function Landing() {
  const [frase, setFrase] = useState(0);
  const [escena, setEscena] = useState(0);

  // Línea rotativa.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const i = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 2600);
    return () => clearInterval(i);
  }, []);

  // Auto-avance del demo (se reinicia al saltar manualmente).
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setTimeout(() => setEscena((n) => (n + 1) % ESCENAS.length), ESCENAS[escena].dur);
    return () => clearTimeout(t);
  }, [escena]);

  const ventajaActiva = MAPA[escena];

  return (
    <main className="relative min-h-screen bg-[#0a1a30] text-[#eaf1f9] flex flex-col overflow-hidden">
      {/* Fondo atmosférico (glows de marca) */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute -top-40 -right-32 w-[40rem] h-[40rem] rounded-full bg-[#35b9db]/12 blur-3xl" />
        <div className="absolute top-1/3 -left-52 w-[34rem] h-[34rem] rounded-full bg-[#1e4a7a]/30 blur-3xl" />
      </div>

      {/* Barra superior */}
      <header className="relative z-10 w-full">
        <div className="max-w-6xl mx-auto px-6 py-7 flex items-center justify-between">
          <FoqsLogo size="lg" tone="dark" />
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
        <div className="max-w-6xl mx-auto px-6 w-full grid lg:grid-cols-[1.02fr_1fr] gap-12 lg:gap-16 items-center py-10">

          {/* Izquierda: mensaje */}
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#7fb7d6]">
              <Sparkles className="w-3.5 h-3.5 text-[#35b9db]" /> Inteligencia legal · Enfoque real
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-balance text-white">
              Del expediente al <span className="text-[#35b9db]">documento</span>, en minutos.
            </h1>
            <p className="mt-5 text-lg text-[#9db2cc] max-w-lg leading-relaxed">
              La IA que lee el expediente y arma tus documentos jurídicos.
            </p>

            {/* Línea rotativa de capacidades */}
            <div className="mt-3 h-6 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#35b9db] shrink-0" />
              <span key={frase} className="text-[#cdd9e8] animate-fade-up">
                {FRASES[frase]}
              </span>
            </div>

            <div className="mt-8">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#35b9db] text-[#08131f] text-sm font-semibold hover:bg-[#54c6e6] active:scale-[0.98] transition-all shadow-[0_8px_28px_-8px_rgba(53,185,219,.55)] hover:shadow-[0_12px_38px_-8px_rgba(53,185,219,.75)]"
              >
                Ingresar
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Ventajas — estados interactivos sincronizados con el demo */}
            <div className="mt-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 max-w-3xl">
              {VENTAJAS.map((v, idx) => (
                <Ventaja
                  key={v.titulo}
                  icon={v.icon}
                  titulo={v.titulo}
                  texto={v.texto}
                  activo={ventajaActiva === idx}
                  onClick={() => setEscena(MAPA[idx])}
                />
              ))}
            </div>

          </div>

          {/* Derecha: demo animada de la app (controlada por las ventajas) */}
          <DemoTour escena={escena} onSelect={setEscena} />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-[#6b7f9c]">
          © {new Date().getFullYear()} Collegia Abogados — Cali, Colombia. Uso interno.
        </div>
      </footer>
    </main>
  );
}

function Ventaja({ icon: Icon, titulo, texto, activo, onClick }: {
  icon: React.ElementType; titulo: string; texto: string; activo?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl p-3 border transition-all duration-300",
        activo
          ? "border-[#35b9db]/50 bg-[#35b9db]/10 -translate-y-0.5 shadow-[0_10px_30px_-12px_rgba(53,185,219,.5)]"
          : "border-transparent hover:border-white/10 hover:bg-white/[0.03] hover:-translate-y-0.5"
      )}
    >
      <span className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
        activo ? "bg-[#35b9db] border-[#35b9db]" : "bg-[#35b9db]/12 border-[#35b9db]/20"
      )}>
        <Icon className={cn("w-4 h-4", activo ? "text-[#08131f]" : "text-[#35b9db]")} />
      </span>
      <p className="text-sm font-semibold text-white mt-2">{titulo}</p>
      <p className="text-xs text-[#8ea2bd] leading-snug mt-0.5">{texto}</p>
    </button>
  );
}
