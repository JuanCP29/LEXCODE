"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export function CambiarContrasena() {
  const supabase = createClient();
  const [pass, setPass] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (pass !== conf) return setErr("Las contraseñas no coinciden.");
    if (pass.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) setErr("No se pudo actualizar la contraseña. Intenta de nuevo.");
    else { setMsg("Contraseña actualizada."); setPass(""); setConf(""); }
    setLoading(false);
  }

  return (
    <div className="bg-card rounded-xl border border-border card-shadow p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Cambiar contraseña</h2>
          <p className="text-[11px] text-muted-foreground">Si entraste con una clave temporal, cámbiala aquí.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required placeholder="Mínimo 8 caracteres"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Confirmar contraseña</label>
          <input type="password" value={conf} onChange={(e) => setConf(e.target.value)} required placeholder="Repite la contraseña"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>

        {err && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {err}</p>}
        {msg && <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {msg}</p>}

        <button type="submit" disabled={loading}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60">
          {loading ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </form>
    </div>
  );
}
