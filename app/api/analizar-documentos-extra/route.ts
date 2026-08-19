import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { PDFDocument } from "pdf-lib";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Recorta un PDF a sus primeras N páginas y lo devuelve en base64 (para leer escaneados con visión).
async function recortarPaginasBase64(buffer: Buffer, maxPaginas = 30): Promise<{ base64: string; paginas: number } | null> {
  try {
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    const n = Math.min(maxPaginas, total);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: n }, (_, i) => i);
    const paginas = await out.copyPages(src, indices);
    paginas.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    return { base64: Buffer.from(bytes).toString("base64"), paginas: n };
  } catch (e) {
    console.error("recortarPaginasBase64:", e);
    return null;
  }
}

// Lee un traslado ESCANEADO con visión de Claude: localiza la sección HECHOS y la resume.
async function sintesisHechosDesdeVision(
  anthropic: Anthropic,
  pdfs: { nombre: string; buffer: Buffer }[]
): Promise<string | null> {
  if (pdfs.length === 0) return null;
  // Prioriza el documento cuyo nombre sugiere "traslado"; si no, el primero.
  const doc = pdfs.find((p) => /traslad/i.test(p.nombre)) ?? pdfs[0];
  const recorte = await recortarPaginasBase64(doc.buffer, 30);
  if (!recorte) return null;

  const prompt = `Este documento es el TRASLADO de una demanda laboral/pensional escaneada (imagenes).
Localiza en el documento la seccion titulada "HECHOS" (encabezado que puede aparecer como "HECHOS", "HECHOS DE LA DEMANDA" o "III. HECHOS").
Lee los hechos numerados de esa seccion y redacta una SINTESIS clara, formal y en tercera persona, en 4 a 8 frases,
recogiendo unicamente lo que consta en el documento (fechas, prestacion reclamada, resoluciones, semanas, negativas de Colpensiones, etc.).
No inventes datos. Si NO logras ubicar la seccion HECHOS o el documento es ilegible, responde exactamente con null.
Devuelve UNICAMENTE un JSON: { "sintesis_hechos": "<texto>" }  o  { "sintesis_hechos": null }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: recorte.base64 } },
          { type: "text", text: prompt },
        ],
      }],
    });
    const txt = message.content[0]?.type === "text" ? message.content[0].text : "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const s = parsed?.sintesis_hechos;
    return s && String(s).trim() && String(s).trim().toLowerCase() !== "null" ? String(s).trim() : null;
  } catch (e) {
    console.error("sintesisHechosDesdeVision:", e);
    return null;
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // Formato nuevo: JSON con rutas de Storage (el archivo sube directo del
    // navegador, evitando el límite de 4.5MB de Vercel).
    // Formato legacy: FormData con archivos (clientes con JS en caché).
    const contentType = request.headers.get("content-type") ?? "";
    const textos: string[] = [];
    const pdfs: { nombre: string; buffer: Buffer }[] = [];
    let rutasTmp: string[] = [];

    if (contentType.includes("application/json")) {
      const { paths } = await request.json() as { paths: { path: string; nombre: string }[] };
      if (!paths || paths.length === 0) {
        return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
      }
      rutasTmp = paths.filter((p) => p.path.includes("/tmp/")).map((p) => p.path);

      for (const { path, nombre } of paths) {
        if (!path.startsWith(`${user.id}/`)) continue; // solo rutas del usuario
        try {
          const { data: archivoData, error: dlErr } = await supabase.storage
            .from("documentos-lexcode")
            .download(path);
          if (dlErr || !archivoData) throw new Error(dlErr?.message);
          const buffer = Buffer.from(await archivoData.arrayBuffer());
          pdfs.push({ nombre, buffer });
          const texto = await extraerTextoPDF(buffer);
          textos.push(`=== ${nombre} ===\n${texto}`);
        } catch (e) {
          console.error(`extraccion ${nombre}:`, e);
          textos.push(`=== ${nombre} ===\n[No se pudo extraer el texto]`);
        }
      }
    } else {
      // Legacy FormData (límite 4.5MB aplica)
      const formData = await request.formData();
      const archivos = formData.getAll("archivos") as File[];
      if (!archivos || archivos.length === 0) {
        return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
      }
      for (const archivo of archivos) {
        try {
          const buffer = Buffer.from(await archivo.arrayBuffer());
          pdfs.push({ nombre: archivo.name, buffer });
          const texto = await extraerTextoPDF(buffer);
          textos.push(`=== ${archivo.name} ===\n${texto}`);
        } catch (e) {
          console.error(`extraccion ${archivo.name}:`, e);
          textos.push(`=== ${archivo.name} ===\n[No se pudo extraer el texto]`);
        }
      }
    }

    // Limpieza de archivos temporales (best-effort)
    if (rutasTmp.length > 0) {
      supabase.storage.from("documentos-lexcode").remove(rutasTmp).catch(() => {});
    }

    const textoCompleto = textos.join("\n\n");
    // Caracteres de texto REALMENTE útiles: se descartan los encabezados "=== nombre ===",
    // los marcadores de página que emite pdf-parse en escaneados ("-- 1 of 156 --") y los
    // avisos de fallo, y se colapsan espacios. Así un PDF escaneado da ~0 y dispara la visión.
    const caracteresExtraidos = textoCompleto
      .replace(/=== .*? ===/g, "")
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
      .replace(/\[No se pudo extraer el texto\]/gi, "")
      .replace(/\s+/g, " ")
      .trim().length;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // ── Documento ESCANEADO (sin capa de texto): leer la sección HECHOS con visión ──
    if (caracteresExtraidos < 200) {
      const sintesis = await sintesisHechosDesdeVision(anthropic, pdfs);
      return NextResponse.json({
        campos: {},
        suggestions: { sintesis_hechos: sintesis ?? null },
        fieldsFound: 0,
        suggestionsFound: sintesis ? 1 : 0,
        caracteres_extraidos: sintesis ? 999 : caracteresExtraidos,
        escaneado: true,
        archivos_procesados: textos.length,
      });
    }

    // Extracción de DOS NIVELES (análisis multi-documento en una sola pasada):
    //  - data: hechos textuales verificables (null si no aparecen) → prellenan el formulario
    //  - suggestions: prosa redactada SOLO con base en las fuentes → el abogado copia y pega
    const prompt = `Eres un asistente juridico especializado en derecho laboral y seguridad social colombiana.
Analiza EN CONJUNTO el texto extraido de los documentos del proceso (Sentencia, AOE, SUB, traslado u otros)
y cruza la informacion entre ellos.

REGLAS ESTRICTAS:
- En "data" solo van datos TEXTUALES y verificables que aparezcan en los documentos. Si un dato no aparece, devuelve null.
- En "suggestions" redacta prosa juridica formal basada UNICAMENTE en lo que dicen los documentos. No inventes hechos,
  cifras, normas ni jurisprudencia que no consten en las fuentes.

DOCUMENTOS:
${textoCompleto.slice(0, 30000)}

Devuelve UNICAMENTE un objeto JSON valido con esta forma exacta (sin texto adicional):
{
  "data": {
    "resolucion_prestacion": "numero de resolucion SUB o FONDO o null",
    "semanas_cotizadas": numero entero o null,
    "tasa_aplicada": numero decimal porcentaje o null,
    "tasa_solicitada": numero decimal porcentaje o null,
    "cuantia_tipo": "determinada" o "indeterminada" o null,
    "cuantia_valor": numero entero pesos colombianos o null,
    "hay_fallo": true si hay sentencia de primera instancia o false o null,
    "sintesis_fallo": "resumen del fallo en 2-3 oraciones o null",
    "pretende_intereses": true o false o null,
    "pretende_indexacion": true o false o null
  },
  "suggestions": {
    "sintesis_hechos": "sintesis de los hechos del caso, redactada a partir de los documentos, o null",
    "consideraciones": "consideraciones juridicas basadas en las fuentes, o null",
    "evaluacion_riesgo": "evaluacion del riesgo procesal segun lo que consta, o null",
    "recomendacion": "recomendacion de conciliacion fundamentada en las fuentes, o null"
  }
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const respuesta =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "No se pudo extraer informacion estructurada" },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    // Compatibilidad: si la IA devolvió el formato plano antiguo, tratarlo como data.
    const campos = parsed.data ?? parsed;
    const suggestions = parsed.suggestions ?? {};

    const fieldsFound = Object.values(campos).filter((v) => v !== null && v !== undefined).length;
    const suggestionsFound = Object.values(suggestions).filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;

    return NextResponse.json({
      campos,          // se mantiene para el prellenado del formulario (retrocompatible)
      suggestions,     // prosa redactada para copiar-pegar en las secciones
      fieldsFound,
      suggestionsFound,
      caracteres_extraidos: caracteresExtraidos,
      archivos_procesados: textos.length,
    });
  } catch (e) {
    console.error("analizar-documentos-extra:", e);
    return NextResponse.json(
      { error: `Error al analizar documentos: ${e instanceof Error ? e.message : "desconocido"}` },
      { status: 500 }
    );
  }
}
