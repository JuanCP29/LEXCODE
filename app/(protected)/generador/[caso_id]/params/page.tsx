import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookMarked } from "lucide-react";
import { GeneradorParamsView } from "@/components/fichas/generador-params-view";

export default async function GeneradorParamsPage({
  params,
}: {
  params: { caso_id: string };
}) {
  const supabase = createClient();

  const { data: caso } = await supabase
    .from("casos")
    .select("id, radicado, radicado_bizagi, nombre_demandante, cedula_demandante, pretension, clase_pretension, jurisdiccion, despacho")
    .eq("id", params.caso_id)
    .single();

  if (!caso) notFound();

  // Documentos previos del caso (archivos subidos) con URL firmada para descargar.
  const { data: archivos } = await supabase
    .from("archivos_proceso")
    .select("id, tipo, storage_path, nombre_original, created_at")
    .eq("caso_id", caso.id)
    .order("created_at", { ascending: true });

  const documentos = await Promise.all(
    (archivos ?? []).map(async (a) => ({
      id: a.id as string,
      tipo: (a.tipo as string | null) ?? null,
      nombre: (a.nombre_original as string | null) ?? "Documento",
      created_at: a.created_at as string,
      url:
        (await supabase.storage.from("documentos-lexcode").createSignedUrl(a.storage_path, 60 * 60))
          .data?.signedUrl ?? null,
    }))
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-7">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href={`/casos/${caso.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al caso
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
          Ficha de conciliación
          <BookMarked className="w-5 h-5 text-muted-foreground/60" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wide">
          {caso.nombre_demandante}
          {caso.cedula_demandante && (
            <span className="text-muted-foreground/60"> · C.C. {caso.cedula_demandante}</span>
          )}
        </p>
      </div>

      <GeneradorParamsView
        casoId={caso.id}
        documentos={documentos}
        casoData={{
          pretension: caso.pretension,
          clase_pretension: caso.clase_pretension,
          jurisdiccion: caso.jurisdiccion,
          radicado: caso.radicado,
          radicado_bizagi: caso.radicado_bizagi,
          nombre_demandante: caso.nombre_demandante,
          cedula_demandante: caso.cedula_demandante,
          despacho: caso.despacho,
        }}
      />
    </div>
  );
}
