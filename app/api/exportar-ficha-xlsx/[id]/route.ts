import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import path from "path";
import fs from "fs";
import { generarFichaXlsx } from "@/lib/xlsx/generar-ficha-xlsx";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: ficha, error } = await supabase
      .from("fichas_conciliacion")
      .select(`*, casos (radicado, radicado_bizagi, nombre_demandante, cedula_demandante, expediente_pensional, despacho, jurisdiccion, pretension, clase_pretension)`)
      .eq("id", params.id)
      .single();

    if (error || !ficha) return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });

    const caso = ficha.casos as Record<string, string | null>;

    // Leer plantilla desde public/plantillas/
    const templatePath = path.join(process.cwd(), "public", "plantillas", "FICHA_CONCILIACION_TEMPLATE.xlsx");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Plantilla no encontrada en servidor" }, { status: 500 });
    }
    const templateBuffer = fs.readFileSync(templatePath);

    const buffer = await generarFichaXlsx(templateBuffer, {
      tipo_conciliacion:           ficha.tipo_conciliacion ?? "parametrica",
      fecha_diligencia:            ficha.fecha_diligencia ?? null,
      radicado_bizagi:             caso.radicado_bizagi ?? "",
      radicado:                    caso.radicado ?? "",
      nombre_demandante:           caso.nombre_demandante ?? "",
      expediente_pensional_aplica: ficha.expediente_pensional_aplica ?? (caso.expediente_pensional ? "SI" : "NO APLICA"),
      despacho:                    caso.despacho ?? "",
      caducidad:                   ficha.caducidad ?? "",
      sec_1:  ficha.sec_1_hechos ?? "",
      sec_2:  ficha.sec_2_pretensiones ?? "",
      sec_3:  ficha.sec_3_cuantia ?? "",
      sec_4:  ficha.sec_4_normas ?? "",
      sec_5:  ficha.sec_5_apelacion ?? "",
      sec_6:  ficha.sec_6_sentencia ?? "",
      sec_7:  ficha.sec_7_probatorio ?? "",
      sec_8:  ficha.sec_8_problema ?? "",
      sec_9:  ficha.sec_9_caducidad ?? "",
      sec_10: ficha.sec_10_movimientos ?? "",
      sec_11: ficha.sec_11_jurisprudencia ?? "",
      sec_12: ficha.sec_12_doctrina ?? "",
      sec_13: ficha.sec_13_comite_ext ?? "",
      sec_14: ficha.sec_14_casos_similares ?? "",
      sec_15: ficha.sec_15_politicas ?? "",
      sec_16: ficha.sec_16_consideraciones ?? "",
      sec_17: ficha.sec_17_riesgo ?? "",
      sec_18: ficha.sec_18_recomendacion ?? "",
      sec_19: ficha.sec_19_elaboro ?? "",
    });

    const fecha   = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const radicadoSafe = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `FICHA_CONCILIACION_${radicadoSafe}_${fecha}.xlsx`;

    // Registrar exportación + transición de estado (best-effort)
    try {
      await supabase.from("exportaciones").insert({
        ficha_id: params.id,
        tipo: "xlsx",
        generado_por: user.id,
      });
      if (ficha.estado === "aprobada") {
        await supabase.from("fichas_conciliacion").update({ estado: "exportada" }).eq("id", params.id);
      }
    } catch (e) {
      console.error("exportaciones (no bloqueante):", e);
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("exportar-ficha-xlsx:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
