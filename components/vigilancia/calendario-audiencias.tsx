"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock, Video, MapPin,
  CircleHelp, Sparkles, Hand,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#35b9db";
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export type Audiencia = {
  id: string;
  fecha: string | null;
  tipo: string | null;
  despacho: string | null;
  enlace: string | null;
  notas: string | null;
  origen: string;
  estado: string;
  proceso_id: string;
  radicado: string;
  sujetos: string | null;
};

const keyLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function fmtRadicado(r: string): string {
  return r.length === 23 ? `${r.slice(0, 5)}-${r.slice(5, 7)}-${r.slice(7, 9)}-${r.slice(9, 12)}-${r.slice(12)}` : r;
}
function fmtHora(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  if (h === 0 && m === 0) return "—";
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
function fmtFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function CalendarioAudiencias({ iniciales }: { iniciales: Audiencia[] }) {
  const router = useRouter();
  const hoy = new Date();
  const [cursor, setCursor] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [sel, setSel] = useState<string | null>(keyLocal(hoy));

  // Solo relacionamos audiencias de HOY y PRÓXIMAS (las pasadas no se muestran).
  const inicioHoyTs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const visibles = useMemo(
    () => iniciales.filter((a) => !a.fecha || new Date(a.fecha).getTime() >= inicioHoyTs),
    [iniciales, inicioHoyTs]
  );

  const porDia = useMemo(() => {
    const map = new Map<string, Audiencia[]>();
    for (const a of visibles) {
      if (!a.fecha) continue;
      const k = keyLocal(new Date(a.fecha));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return map;
  }, [visibles]);

  const porConfirmar = visibles.filter((a) => !a.fecha && a.estado !== "cancelada");
  const proximas = visibles
    .filter((a) => a.fecha && a.estado !== "cancelada")
    .sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime())
    .slice(0, 6);

  // Matriz del mes (semana inicia lunes)
  const celdas = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const dias = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= dias; d++) out.push(new Date(cursor.y, cursor.m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const mover = (delta: number) => {
    const nm = cursor.m + delta;
    setCursor({ y: cursor.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
  };

  const delDia = sel ? porDia.get(sel) ?? [] : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Calendario */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {MESES[cursor.m]} {cursor.y}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setCursor({ y: hoy.getFullYear(), m: hoy.getMonth() }); setSel(keyLocal(hoy)); }}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={() => mover(-1)} aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => mover(1)} aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DIAS.map((d) => (
              <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">{d}</div>
            ))}
            {celdas.map((date, i) => {
              if (!date) return <div key={i} className="aspect-square" />;
              const k = keyLocal(date);
              const items = porDia.get(k) ?? [];
              const esHoy = k === keyLocal(hoy);
              const esSel = k === sel;
              return (
                <button
                  key={i}
                  onClick={() => setSel(k)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs transition-colors",
                    esSel ? "border-transparent text-primary-foreground" : "border-border hover:bg-secondary",
                    !esSel && esHoy && "border-[color:var(--ring,#35b9db)]"
                  )}
                  style={esSel ? { backgroundColor: ACCENT } : undefined}
                >
                  <span className={cn("font-medium", esHoy && !esSel && "text-primary")} style={esHoy && !esSel ? { color: ACCENT } : undefined}>
                    {date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="mt-auto flex flex-wrap justify-center gap-0.5">
                      {items.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className={cn("h-1.5 w-1.5 rounded-full", esSel ? "bg-white" : "")}
                          style={!esSel ? { backgroundColor: a.estado === "cancelada" ? "#9ca3af" : ACCENT } : undefined}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Panel lateral: día seleccionado + próximas + por confirmar */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {sel ? fmtFechaLarga(sel + "T12:00:00") : "Selecciona un día"}
            </h3>
            {delDia.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin audiencias este día.</p>
            ) : (
              <div className="space-y-2">
                {delDia.map((a) => <ItemAudiencia key={a.id} a={a} router={router} />)}
              </div>
            )}
          </CardContent>
        </Card>

        {proximas.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximas audiencias</h3>
              <div className="space-y-2">
                {proximas.map((a) => <ItemAudiencia key={a.id} a={a} router={router} conFecha />)}
              </div>
            </CardContent>
          </Card>
        )}

        {porConfirmar.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                <CircleHelp className="h-3.5 w-3.5" /> Por confirmar fecha ({porConfirmar.length})
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Detectamos audiencia en la actuación pero no pudimos leer la fecha. Fíjala a mano.
              </p>
              <div className="space-y-2">
                {porConfirmar.map((a) => <ItemAudiencia key={a.id} a={a} router={router} porConfirmar />)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ItemAudiencia({
  a, router, conFecha, porConfirmar,
}: {
  a: Audiencia;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
  conFecha?: boolean;
  porConfirmar?: boolean;
}) {
  async function fijarFecha() {
    const v = prompt("Fecha y hora de la audiencia (AAAA-MM-DD HH:MM):", "");
    if (!v) return;
    const iso = new Date(v.replace(" ", "T")).toISOString();
    const r = await fetch(`/api/vigilancia/audiencias/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: iso }),
    });
    if (r.ok) router.refresh();
  }

  return (
    <div className={cn("rounded-lg border p-2.5", a.estado === "cancelada" && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{fmtRadicado(a.radicado)}</span>
        <span
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: a.origen === "auto" ? `${ACCENT}22` : "#e2e8f0", color: a.origen === "auto" ? "#0e7490" : "#475569" }}
          title={a.origen === "auto" ? "Extraída de una actuación" : "Creada manualmente"}
        >
          {a.origen === "auto" ? <Sparkles className="h-2.5 w-2.5" /> : <Hand className="h-2.5 w-2.5" />}
          {a.origen}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{a.tipo ?? "Audiencia"}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {conFecha && a.fecha && <span>{new Date(a.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}</span>}
        {a.fecha && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtHora(a.fecha)}</span>}
        {a.despacho && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> {a.despacho.trim()}</span>}
        {a.enlace && <a href={a.enlace} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Video className="h-3 w-3" /> Enlace</a>}
      </div>
      {porConfirmar && (
        <Button variant="outline" size="sm" className="mt-2" onClick={fijarFecha}>Fijar fecha</Button>
      )}
    </div>
  );
}
