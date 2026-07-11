import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { SECCIONES } from "@/lib/ia/secciones";

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

// Mapeo key_columna → clave JSON que usa la IA
const MAPA_KEY_A_JSON: Record<string, string> = {
  sec_1_hechos:           "sec_1",
  sec_2_pretensiones:     "sec_2",
  sec_3_cuantia:          "sec_3",
  sec_4_normas:           "sec_4",
  sec_8_problema:         "sec_8",
  sec_16_consideraciones: "sec_16",
  sec_18_recomendacion:   "sec_18",
};

const MAPA_JSON_A_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(MAPA_KEY_A_JSON).map(([k, v]) => [v, k])
);

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { caso_id, ficha_id, seccion_key } = body as {
      caso_id: string;
      ficha_id: string;
      seccion_key: string; // ej: "sec_1_hechos"
    };

    if (!caso_id || !ficha_id || !seccion_key) {
      return NextResponse.json(
        { error: "caso_id, ficha_id y seccion_key son obligatorios" },
        { status: 400 }
      );
    }

    // Validar que sea una sección AUTO
    const seccion = SECCIONES.find((s) => s.key === seccion_key);
    if (!seccion || seccion.tipo !== "AUTO") {
      return NextResponse.json(
        { error: "Solo se pueden regenerar secciones de tipo AUTO" },
        { status: 400 }
      );
    }

    const claveJson = MAPA_KEY_A_JSON[seccion_key];
    if (!claveJson) {
      return NextResponse.json(
        { error: `Sección no regenerable: ${seccion_key}` },
        { status: 400 }
      );
    }

    // ── 1. Cargar caso ────────────────────────────────────────────────────
    const { data: caso, error: casoError } = await supabase
      .from("casos")
      .select("radicado, nombre_demandante, pretension, clase_pretension, jurisdiccion")
      .eq("id", caso_id)
      .single();

    if (casoError || !caso) {
      return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
    }

    // ── 1b. Cargar ficha ──────────────────────────────────────────────────
    type FichaParams = {
      tipo_conciliacion: string | null;
      conciliable: boolean | null;
      directriz_conciliacion: string | null;
      resolucion_prestacion: string | null;
      semanas_cotizadas: number | null;
      tasa_aplicada: number | null;
      tasa_solicitada: number | null;
      cuantia_tipo: string | null;
      cuantia_valor: number | null;
      pretende_intereses: boolean;
      pretende_indexacion: boolean;
      hay_fallo: boolean;
      sintesis_fallo: string | null;
    };

    const fichaRes = await supabase
      .from("fichas_conciliacion")
      .select(
        "tipo_conciliacion, conciliable, directriz_conciliacion, resolucion_prestacion, " +
        "semanas_cotizadas, tasa_aplicada, tasa_solicitada, cuantia_tipo, cuantia_valor, " +
        "pretende_intereses, pretende_indexacion, hay_fallo, sintesis_fallo"
      )
      .eq("id", ficha_id)
      .single();

    if (fichaRes.error || !fichaRes.data) {
      return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });
    }

    const ficha = fichaRes.data as unknown as FichaParams;

    // ── 2. Descargar demanda PDF ──────────────────────────────────────────
    const { data: archivos } = await supabase
      .from("archivos_proceso")
      .select("storage_path, tipo")
      .eq("caso_id", caso_id);

    const archivoPDF = archivos?.find((a) => a.tipo === "demanda_pdf");
    const archivoLineamientos = archivos?.find((a) => a.tipo === "lineamientos");

    let textoDemanda = "";
    let textoLineamientos = "";

    if (archivoPDF) {
      const { data: pdfData } = await supabase.storage
        .from("documentos-lexcode")
        .download(archivoPDF.storage_path);
      if (pdfData) {
        const buffer = Buffer.from(await pdfData.arrayBuffer());
        textoDemanda = await extraerTextoPDF(buffer);
      }
    }

    if (archivoLineamientos) {
      const { data: linData } = await supabase.storage
        .from("documentos-lexcode")
        .download(archivoLineamientos.storage_path);
      if (linData) {
        const buffer = Buffer.from(await linData.arrayBuffer());
        textoLineamientos = await extraerTextoPDF(buffer);
      }
    }

    // ── 3. Prompt focalizado en una sola sección ──────────────────────────
    const cuantia =
      ficha.cuantia_tipo === "determinada" && ficha.cuantia_valor
        ? `Determinada — $${Number(ficha.cuantia_valor).toLocaleString("es-CO")}`
        : "Indeterminada";

    const prompt = `Eres un abogado experto en seguridad social colombiana.
Analiza la siguiente demanda y regenera ÚNICAMENTE la sección ${claveJson.replace("sec_", "")} (${seccion.label}) de la Ficha de Conciliación Judicial formato GDJ-GPO-FMT-005.

PARÁMETROS DEL CASO:
- Radicado: ${caso.radicado}
- Demandante: ${caso.nombre_demandante}
- Pretensión: ${caso.pretension ?? "No especificada"}
- Clase: ${caso.clase_pretension ?? "No especificada"}
- Jurisdicción: ${caso.jurisdiccion ?? "No especificada"}
- Resolución de prestación: ${ficha.resolucion_prestacion || "No aplica"}
- Semanas cotizadas: ${ficha.semanas_cotizadas ?? "No especificadas"}
- Tasa aplicada: ${ficha.tasa_aplicada != null ? `${ficha.tasa_aplicada}%` : "No aplica"}
- Tasa solicitada: ${ficha.tasa_solicitada != null ? `${ficha.tasa_solicitada}%` : "No aplica"}
- Cuantía: ${cuantia}
- Intereses moratorios: ${ficha.pretende_intereses ? "Sí" : "No"}
- Indexación: ${ficha.pretende_indexacion ? "Sí" : "No"}
- Tipo de conciliación: ${ficha.tipo_conciliacion ?? "No especificado"}
- Conciliable: ${ficha.conciliable ? "Sí" : "No"}
- Directriz: ${ficha.directriz_conciliacion || "No especificada"}
- Hay fallo: ${ficha.hay_fallo ? "Sí" : "No"}
${ficha.hay_fallo && ficha.sintesis_fallo ? `- Síntesis del fallo: ${ficha.sintesis_fallo}` : ""}

TEXTO DE LA DEMANDA:
${textoDemanda || "No se proporcionó texto de demanda."}

LINEAMIENTOS:
${textoLineamientos || "No se proporcionaron lineamientos."}

Responde ÚNICAMENTE en JSON válido con esta estructura:
{
  "${claveJson}": "texto completo de la sección en lenguaje jurídico formal colombiano"
}

No inventes datos que no estén en los insumos. No agregues más claves al JSON.`;

    // ── 4. Llamar a Claude ─────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const respuestaTexto =
      message.content[0].type === "text" ? message.content[0].text : "";

    const match = respuestaTexto.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: "La IA no devolvió JSON válido" },
        { status: 502 }
      );
    }

    const json = JSON.parse(match[0]);
    const contenido = String(json[claveJson] ?? "");

    // ── 5. Persistir en la BD ──────────────────────────────────────────────
    await supabase
      .from("fichas_conciliacion")
      .update({ [seccion_key]: contenido })
      .eq("id", ficha_id);

    return NextResponse.json({ contenido });
  } catch (error) {
    console.error("Error regenerando sección:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
