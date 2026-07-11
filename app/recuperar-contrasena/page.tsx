"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthHeader } from "@/components/layout/auth-header";
import { ArrowLeft } from "lucide-react";

export default function RecuperarContrasenaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-contrasena`,
    });

    if (error) {
      setError("No se pudo enviar el correo. Verifica la dirección ingresada.");
      setLoading(false);
      return;
    }

    setEnviado(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-sm px-4">
        <AuthHeader subtitulo="Collegia Abogados — Cali, Colombia" />

        <Card className="bg-[#1a1d27] border-[#2d3148]">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Recuperar contraseña</CardTitle>
            <CardDescription className="text-gray-400">
              Te enviaremos un enlace para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enviado ? (
              <div className="space-y-4">
                <p className="text-sm text-green-400 bg-green-950/30 border border-green-900/50 rounded-md px-3 py-3">
                  Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-[#2d3148] text-gray-300 hover:text-white hover:bg-[#2d3148]">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver al login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleRecuperar} className="space-y-4">
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

                {error && (
                  <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                </Button>

                <Link href="/login">
                  <Button variant="ghost" className="w-full text-gray-400 hover:text-white mt-1">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver al login
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
