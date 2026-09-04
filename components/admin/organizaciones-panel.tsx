"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, UserPlus, Mail, CheckCircle2, AlertCircle, Users, Copy, Check, KeyRound } from "lucide-react";
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
  const [cred, setCred] = useState<{ org: string; email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agregar coordinador a una organización existente
  const [addTo, setAddTo] = useState<string | null>(null);
  const [addNombre, setAddNombre] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addCred, setAddCred] = useState<{ org: string; email: string; password: string } | null>(null);

  async function agregarCoord(e: React.FormEvent, org: Org) {
    e.preventDefault();
    setAddBusy(true);
    setAddError(null);
    setAddCred(null);
    try {
      const res = await fetch("/api/admin/organizaciones/coordinador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id, nombre: addNombre, email: addEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al agregar");
      setAddCred({ org: org.nombre, email: addEmail, password: body.coordinador.password });
      setAddNombre(""); setAddEmail("");
      cargar();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Error al agregar");
    } finally {
      setAddBusy(false);
    }
  }

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
    setCred(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/organizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, coordinador_nombre: coordNombre, coordinador_email: coordEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      setCred({ org: body.organizacion.nombre, email: coordEmail, password: body.coordinador.password });
      setNombre(""); setCoordNombre(""); setCoordEmail("");
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
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
              <Campo label="Correo del coordinador">
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
          {cred && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 space-y-2">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Organización “{cred.org}” creada
              </p>
              <p className="text-[11px] text-muted-foreground">
                Comparte estas credenciales con el Coordinador. Entrará en <strong>Iniciar sesión</strong> y podrá cambiar la contraseña en Configuración.
              </p>
              <div className="rounded-md border border-border bg-card p-2.5 text-xs font-mono space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Correo</span>
                  <span className="text-foreground truncate">{cred.email}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1"><KeyRound className="w-3 h-3" /> Clave</span>
                  <span className="text-foreground font-semibold">{cred.password}</span>
                </div>
              </div>
              <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink hover:underline">
                {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar credenciales</>}
              </button>
            </div>
          )}

          <button type="submit" disabled={enviando}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {enviando ? <><FoqsLoader size="sm" /> Creando…</> : <><UserPlus className="w-4 h-4" /> Crear coordinador</>}
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
            {orgs.map((o) => {
              const tieneCoord = o.usuarios.some((u) => u.rol === "coordinador" || u.rol === "admin");
              const abierto = addTo === o.id;
              return (
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

                {/* Agregar coordinador a esta organización existente */}
                <div className="mt-2.5 pt-2.5 border-t border-border/70">
                  {!abierto ? (
                    <button
                      type="button"
                      onClick={() => { setAddTo(o.id); setAddError(null); setAddCred(null); setAddNombre(""); setAddEmail(""); }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink hover:underline"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {tieneCoord ? "Agregar otro coordinador" : "Agregar coordinador"}
                    </button>
                  ) : (
                    <form onSubmit={(e) => agregarCoord(e, o)} className="space-y-2">
                      <input value={addNombre} onChange={(e) => setAddNombre(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} type="email" required
                          placeholder="coordinador@cliente.com"
                          className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring/50" />
                      </div>
                      {addError && (
                        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2.5 py-1.5 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {addError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={addBusy}
                          className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 inline-flex items-center gap-1.5">
                          {addBusy ? <><FoqsLoader size="sm" /> Creando…</> : <><UserPlus className="w-3.5 h-3.5" /> Crear</>}
                        </button>
                        <button type="button" onClick={() => { setAddTo(null); setAddError(null); }}
                          className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {addCred && addCred.org === o.nombre && (
                    <div className="mt-2 rounded-lg border border-green-500/40 bg-green-500/10 p-2.5 space-y-1.5">
                      <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Coordinador creado en “{addCred.org}”
                      </p>
                      <div className="rounded-md border border-border bg-card p-2 text-[11px] font-mono space-y-1">
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Correo</span><span className="text-foreground truncate">{addCred.email}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground flex items-center gap-1"><KeyRound className="w-3 h-3" /> Clave</span><span className="text-foreground font-semibold">{addCred.password}</span></div>
                      </div>
                      <button type="button"
                        onClick={() => navigator.clipboard?.writeText(`Correo: ${addCred.email}\nContraseña temporal: ${addCred.password}\nEntra en la app y cámbiala en Configuración.`)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink hover:underline">
                        <Copy className="w-3 h-3" /> Copiar credenciales
                      </button>
                    </div>
                  )}
                </div>
              </li>
              );
            })}
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
