import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Acento + etiqueta por estado de la ficha (para el riel y el badge).
const ESTADO: Record<string, { label: string; color: string; badge: string }> = {
  listo:       { label: "Listo",       color: "#16a34a", badge: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900" },
  en_revision: { label: "En revisión", color: "#d97706", badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
  borrador:    { label: "Borrador",    color: "#2563eb", badge: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" },
};
function estadoCfg(e: string) {
  return ESTADO[e] ?? { label: e, color: "#94a3b8", badge: "bg-muted text-muted-foreground border border-border" };
}

// "NOMBRE APELLIDO" → "Nombre Apellido" (conectores en minúscula)
const MIN = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
function titulo(t: string | null | undefined): string {
  if (!t) return "—";
  return t.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MIN.has(p)) || /\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export default async function DocumentosPage() {
  const supabase = createClient();

  const { data: fichas } = await supabase
    .from("fichas_conciliacion")
    .select("id, estado, docx_url, created_at, caso_id, casos(radicado, nombre_demandante)")
    .not("docx_url", "is", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Historial</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {fichas?.length ?? 0} documento{(fichas?.length ?? 0) !== 1 ? "s" : ""} generado{(fichas?.length ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {!fichas || fichas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No hay documentos generados aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Demandante</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Acción</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {fichas.map((f: any) => {
                  const cfg = estadoCfg(f.estado);
                  const caso = Array.isArray(f.casos) ? f.casos[0] : f.casos;
                  return (
                    <tr key={f.id} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                      {/* Demandante (ancla) + riel de color */}
                      <td className="px-4 py-3 border-l-[3px]" style={{ borderLeftColor: cfg.color }}>
                        <p className="font-semibold text-foreground text-sm leading-tight">{titulo(caso?.nombre_demandante)}</p>
                        {caso?.radicado && <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tabular-nums">{caso.radicado}</p>}
                      </td>
                      {/* Estado */}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${cfg.badge}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      {/* Fecha */}
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(f.created_at)}</td>
                      {/* Acción */}
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {f.docx_url && (
                            <Button asChild size="sm" variant="outline">
                              <a href={f.docx_url} download>
                                <Download className="w-3.5 h-3.5 mr-1" /> Descargar
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
