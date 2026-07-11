import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function FichasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fichas } = await supabase
    .from("fichas_conciliacion")
    .select("*, casos(numero_radicado, demandante, demandado)")
    .eq("creado_por", user!.id)
    .order("fecha_creacion", { ascending: false });

  const estadoColors: Record<string, string> = {
    borrador: "bg-gray-100 text-gray-600",
    revisión: "bg-yellow-100 text-yellow-700",
    aprobada: "bg-green-100 text-green-700",
    enviada: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fichas de Conciliación</h1>
          <p className="text-muted-foreground mt-1">
            Formato GDJ-GPO-FMT-005 v2 — Colpensiones
          </p>
        </div>
        <Button asChild>
          <Link href="/fichas/nueva">
            <Plus className="w-4 h-4 mr-1" /> Nueva ficha
          </Link>
        </Button>
      </div>

      {!fichas || fichas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">No hay fichas generadas</p>
            <Button asChild size="sm">
              <Link href="/fichas/nueva">Generar primera ficha</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {fichas.map((ficha: any) => (
            <Link key={ficha.id} href={`/fichas/${ficha.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {ficha.casos?.numero_radicado ?? "Sin radicado"}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {ficha.casos?.demandante} vs. {ficha.casos?.demandado}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        estadoColors[ficha.estado] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ficha.estado}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    v{ficha.version} · {formatDate(ficha.fecha_creacion)}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
