import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EditorFicha } from "./editor-ficha";

export default async function GeneradorFichaPage({
  params,
  searchParams,
}: {
  params: { caso_id: string };
  searchParams: { ficha_id?: string };
}) {
  const supabase = createClient();

  const { data: caso } = await supabase
    .from("casos")
    .select("id, radicado, nombre_demandante, pretension, clase_pretension, jurisdiccion")
    .eq("id", params.caso_id)
    .single();

  if (!caso) notFound();

  // Cargar ficha existente si se pasa ficha_id
  let ficha = null;
  if (searchParams.ficha_id) {
    const { data } = await supabase
      .from("fichas_conciliacion")
      .select("*")
      .eq("id", searchParams.ficha_id)
      .single();
    ficha = data;
  }

  return (
    <EditorFicha
      caso={caso}
      fichaInicial={ficha}
    />
  );
}
