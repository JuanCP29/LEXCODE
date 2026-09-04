"use client";

import { useEffect, useState, useCallback } from "react";
import { UserPlus, Mail, CheckCircle2, AlertCircle, Users, Copy, Check, KeyRound, Scale, Shield } from "lucide-react";
import { FoqsLoader } from "@/components/ui/foqs-loader";
import { cn } from "@/lib/utils";

type Usuario = { id: string; nombre: string | null; email: string | null; rol: string; rolLabel: string; activo: boolean };

export function EquipoPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"sustanciador" | "coordinador">("sustanciador");
  const [enviando, setEnviando] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string; rolLabel: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/equipo");
      const body = await res.json();
      setUsuarios(body.usuarios ?? []);
    } catch {
      setError("No se pudo cargar el equipo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setCred(null); setError(null);
    try {
      const res = await fetch("/api/equipo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, rol }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      setCred({ email, password: body.usuario.password, rolLabel: rol === "coordinador" ? "Coordinador" : "Abogado sustanciador" });
      setNombre(""); setEmail(""); setRol("sustanciador");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    if (!cred) return;
    try {
      await navigator.clipboard.writeText(`Correo: ${cred.email}\nContraseña temporal: ${cred.password}\nEntra en la app y cámbiala en Configuración.`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* noop */ }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start">
      {/* Formulario: nuevo usuario */}
      <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Nuevo usuario</h2>
            <p className="text-[11px] text-muted-foreground">Se crea con una contraseña temporal</p>
          </div>
        </div>

        <form onSubmit={crear} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nombre completo</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Andrés Rojas"
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Correo</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="abogado@cliente.com"
                className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "sustanciador", label: "Abogado sustanciador", Icon: Scale },
                { v: "coordinador", label: "Coordinador", Icon: Shield },
              ] as const).map(({ v, label, Icon }) => (
                <button key={v} type="button" onClick={() => setRol(v)}
                  className={cn("flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all",
                    rol === v ? "border-brand/50 bg-brand-subtle/60" : "border-border hover:border-brand/30")}>
                  <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    rol === v ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </p>
          )}
          {cred && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 space-y-2">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {cred.rolLabel} creado
              </p>
              <p className="text-[11px] text-muted-foreground">
                Comparte estas credenciales. Entrará en <strong>Iniciar sesión</strong> y cambiará la contraseña en Configuración.
              </p>
              <div className="rounded-md border border-border bg-card p-2.5 text-xs font-mono space-y-1">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Correo</span><span className="text-foreground truncate">{cred.email}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground flex items-center gap-1"><KeyRound className="w-3 h-3" /> Clave</span><span className="text-foreground font-semibold">{cred.password}</span></div>
              </div>
              <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink hover:underline">
                {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar credenciales</>}
              </button>
            </div>
          )}

          <button type="submit" disabled={enviando}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {enviando ? <><FoqsLoader size="sm" /> Creando…</> : <><UserPlus className="w-4 h-4" /> Crear usuario</>}
          </button>
        </form>
      </section>

      {/* Lista del equipo */}
      <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Users className="w-5 h-5 text-brand-ink" />
          <h2 className="text-base font-semibold text-foreground">Equipo ({usuarios.length})</h2>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><FoqsLoader size="sm" /> Cargando…</div>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Aún no hay usuarios. Crea el primero con el formulario.</p>
        ) : (
          <ul className="divide-y divide-border">
            {usuarios.map((u) => {
              const esCoord = u.rol === "coordinador" || u.rol === "admin" || u.rol === "superadmin";
              return (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    esCoord ? "bg-brand-subtle text-brand-ink" : "bg-muted text-muted-foreground")}>
                    {esCoord ? <Shield className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nombre || u.email || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
                    esCoord ? "bg-brand-subtle text-brand-ink border-brand/20" : "bg-muted text-muted-foreground border-border")}>
                    {u.rolLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
