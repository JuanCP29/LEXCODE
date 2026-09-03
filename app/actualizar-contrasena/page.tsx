"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FoqsLogo } from "@/components/ui/foqs-logo";
import { Lock, AlertCircle, ArrowRight } from "lucide-react";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [loading, setLoading] = useState(false);

  // Si el enlace trae un error en el hash (#error=...&error_code=otp_expired), avísalo.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error")) {
      const p = new URLSearchParams(hash.replace(/^#/, ""));
      const code = p.get("error_code");
      if (code === "otp_expired" || p.get("error")) {
        setEnlaceInvalido(true);
        setError("El enlace de invitación es inválido o ya expiró. Pide una nueva invitación.");
      }
    }
  }, []);

  async function handleActualizar(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");

    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("No se pudo actualizar la contraseña. Es posible que el enlace haya expirado; pide una nueva invitación.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <FoqsLogo size="lg" />
          <p className="text-sm text-muted-foreground">Collegia Abogados — Cali, Colombia</p>
        </div>

        <div className="bg-card border border-border rounded-2xl card-shadow-md p-7 sm:p-8">
          <div className="flex justify-center -mt-14 mb-4">
            <span className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center card-shadow">
              <Lock className="w-6 h-6 text-primary" />
            </span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-serif font-bold text-foreground">Define tu contraseña</h2>
            <p className="mt-1 text-sm text-muted-foreground">Crea la contraseña de tu cuenta</p>
          </div>

          {enlaceInvalido ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-3 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
              <p className="text-xs text-muted-foreground">
                Contacta a quien te invitó para reenviar la invitación, o vuelve a iniciar sesión.
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Ir a iniciar sesión <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleActualizar} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Nueva contraseña</label>
                <input
                  id="password" type="password" placeholder="Mínimo 8 caracteres"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmar" className="text-sm font-medium text-foreground">Confirmar contraseña</label>
                <input
                  id="confirmar" type="password" placeholder="Repite la contraseña"
                  value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required
                  className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60">
                {loading ? "Actualizando…" : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
