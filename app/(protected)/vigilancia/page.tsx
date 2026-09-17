import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VigilanciaView, type ProcesoVigilado } from "@/components/vigilancia/vigilancia-view";
import { ScanEye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VigilanciaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: yo } = await supabase.from("perfiles").select("rol, org_id").eq("id", user.id).single();
  if (yo?.rol === "superadmin") redirect("/dashboard");

  const { data: procesos } = await supabase
    .from("procesos_vigilados")
    .select("id, radicado, despacho, sujetos, ciudad, estado, ultimo_movimiento, backfill_completo, created_at, caso_id")
    .eq("activo", true)
    .order("ultimo_movimiento", { ascending: false, nullsFirst: false });

  const ids = (procesos ?? []).map((p) => p.id);
  const conteo: Record<string, number> = {};
  if (ids.length) {
    const { data: nov } = await supabase
      .from("novedades_vigilancia").select("proceso_id").in("proceso_id", ids).eq("atendida", false);
    for (const n of nov ?? []) conteo[n.proceso_id] = (conteo[n.proceso_id] ?? 0) + 1;
  }

  const iniciales: ProcesoVigilado[] = (procesos ?? []).map((p) => ({
    ...p,
    novedades: conteo[p.id] ?? 0,
  }));
  const totalNovedades = iniciales.reduce((s, p) => s + p.novedades, 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <ScanEye className="h-5 w-5 text-primary" />
            Vigilancia judicial
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Monitoreo automático de procesos en la Rama Judicial ·{" "}
            {iniciales.length} proceso{iniciales.length !== 1 ? "s" : ""} vigilado
            {iniciales.length !== 1 ? "s" : ""}
            {totalNovedades > 0 && (
              <> · <span className="font-semibold text-foreground">{totalNovedades} novedad{totalNovedades !== 1 ? "es" : ""}</span> sin atender</>
            )}
          </p>
        </div>
      </div>

      <VigilanciaView iniciales={iniciales} />
    </div>
  );
}
