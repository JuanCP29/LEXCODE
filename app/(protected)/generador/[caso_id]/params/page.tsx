import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GeneradorParamsView } from "@/components/fichas/generador-params-view";

export default async function GeneradorParamsPage({
  params,
}: {
  params: { caso_id: string };
}) {
  const supabase = createClient();

  const { data: caso } = await supabase
    .from("casos")
    .select("id, radicado, nombre_demandante, cedula_demandante, pretension, clase_pretension, jurisdiccion, despacho")
    .eq("id", params.caso_id)
    .single();

  if (!caso) notFound();

  return (
    <div className="max-w-5xl space-y-6">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href={`/casos/${caso.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {caso.radicado}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">Parámetros de la ficha</h1>
        <p className="text-muted-foreground mt-0.5">
          {caso.nombre_demandante}
          {caso.cedula_demandante && (
            <span className="text-muted-foreground/60"> · C.C. {caso.cedula_demandante}</span>
          )}
        </p>
        {caso.despacho && (
          <p className="text-sm text-muted-foreground mt-0.5">{caso.despacho}</p>
        )}
      </div>

      <GeneradorParamsView
        casoId={caso.id}
        casoData={{
          pretension: caso.pretension,
          clase_pretension: caso.clase_pretension,
          jurisdiccion: caso.jurisdiccion,
        }}
      />
    </div>
  );
}
