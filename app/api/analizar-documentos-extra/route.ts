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

// Reglas de redaccion comunes a HECHOS y PRETENSIONES (secciones 1 y 2 de la ficha).
const REGLAS_REDACCION = `- ENUMERA cada punto con el formato "1)", "2)", "3)"... en el MISMO orden de la demanda, separando cada uno del siguiente con una LINEA EN BLANCO (doble salto de linea).
- Debe haber EXACTAMENTE el MISMO numero de puntos que enumera la demanda en esa seccion (si la demanda lista 14, deben ser 14, de 1) a 14)). NO unas dos en uno, NO omitas ninguno, NO agregues puntos que no existan. Resume cada uno en 1 o 2 frases.
- Escribe en TERCERA PERSONA. Refierete al demandante como "el senor <NOMBRE>" o "la senora <NOMBRE>" (o "el/la demandante"). NUNCA uses "mi apoderado", "mi poderdante", "mi representado", "mi mandante" ni primera persona: es un resumen elaborado por la parte demandada (Colpensiones), no por el abogado que presento la demanda.
- Usa TIEMPO PASADO.
- Recoge UNICAMENTE lo que consta en el documento (fechas, resoluciones, semanas, montos, negativas). No inventes ni interpretes.`;

// Lee un traslado ESCANEADO con visión de Claude: localiza las secciones HECHOS y PRETENSIONES y las resume.
type SeccionesTraslado = {
  sintesis_hechos: string | null;
  pretensiones: string | null;
  cuantia: string | null;
  normas: string | null;
};

