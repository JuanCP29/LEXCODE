import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

/**
 * GET — directrices aplicables al caso.
 * Resolución:
 * 1. Si el caso tiene tipología → directrices activas asociadas a esa tipología
 *    (o a su tipología padre, para directrices de categoría completa).
 * 2. Fallback legacy: directrices activas por pretensión del caso (o 'general').
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Query con join a tipologías; si la migración fase1 no se ha ejecutado,
  // cae a la query básica por pretensión (no rompe el UI).
  let caso: { id: string; pretension: string | null; tipologia_id?: string | null; tipologias?: unknown } | null = null;

  const { data: casoFull, error: joinError } = await supabase
    .from("casos")
    .select("id, pretension, tipologia_id, tipologias(id, nombre, parent_id)")
    .eq("id", params.id)
    .single();

  if (casoFull) {
    caso = casoFull;
  } else if (joinError) {
    const { data: casoBasico } = await supabase
      .from("casos")
      .select("id, pretension")
      .eq("id", params.id)
      .single();
    caso = casoBasico;
  }

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const seleccion = "id, nombre, codigo, fecha_directriz, pretension, clase_pretension, criterio_conciliacion, recomendacion_base, riesgo_base, activo";

  // 1. Por tipología (incluye la tipología padre si existe)
  if (caso.tipologia_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tipologia = caso.tipologias as any;
    const ids = [caso.tipologia_id];
    if (tipologia?.parent_id) ids.push(tipologia.parent_id);

    const { data: rels } = await supabase
      .from("directriz_tipologias")
      .select("directriz_id")
      .in("tipologia_id", ids);

    const directrizIds = Array.from(new Set((rels ?? []).map((r) => r.directriz_id)));

    if (directrizIds.length > 0) {
      const { data: directrices } = await supabase
        .from("directrices_conciliacion")
        .select(seleccion)
        .in("id", directrizIds)
        .eq("activo", true)
        .order("nombre");

      if (directrices && directrices.length > 0) {
        return NextResponse.json({ directrices, metodo: "tipologia" });
      }
    }
  }

  // 2. Fallback por pretensión
  if (caso.pretension) {
    const { data: directrices } = await supabase
      .from("directrices_conciliacion")
      .select(seleccion)
      .or(`pretension.eq.${caso.pretension},pretension.eq.general`)
      .eq("activo", true)
      .order("nombre");

    return NextResponse.json({ directrices: directrices ?? [], metodo: "pretension" });
  }

  return NextResponse.json({ directrices: [], metodo: "ninguno" });
}
