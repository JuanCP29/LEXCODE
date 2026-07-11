import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

type CasoImportado = {
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
  expediente_pensional: string | null;
};

// POST: recibe JSON con array de casos ya parseados por el cliente
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as { casos: CasoImportado[] };
    const casos = body?.casos;

    if (!Array.isArray(casos) || casos.length === 0) {
      return NextResponse.json({ error: "No se recibieron casos" }, { status: 400 });
    }

    // Insertar en lotes de 50
    const casosConUser = casos.map((c) => ({ ...c, abogado_id: user.id, estado: "activo" }));
    const BATCH = 50;
    let insertados = 0;
    const errores: string[] = [];

    for (let i = 0; i < casosConUser.length; i += BATCH) {
      const lote = casosConUser.slice(i, i + BATCH);
      const { error: insertError, data: inserted } = await supabase
        .from("casos")
        .insert(lote)
        .select("id");

      if (insertError) {
        errores.push(`Lote ${Math.floor(i / BATCH) + 1}: ${insertError.message}`);
      } else {
        insertados += inserted?.length ?? lote.length;
      }
    }

    return NextResponse.json({
      insertados,
      total: casos.length,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (e) {
    console.error("importar-excel:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