async function analizarTrasladoVision(
  anthropic: Anthropic,
  pdfs: { nombre: string; buffer: Buffer }[]
): Promise<SeccionesTraslado> {
  const vacio: SeccionesTraslado = { sintesis_hechos: null, pretensiones: null, cuantia: null, normas: null };
  if (pdfs.length === 0) return vacio;
  // Prioriza el documento cuyo nombre sugiere "traslado"; si no, el primero.
  const doc = pdfs.find((p) => /traslad/i.test(p.nombre)) ?? pdfs[0];
  const recorte = await recortarPaginasBase64(doc.buffer, 30);
  if (!recorte) return vacio;

  const prompt = `Este documento es el TRASLADO de una demanda laboral/pensional (puede estar escaneado, en imagenes).
Debes localizar y resumir CUATRO secciones de la demanda:

A) HECHOS -> campo "sintesis_hechos". Seccion titulada "HECHOS" (o "HECHOS DE LA DEMANDA", "III. HECHOS").
B) PRETENSIONES -> campo "pretensiones". Seccion titulada "PRETENSIONES" (o "PETICIONES").
   Para A) y B) aplica EXACTAMENTE estas reglas:
${REGLAS_REDACCION}

C) CUANTIA -> campo "cuantia". Busca la seccion titulada "CUANTIA", "COMPETENCIA Y CUANTIA" o "ESTIMACION DE LA CUANTIA".
   Devuelve EXACTAMENTE la frase: "La cuantia fue estimada por la parte actora, en <VALOR>." donde <VALOR> es el monto en
   FORMATO DE MONEDA con simbolo "$", separadores de miles con PUNTO y decimales con COMA (ej. "$275.353.309,53").
   NO escribas "COP" ni "pesos". Si el valor esta expresado en salarios minimos, dejalo como "20 SMLMV".
   Si no encuentras el valor de la cuantia, pon null.

D) NORMAS -> campo "normas". Busca la seccion titulada "FUNDAMENTOS Y RAZONES DE DERECHO", "NORMAS VIOLADAS" o
   "CONCEPTO DE VIOLACION". Relaciona la normatividad citada CONSOLIDANDO por norma: cada ley, decreto, codigo o la
   Constitucion debe aparecer UNA SOLA VEZ, listando TODOS sus articulos juntos, separados por coma y en orden ascendente.
   UNA norma por linea, y cada linea DEBE EMPEZAR con una vineta "• " (bullet + espacio). Ejemplos de formato:
   "• Ley 100 de 1993, articulos 9, 10, 14, 22, 34, 141"
   "• Constitucion Politica, articulos 48, 53"
   "• Decreto 692 de 1994"
   NO repitas la misma norma en varias lineas. No inventes normas que no consten. Si no encuentras la seccion, pon null.

Devuelve UNICAMENTE un JSON con esta forma exacta:
{ "sintesis_hechos": "1) ...\\n\\n2) ...", "pretensiones": "1) ...\\n\\n2) ...", "cuantia": "La cuantia fue estimada...", "normas": "Ley ...\\nDecreto ..." }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
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
    if (!m) return vacio;
    const parsed = JSON.parse(m[0]);
    const limpiar = (s: unknown) =>
      s && String(s).trim() && String(s).trim().toLowerCase() !== "null" ? String(s).trim() : null;
    return {
      sintesis_hechos: limpiar(parsed?.sintesis_hechos),
      pretensiones: limpiar(parsed?.pretensiones),
      cuantia: limpiar(parsed?.cuantia),
      normas: limpiar(parsed?.normas),
    };
  } catch (e) {
    console.error("analizarTrasladoVision:", e);
    return vacio;
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

    // ── Documento ESCANEADO (sin capa de texto): leer HECHOS y PRETENSIONES con visión ──
    if (caracteresExtraidos < 200) {
      const vision = await analizarTrasladoVision(anthropic, pdfs);
      const encontrados = [vision.sintesis_hechos, vision.pretensiones, vision.cuantia, vision.normas].filter(Boolean);
      return NextResponse.json({
        campos: {},
        suggestions: {
          sintesis_hechos: vision.sintesis_hechos,
          pretensiones: vision.pretensiones,
          cuantia: vision.cuantia,
          normas: vision.normas,
        },
        fieldsFound: 0,
        suggestionsFound: encontrados.length,
        caracteres_extraidos: encontrados.length > 0 ? 999 : caracteresExtraidos,
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
    "sintesis_hechos": "sintesis de los HECHOS de la demanda (busca la seccion 'HECHOS' del traslado). ENUMERA cada hecho con formato '1)', '2)', '3)'... separando cada hecho con una LINEA EN BLANCO (doble salto de linea, \\n\\n), con EXACTAMENTE el mismo numero de hechos que la demanda. Tercera persona ('el senor <NOMBRE>' / 'la senora <NOMBRE>'), tiempo pasado, sin usar 'mi apoderado', 'mi poderdante' ni primera persona (lo redacta la parte demandada). Solo lo que conste. Devuelve el texto o null.",
    "pretensiones": "sintesis de las PRETENSIONES de la demanda (busca la seccion 'PRETENSIONES' o 'PETICIONES' del traslado). Mismas reglas que sintesis_hechos: ENUMERA '1)', '2)', '3)'... separando cada una con LINEA EN BLANCO (\\n\\n), con EXACTAMENTE el mismo numero de pretensiones que la demanda, tercera persona, tiempo pasado, sin 'mi apoderado'/'mi poderdante' ni primera persona. Solo lo que conste. Devuelve el texto o null.",
    "cuantia": "busca la seccion 'CUANTIA', 'COMPETENCIA Y CUANTIA' o 'ESTIMACION DE LA CUANTIA'. Devuelve EXACTAMENTE la frase 'La cuantia fue estimada por la parte actora, en <VALOR>.' donde <VALOR> es el monto en FORMATO MONEDA con simbolo '$', miles con punto y decimales con coma (ej '$275.353.309,53'), SIN escribir 'COP' ni 'pesos'; si esta en salarios minimos dejalo como '20 SMLMV'. Si no hay valor, null.",
    "normas": "busca la seccion 'FUNDAMENTOS Y RAZONES DE DERECHO', 'NORMAS VIOLADAS' o 'CONCEPTO DE VIOLACION'. Relaciona la normatividad CONSOLIDANDO por norma: cada ley/decreto/codigo/Constitucion aparece UNA SOLA VEZ listando TODOS sus articulos juntos, separados por coma y ordenados. UNA norma por linea, y cada linea DEBE EMPEZAR con una vineta '• ' (ej '• Ley 100 de 1993, articulos 9, 10, 34, 141'). Sin repetir. No inventes. Devuelve el texto o null.",
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
