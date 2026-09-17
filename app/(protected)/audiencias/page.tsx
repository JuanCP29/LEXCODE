import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarioAudiencias, type Audiencia } from "@/components/vigilancia/calendario-audiencias";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AudienciasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: yo } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (yo?.rol === "superadmin") redirect("/dashboard");

  const { data } = await supabase
    .from("audiencias_vigilancia")
    .select("id, fecha, tipo, despacho, enlace, notas, origen, estado, proceso_id, procesos_vigilados(radicado, sujetos)")
    .order("fecha", { ascending: true, nullsFirst: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audiencias: Audiencia[] = (data ?? []).map((a: any) => ({
    id: a.id,
    fecha: a.fecha,
    tipo: a.tipo,
    despacho: a.despacho,
    enlace: a.enlace,
    notas: a.notas,
    origen: a.origen,
    estado: a.estado,
    proceso_id: a.proceso_id,
    radicado: a.procesos_vigilados?.radicado ?? "",
    sujetos: a.procesos_vigilados?.sujetos ?? null,
  }));

  const conFecha = audiencias.filter((a) => a.fecha);
  const proximas = conFecha.filter((a) => new Date(a.fecha!) >= new Date() && a.estado !== "cancelada").length;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendario de audiencias
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Audiencias detectadas automáticamente de las actuaciones vigiladas ·{" "}
          <span className="font-semibold text-foreground">{proximas}</span> próxima{proximas !== 1 ? "s" : ""}
        </p>
      </div>

      <CalendarioAudiencias iniciales={audiencias} />
    </div>
  );
}
