import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { construirPrompt, parsearRespuestaIA } from "@/lib/ia/construir-prompt";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();

    // Verificar sesión
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { caso_id, params } = body as {
      caso_id: string;
      params: {
        // Campos de fichas_conciliacion
        tipo_conciliacion: string;
        conciliable: boolean;
        directriz_conciliacion: string;
        resolucion_prestacion: string;
        semanas_cotizadas: number | null;
        tasa_aplicada: number | null;
        tasa_solicitada: number | null;
        cuantia_tipo: string;
        cuantia_valor: number | null;
        pretende_intereses: boolean;
        pretende_indexacion: boolean;
        hay_fallo: boolean;
        sintesis_fallo: string;
        fecha_diligencia?: string | null;
        caducidad?: string | null;
        expediente_pensional_aplica?: string | null;
        // Campos de casos (solo para el prompt, NO van en fichas_conciliacion)
        pretension?: string;
        clase_pretension?: string;
        jurisdiccion?: string;
      };
    };

    if (!caso_id || !params) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    // 1. Cargar datos del caso
    const { data: caso, error: casoError } = await supabase
      .from("casos")
      .select("id, radicado, nombre_demandante, pretension, clase_pretension, jurisdiccion")
      .eq("id", caso_id)
      .single();

    if (casoError || !caso) {
      return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
    }

    // 2. Obtener archivos del proceso
    const { data: archivos } = await supabase
      .from("archivos_proceso")
      .select("tipo, storage_path, nombre_original")
      .eq("caso_id", caso_id);

    // 3. Extraer texto del PDF de la demanda
    let textoDemanda = "";
    const archivoPDF = archivos?.find((a) => a.tipo === "demanda_pdf");
    if (archivoPDF) {
      try {
        const { data: fileData } = await supabase.storage
          .from("documentos-lexcode")
          .download(archivoPDF.storage_path);

        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          textoDemanda = await extraerTextoPDF(buffer);
        }
      } catch (pdfError) {
        console.error("Error extrayendo PDF demanda:", pdfError);
        // Continúa sin texto — la IA trabajará con los parámetros
      }
    }

    // 4. Obtener lineamientos de conciliación
    const lineamientosArchivo = archivos?.find((a) => a.tipo === "lineamientos");

    let lineamientos = "";
    if (lineamientosArchivo) {
      try {
        const { data: fileData } = await supabase.storage
          .from("documentos-lexcode")
          .download(lineamientosArchivo.storage_path);

        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          lineamientos = await extraerTextoPDF(buffer);
        }
      } catch {
        // Lineamientos opcionales — continúa sin ellos
      }
    }

    // 5. Cargar directriz de conciliación automáticamente según la pretensión del caso
    let textoDirectriz = "";
    const pretensionBusqueda = caso.pretension ?? params.pretension;
    if (pretensionBusqueda) {
      const { data: directrizRows } = await supabase
        .from("directrices_conciliacion")
        .select("nombre, texto_extraido, clase_pretension")
        .eq("activo", true)
        .or(`pretension.eq.${pretensionBusqueda},pretension.eq.general`)
        .order("pretension")   // pretension específica primero vs. 'general'
        .limit(3);

      if (directrizRows && directrizRows.length > 0) {
        // Si hay directriz específica para la clase de pretensión, preferirla
        const claseBusqueda = caso.clase_pretension ?? params.clase_pretension;
        const directrizClase = claseBusqueda
          ? directrizRows.find((d) => d.clase_pretension === claseBusqueda)
          : null;
        const directrizSeleccionada = directrizClase ?? directrizRows[0];

        textoDirectriz = `[${directrizSeleccionada.nombre}]\n${directrizSeleccionada.texto_extraido ?? ""}`;
      }
    }

    // 6. Construir prompt y llamar a Claude
    const prompt = construirPrompt(caso, params, textoDemanda, lineamientos || textoDirectriz);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const respuestaTexto = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // 6. Parsear respuesta y mapear secciones
    const secciones = parsearRespuestaIA(respuestaTexto);

    // 7. Crear ficha en BD
    // Extraer solo los campos que pertenecen a fichas_conciliacion
    // (pretension, clase_pretension, jurisdiccion pertenecen a casos)
    const {
      pretension: _p,
      clase_pretension: _cp,
      jurisdiccion: _j,
      ...paramsFicha
    } = params;

    const fichaData = {
      caso_id,
      creado_por: user.id,
      ...paramsFicha,
      ...secciones,
      estado: "borrador" as const,
      ia_prompt_usado: prompt,
      ia_respuesta_cruda: respuestaTexto,
    };

    const { data: ficha, error: fichaError } = await supabase
      .from("fichas_conciliacion")
      .insert(fichaData)
      .select("id")
      .single();

    if (fichaError) {
      console.error("Error guardando ficha:", fichaError.message, fichaError.details, fichaError.hint);
      return NextResponse.json(
        { error: `Error guardando ficha: ${fichaError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ficha_id: ficha.id,
      secciones,
      tokens_usados: message.usage,
    });

  } catch (error) {
    console.error("Error en /api/generar-ficha:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
