import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generarContestacionDocx } from "@/lib/docx/generar-contestacion-docx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sb() {
  const c = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { caso_id: string } }) {
  try {
    const supabase = sb();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: caso } = await supabase
      .from("casos")
      .select("radicado, nombre_demandante, cedula_demandante, jurisdiccion, despacho")
      .eq("id", params.caso_id)
      .single();
    if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

    const { data: con } = await supabase
      .from("contestaciones")
      .select("sec_hechos, sec_pretensiones, sec_defensa")
      .eq("caso_id", params.caso_id)
      .maybeSingle();

    const buffer = await generarContestacionDocx({
      radicado: caso.radicado,
      nombre_demandante: caso.nombre_demandante,
      cedula_demandante: caso.cedula_demandante,
      jurisdiccion: caso.jurisdiccion,
      despacho: caso.despacho,
      sec_hechos: con?.sec_hechos ?? null,
      sec_pretensiones: con?.sec_pretensiones ?? null,
      sec_defensa: con?.sec_defensa ?? null,
    });

    const nombre = `CONTESTACION_DDA_${caso.cedula_demandante ? `CC_${caso.cedula_demandante}` : caso.radicado}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (e) {
    console.error("exportar-contestacion docx:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
