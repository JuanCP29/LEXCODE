import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { limpiarDespacho } from "@/lib/utils";
import { generarFichaPdf, type DatosFichaPdf } from "@/lib/pdf/generar-ficha-pdf";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = sb();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: ficha, error } = await supabase
      .from("fichas_conciliacion")
      .select(`*, casos (radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho)`)
      .eq("id", params.id)
      .single();
    if (error || !ficha) return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", ficha.creado_por)
      .single();

    const caso = ficha.casos as Record<string, string | null>;

    const datos: DatosFichaPdf = {
      fecha_diligencia:   ficha.fecha_diligencia ?? null,
      radicado_bizagi:    caso.radicado_bizagi ?? null,
      radicado:           caso.radicado ?? null,
      nombre_demandante:  caso.nombre_demandante ?? null,
      cedula_demandante:  caso.cedula_demandante ?? null,
      causante_afiliado:  ficha.causante_afiliado ?? null,
      autoridad_citacion: [limpiarDespacho(caso.despacho), ficha.juez].filter(Boolean).join(" — ") || null,
      caducidad:          ficha.caducidad ?? null,
      reconsideracion:    ficha.reconsideracion ?? null,
      // 14 secciones (por clave de BD)
      sec_1_hechos:           ficha.sec_1_hechos ?? null,
      sec_2_pretensiones:     ficha.sec_2_pretensiones ?? null,
      sec_3_cuantia:          ficha.sec_3_cuantia ?? null,
      sec_4_normas:           ficha.sec_4_normas ?? null,
      sec_5_apelacion:        ficha.sec_5_apelacion ?? null,
      sec_6_sentencia:        ficha.sec_6_sentencia ?? null,
      sec_8_problema:         ficha.sec_8_problema ?? null,
      sec_9_caducidad:        ficha.sec_9_caducidad ?? null,
      sec_11_jurisprudencia:  ficha.sec_11_jurisprudencia ?? null,
      sec_15_politicas:       ficha.sec_15_politicas ?? null,
      sec_16_consideraciones: ficha.sec_16_consideraciones ?? null,
      sec_17_riesgo:          ficha.sec_17_riesgo ?? null,
      sec_18_recomendacion:   ficha.sec_18_recomendacion ?? null,
      sec_19_elaboro:         ficha.sec_19_elaboro ?? perfil?.nombre_completo ?? null,
    };

    const buffer = await generarFichaPdf(datos);

    // Registrar exportación + transición de estado (best-effort)
    try {
      await supabase.from("exportaciones").insert({ ficha_id: params.id, tipo: "pdf", generado_por: user.id });
      if (ficha.estado === "aprobada") {
        await supabase.from("fichas_conciliacion").update({ estado: "exportada" }).eq("id", params.id);
      }
    } catch (e) { console.error("exportaciones pdf (no bloqueante):", e); }

    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const radicadoSafe = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `FICHA_CONCILIACION_${radicadoSafe}_${fecha}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("exportar-ficha-pdf:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
