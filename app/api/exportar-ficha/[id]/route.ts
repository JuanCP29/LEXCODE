import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generarFichaDocx } from "@/lib/docx/generar-ficha-docx";
import { rellenarTemplateDocx, templateDocxDisponible } from "@/lib/docx/rellenar-template-docx";

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
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 1. Cargar ficha + caso
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_conciliacion")
      .select(`
        *,
        casos (
          radicado, radicado_bizagi, nombre_demandante, cedula_demandante,
          expediente_pensional, despacho, jurisdiccion, pretension, clase_pretension
        )
      `)
      .eq("id", params.id)
      .single();

    if (fichaError || !ficha) {
      return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });
    }

    // 2. Cargar perfil del abogado que creó la ficha
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", ficha.creado_por)
      .single();

    // 3. Construir datos para el docx
    const caso = ficha.casos as Record<string, string | null>;
    const datos = {
      // Caso
      radicado:             caso.radicado ?? "",
      radicado_bizagi:      caso.radicado_bizagi,
      nombre_demandante:    caso.nombre_demandante ?? "",
      cedula_demandante:    caso.cedula_demandante,
      expediente_pensional: caso.expediente_pensional,
      despacho:             caso.despacho,
      jurisdiccion:         caso.jurisdiccion,
      pretension:           caso.pretension,
      clase_pretension:     caso.clase_pretension,

      // Parámetros
      tipo_conciliacion:       ficha.tipo_conciliacion,
      conciliable:             ficha.conciliable,
      directriz_conciliacion:  ficha.directriz_conciliacion,
      resolucion_prestacion:   ficha.resolucion_prestacion,
      semanas_cotizadas:       ficha.semanas_cotizadas,
      tasa_aplicada:           ficha.tasa_aplicada,
      tasa_solicitada:         ficha.tasa_solicitada,
      cuantia_tipo:            ficha.cuantia_tipo,
      cuantia_valor:           ficha.cuantia_valor,
      pretende_intereses:      ficha.pretende_intereses,
      pretende_indexacion:     ficha.pretende_indexacion,
      hay_fallo:               ficha.hay_fallo,

      // 19 secciones
      sec_1_hechos:            ficha.sec_1_hechos,
      sec_2_pretensiones:      ficha.sec_2_pretensiones,
      sec_3_cuantia:           ficha.sec_3_cuantia,
      sec_4_normas:            ficha.sec_4_normas,
      sec_5_apelacion:         ficha.sec_5_apelacion,
      sec_6_sentencia:         ficha.sec_6_sentencia,
      sec_7_probatorio:        ficha.sec_7_probatorio,
      sec_8_problema:          ficha.sec_8_problema,
      sec_9_caducidad:         ficha.sec_9_caducidad,
      sec_10_movimientos:      ficha.sec_10_movimientos,
      sec_11_jurisprudencia:   ficha.sec_11_jurisprudencia,
      sec_12_doctrina:         ficha.sec_12_doctrina,
      sec_13_comite_ext:       ficha.sec_13_comite_ext,
      sec_14_casos_similares:  ficha.sec_14_casos_similares,
      sec_15_politicas:        ficha.sec_15_politicas,
      sec_16_consideraciones:  ficha.sec_16_consideraciones,
      sec_17_riesgo:           ficha.sec_17_riesgo,
      sec_18_recomendacion:    ficha.sec_18_recomendacion,
      sec_19_elaboro:          ficha.sec_19_elaboro,

      // Abogado
      abogado_nombre:  perfil?.nombre_completo ?? null,
      abogado_cedula:  null,
      abogado_tarjeta: null,

      fecha_elaboracion: ficha.created_at,
    };

    // 4. Generar .docx — rellenando el template oficial; fallback al generador legacy
    let buffer: Buffer;
    if (templateDocxDisponible()) {
      buffer = rellenarTemplateDocx({
        fecha_diligencia:     ficha.fecha_diligencia ?? "",
        radicado_bizagi:      caso.radicado_bizagi ?? "",
        radicado:             caso.radicado ?? "",
        nombre_demandante:    caso.nombre_demandante ?? "",
        expediente_pensional: ficha.expediente_pensional_aplica ?? caso.expediente_pensional ?? "",
        autoridad_citacion:   caso.despacho ?? "",
        caducidad:            ficha.caducidad ?? "",
        sec_1:  ficha.sec_1_hechos ?? "",
        sec_2:  ficha.sec_2_pretensiones ?? "",
        sec_3:  ficha.sec_3_cuantia ?? "",
        sec_4:  ficha.sec_4_normas ?? "",
        sec_5:  ficha.sec_5_apelacion ?? "N/A",
        sec_6:  ficha.sec_6_sentencia ?? "N/A",
        sec_7:  ficha.sec_7_probatorio ?? "",
        sec_8:  ficha.sec_8_problema ?? "",
        sec_9:  ficha.sec_9_caducidad ?? "N/A",
        sec_10: ficha.sec_10_movimientos ?? "",
        sec_11: ficha.sec_11_jurisprudencia ?? "",
        sec_12: ficha.sec_12_doctrina ?? "",
        sec_13: ficha.sec_13_comite_ext ?? "N/A",
        sec_14: ficha.sec_14_casos_similares ?? "",
        sec_15: ficha.sec_15_politicas ?? "",
        sec_16: ficha.sec_16_consideraciones ?? "",
        sec_17: ficha.sec_17_riesgo ?? "",
        sec_18: ficha.sec_18_recomendacion ?? "",
        sec_19: ficha.sec_19_elaboro ?? perfil?.nombre_completo ?? "",
      });
    } else {
      buffer = await generarFichaDocx(datos);
    }

    // 5. Nombre del archivo
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const radicadoSafe = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `FICHA_CONCILIACION_${radicadoSafe}_${fecha}.docx`;

    // 6. Guardar en Supabase Storage
    const storagePath = `${user.id}/${ficha.caso_id}/${nombreArchivo}`;
    const { error: uploadError } = await supabase.storage
      .from("documentos-lexcode")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("documentos-lexcode")
        .getPublicUrl(storagePath);

      // Actualizar URL en la ficha
      await supabase
        .from("fichas_conciliacion")
        .update({ docx_url: urlData.publicUrl })
        .eq("id", params.id);
    }

    // 7. Retornar el archivo directamente para descarga
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("Error exportando ficha:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
