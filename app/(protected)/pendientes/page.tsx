import { createClient } from "@/lib/supabase/server";
import { TablaPendientes } from "@/components/pendientes/tabla-pendientes";
import { Clock } from "lucide-react";

export default async function PendientesPage() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("pendientes")
    .select(`
      id, motivo, descripcion, estado, created_at, resuelto_at,
      casos (id, radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, pretension),
      acciones_pendiente (id, tipo, descripcion, created_at)
    `)
    .order("created_at", { ascending: false });

  const pendientes = data ?? [];
  const activos   = pendientes.filter((p) => p.estado === "pendiente").length;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Bandeja de pendientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activos} caso{activos !== 1 ? "s" : ""} pendiente{activos !== 1 ? "s" : ""} de resolución
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
          <Clock className="w-3.5 h-3.5 text-orange-600" />
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{activos} activos</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          Error Supabase: {error.message}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <TablaPendientes pendientes={pendientes as any[]} />
      </div>
    </div>
  );
}
