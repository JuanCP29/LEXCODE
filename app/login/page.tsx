"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FoqsLogo } from "@/components/ui/foqs-logo";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  FileSearch,
  Table2,
  PenLine,
} from "lucide-react";

const CAPACIDADES = [
  { icon: FileSearch, label: "Analiza\ndocumentos" },
  { icon: Table2, label: "Estructura\ninformación" },
  { icon: PenLine, label: "Genera\nborradores" },
  { icon: ShieldCheck, label: "Conexión\nsegura" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background overflow-hidden">
      {/* Ola navy decorativa (cresta vertical que sangra por la derecha) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block" aria-hidden>
        <div className="absolute top-1/2 -translate-y-1/2 right-[-25rem] w-[34rem] h-[54rem] rounded-full bg-primary" />
        <div className="absolute top-1/2 -translate-y-1/2 right-[-24.5rem] w-[34rem] h-[54rem] rounded-full ring-2 ring-[#35b9db]/30 blur-[2px]" />
      </div>

      {/* ── Panel izquierdo: marca ── */}
      <aside className="relative z-10 hidden lg:flex flex-col justify-between overflow-hidden px-12 xl:px-16 py-12">
        {/* Glows atmosféricos de marca */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-[#35b9db]/10 blur-3xl" />
          <div className="absolute bottom-0 -right-20 w-[30rem] h-[30rem] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <FoqsLogo size="lg" />
          <p className="mt-2 text-sm text-muted-foreground">
            Collegia Abogados — Cali, Colombia
          </p>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl xl:text-5xl font-serif font-bold tracking-tight leading-[1.1] text-foreground">
            Del expediente al{" "}
            <span className="text-[#2597c4]">documento</span>, en minutos.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Automatiza lo repetitivo. Conserva el criterio jurídico.
          </p>

          <div className="mt-10 grid grid-cols-4 gap-4 max-w-md">
            {CAPACIDADES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2.5">
                <span className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center card-shadow">
                  <Icon className="w-6 h-6 text-primary" />
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-pre-line leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10" />
      </aside>

      {/* ── Panel derecho: formulario ── */}
      <main className="relative z-10 flex flex-col items-center justify-center px-5 py-10">
        {/* Marca compacta (solo móvil) */}
        <div className="lg:hidden mb-8 flex flex-col items-center gap-1.5">
          <FoqsLogo size="lg" />
          <p className="text-sm text-muted-foreground">Collegia Abogados — Cali, Colombia</p>
        </div>

        <div className="relative w-full max-w-sm">
          {/* Glow cian detrás del recuadro */}
          <div className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-[#35b9db]/10 blur-2xl" aria-hidden />
          <div className="relative bg-gradient-to-b from-card to-[#f5f8fc] border border-border rounded-2xl card-shadow-md p-7 sm:p-8">
            {/* Escudo */}
            <div className="flex justify-center -mt-14 mb-4">
              <span className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center card-shadow">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-foreground">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ingresa con tu correo institucional
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="abogado@collegiaabogados.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="password"
                    type={verClave ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-11 rounded-lg border border-input bg-background pl-9 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {verClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    className="w-4 h-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Recordarme</span>
                </label>
                <Link
                  href="/recuperar-contrasena"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Conexión segura y encriptada · Tus datos están protegidos
          </p>
        </div>
      </main>
    </div>
  );
}
