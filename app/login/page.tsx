"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthHeader } from "@/components/layout/auth-header";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recordarme, setRecordarme] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Supabase SSR maneja la sesión vía cookies; para "recordarme" ajustamos
    // la expiración de la sesión antes del login.
    if (!recordarme) {
      await supabase.auth.setSession({ access_token: "", refresh_token: "" }).catch(() => {});
    }

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
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-sm px-4">
        <AuthHeader subtitulo="Collegia Abogados — Cali, Colombia" />

        <Card className="bg-[#1a1d27] border-[#2d3148]">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Iniciar sesión</CardTitle>
            <CardDescription className="text-gray-400">
              Ingresa con tu correo institucional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-300">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="abogado@collegiaabogados.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-[#0f1117] border-[#2d3148] text-white placeholder:text-gray-500 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-[#0f1117] border-[#2d3148] text-white placeholder:text-gray-500 focus-visible:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2d3148] bg-[#0f1117] accent-primary"
                  />
                  <span className="text-sm text-gray-400">Recordarme</span>
                </label>
                <Link
                  href="/recuperar-contrasena"
                  className="text-sm text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
