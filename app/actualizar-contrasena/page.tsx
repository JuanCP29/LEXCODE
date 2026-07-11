"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthHeader } from "@/components/layout/auth-header";

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleActualizar(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
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
            <CardTitle className="text-white text-lg">Nueva contraseña</CardTitle>
            <CardDescription className="text-gray-400">
              Ingresa tu nueva contraseña
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActualizar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-[#0f1117] border-[#2d3148] text-white placeholder:text-gray-500 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmar" className="text-gray-300">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmar"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
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
                {loading ? "Actualizando..." : "Actualizar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
