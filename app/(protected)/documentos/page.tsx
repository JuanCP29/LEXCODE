import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function DocumentosPage() {
  const supabase = createClient();

  const { data: fichas } = await supabase
    .from("fichas_conciliacion")
    .select("id, estado, docx_url, created_at, caso_id, casos(radicado, nombre_demandante)")
    .not("docx_url", "is", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground mt-1">Historial de fichas de conciliación generadas</p>
      </div>

      {!fichas || fichas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No hay documentos generados aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Radicado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Demandante</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody>
              {fichas.map((f: any) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{f.casos?.radicado ?? "—"}</td>
                  <td className="px-4 py-3">{f.casos?.nombre_demandante ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      f.estado === "listo" ? "bg-green-100 text-green-700" :
                      f.estado === "en_revision" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3">
                    {f.docx_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={f.docx_url} download>
                          <Download className="w-3.5 h-3.5 mr-1" /> Descargar
                        </a>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
