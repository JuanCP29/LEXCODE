"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, UserPlus, Mail, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { FoqsLoader } from "@/components/ui/foqs-loader";
import { cn } from "@/lib/utils";

type Usuario = { nombre_completo: string | null; rol: string; activo: boolean };
type Org = { id: string; nombre: string; creado_at: string; usuarios: Usuario[] };

const ROL_LABEL: Record<string, string> = {
  superadmin: "Propietario",
  coordinador: "Coordinador",
  sustanciador: "Abogado sustanciador",
  admin: "Coordinador",
  abogado: "Abogado sustanciador",
  asistente: "Abogado sustanciador",
  revisor: "Abogado sustanciador",
};

export function OrganizacionesPanel() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [coordNombre, setCoordNombre] = useState("");
  const [coordEmail, setCoordEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/organizaciones");
      const body = await res.json();
      setOrgs(body.organizaciones ?? []);
    } catch {
      setError("No se pudo cargar la lista.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/organizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, coordinador_nombre: coordNombre, coordinador_email: coordEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      setMsg(`Organización "${body.organizacion.nombre}" creada. Se envió invitación a ${coordEmail}.`);
      setNombre(""); setCoordNombre(""); setCoordEmail("");
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start">
      {/* Formulario: nueva organización + coordinador */}
      <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Nueva organización</h2>
            <p className="text-[11px] text-muted-foreground">Crea el cliente e invita a su Coordinador</p>
          </div>
        </div>

        <form onSubmit={crear} className="space-y-4">
          <Campo label="Nombre de la organización">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              placeholder="Ej: Bufete Ramírez & Asociados"
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
          </Campo>

          <div className="pt-2 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Primer Coordinador
            </p>
            <div className="space-y-4">
              <Campo label="Nombre completo">
                <input value={coordNombre} onChange={(e) => setCoordNombre(e.target.value)}
                  placeholder="Ej: Laura Ramírez"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
              </Campo>
              <Campo label="Correo (se enviará la invitación)">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={coordEmail} onChange={(e) => setCoordEmail(e.target.value)} type="email" required
                    placeholder="coordinador@cliente.com"
                    className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
                </div>
              </Campo>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </p>
          )}
          {msg && (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {msg}
            </p>
          )}

          <button type="submit" disabled={enviando}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {enviando ? <><FoqsLoader size="sm" /> Creando e invitando…</> : <><UserPlus className="w-4 h-4" /> Crear e invitar</>}
          </button>
        </form>
      </section>

      {/* Lista de organizaciones */}
      <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Users className="w-5 h-5 text-brand-ink" />
          <h2 className="text-base font-semibold text-foreground">Organizaciones ({orgs.length})</h2>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><FoqsLoader size="sm" /> Cargando…</div>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Aún no hay organizaciones. Crea la primera con el formulario.</p>
        ) : (
          <ul className="space-y-2.5">
            {orgs.map((o) => (
              <li key={o.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{o.nombre}</p>
                  <span className="text-[11px] text-muted-foreground">{o.usuarios.length} usuario{o.usuarios.length !== 1 ? "s" : ""}</span>
                </div>
                {o.usuarios.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.usuarios.map((u, i) => (
                      <span key={i} className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                        u.rol === "coordinador" || u.rol === "admin"
                          ? "bg-brand-subtle text-brand-ink border-brand/20"
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        {u.nombre_completo || "—"} · {ROL_LABEL[u.rol] ?? u.rol}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
