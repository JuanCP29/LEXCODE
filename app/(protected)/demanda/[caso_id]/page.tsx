import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditorContestacion } from "./editor-contestacion";

export default async function ContestacionPage({ params }: { params: { caso_id: string } }) {
  const supabase = createClient();

  const { data: caso } = await supabase
    .from("casos")
    .select("id, radicado, radicado_bizagi, nombre_demandante, cedula_demandante, pretension, clase_pretension, jurisdiccion, despacho")
    .eq("id", params.caso_id)
    .single();

  if (!caso) notFound();

  // Contestación existente del caso (si ya se generó/guardó).
  const { data: contestacion } = await supabase
    .from("contestaciones")
    .select("id, sec_hechos, sec_pretensiones, sec_defensa")
    .eq("caso_id", caso.id)
    .maybeSingle();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/casos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a Reparto
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">Contestación de la Demanda</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {caso.nombre_demandante}{caso.cedula_demandante ? ` · C.C. ${caso.cedula_demandante}` : ""} · Radicado {caso.radicado}
        </p>
      </div>

      <EditorContestacion
        casoId={caso.id}
        inicial={{
          sec_hechos: contestacion?.sec_hechos ?? "",
          sec_pretensiones: contestacion?.sec_pretensiones ?? "",
          sec_defensa: contestacion?.sec_defensa ?? "",
        }}
      />
    </div>
  );
}
