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

// Normaliza la clave igual que el seed: MAYÚSCULAS, sin acentos, espacios colapsados.
function norm(s: string | null): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

// GET /api/riesgo-historico?pretension=vejez&clase=traslado de régimen
// Devuelve la calificación histórica sugerida (moda + distribución) de los 4 criterios.
export async function GET(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const pret = norm(request.nextUrl.searchParams.get("pretension"));
  const clase = norm(request.nextUrl.searchParams.get("clase"));
  if (!pret) return NextResponse.json({ criterios: null });

  try {
    // 1. Combo exacto pretensión + clase
    let fuente: "combo" | "pretension" = "combo";
    let { data } = clase
      ? await supabase.from("riesgo_historico").select("n, clase_pretension, criterios")
          .eq("pretension", pret).eq("clase_pretension", clase).maybeSingle()
      : { data: null };

    // 2. Respaldo por pretensión (clase null)
    if (!data) {
      fuente = "pretension";
      ({ data } = await supabase.from("riesgo_historico").select("n, clase_pretension, criterios")
        .eq("pretension", pret).is("clase_pretension", null).maybeSingle());
    }

    if (!data) return NextResponse.json({ criterios: null });
    return NextResponse.json({
      fuente,
      n: data.n,
      clase: data.clase_pretension,
      pretension: pret,
      criterios: data.criterios,
    });
  } catch (e) {
    console.error("GET /api/riesgo-historico:", e);
    return NextResponse.json({ criterios: null });
  }
}
