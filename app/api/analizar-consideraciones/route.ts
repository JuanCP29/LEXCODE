import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { combinarPDFsBase64 } from "@/lib/ia/combinar-pdfs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

// Reglas de la seccion CONSIDERACIONES (fuente exclusiva: resoluciones/oficios de Colpensiones).
const REGLAS_CONSIDERACIONES = `Redacta UNICAMENTE la seccion CONSIDERACIONES de la Ficha de Conciliacion (campo unico "consideraciones").
Analiza LAS RESOLUCIONES u OFICIOS de COLPENSIONES presentes (numeros que empiezan por SUB, DPE, GNR, VPB, DIR, HL o BZ) —la
respuesta previa de la entidad, negativa o parcialmente positiva— frente a lo que hoy se reclama. Tercera persona, formal y
tecnico, extensa (varios parrafos), con SUBTITULOS breves cuando ayude (p. ej. "MARCO NORMATIVO", "CALCULO DE SEMANAS Y TASA DE
REEMPLAZO", "ANALISIS DEL CASO", "CONCLUSION Y POSTURA"). Usa UNICAMENTE lo que conste; no inventes cifras ni normas.

FUENTE EXCLUSIVA: construye TODA la seccion —incluidas las normas, la jurisprudencia y los lineamientos— UNICAMENTE con lo que
digan las RESOLUCIONES/OFICIOS de Colpensiones. NO incorpores ni relaciones informacion del TRASLADO/demanda: ni sus hechos,
pretensiones, normas ni jurisprudencia. Solo se citan normas y sentencias que aparezcan en dichas resoluciones/oficios.

ESTRUCTURA:
(1) ENCUADRE + RAZONES: enmarca brevemente la controversia e identifica con precision LAS RAZONES por las que Colpensiones nego o
    reconocio parcialmente (motivacion, normas y calculos usados: IBL, tasa de reemplazo, semanas, fechas de causacion y
    efectividad), citando los numeros de resolucion y fechas que consten.
(2) MARCO NORMATIVO: trae las normas que LAS RESOLUCIONES/OFICIOS citan o aplican (NO las de la demanda), TRANSCRIBIENDO ENTRE
    COMILLAS los articulos clave y APLICANDOLOS a las cifras del expediente. Usa como referencia de QUE BUSCAR segun la prestacion,
    citando solo lo que conste en las resoluciones: VEJEZ/RELIQUIDACION -> Ley 100 arts. 21, 33, 34 (mod. Ley 797) y formula
    "r = 65,50 - 0,50 s" + 1,5% por 50 semanas; SOBREVIVIENTES -> arts. 46, 47 (mod. 12, 13 Ley 797), norma vigente al
    fallecimiento y condicion mas beneficiosa (Acuerdo 049/1990); INDEMNIZACION SUSTITUTIVA -> art. 37 y Decreto 1730/2001,
    formula "I = SBC x SC x PPC"; TRANSICION -> art. 36 y art. 48 CN; INEFICACIA DE TRASLADO -> deber de informacion y
    reincorporacion a RPM.
(3) MARCO JURISPRUDENCIAL E INSTITUCIONAL: precedentes con radicado (Corte Constitucional SU/C/T, CSJ Sala Laboral SL, Consejo de
    Estado) y lineamientos, directrices, circulares, conceptos, memorandos u oficios de la Oficina Asesora de lo Legal (OAL) de
    Colpensiones, UNICAMENTE si se MENCIONAN en las resoluciones/oficios. NO tomes precedentes ni normatividad del traslado/demanda.

ROBUSTECIMIENTO CON EL REPOSITORIO INSTITUCIONAL: mas abajo puede incluirse un bloque "REPOSITORIO INSTITUCIONAL" con documentos
(directrices, memorandos, lineamientos, conceptos, OAL). Si alguna sentencia, concepto, memorando, OAL, circular, directriz o
lineamiento MENCIONADO en las resoluciones/oficios COINCIDE con un documento del repositorio, APOYATE en su contenido para
ROBUSTECER el analisis (transcribe/parafrasea lo pertinente) y CITALO entre parentesis (p. ej. «(Repositorio: Memorando OAL 016)»).
Usa el repositorio SOLO cuando coincida con algo mencionado en las resoluciones; no lo uses para introducir temas ajenos al caso.
(4) CONCLUSION Y POSTURA (OBLIGATORIA AL FINAL): fija la postura de Colpensiones y una RECOMENDACION clara: si la actuacion de la
    entidad se ajusto a derecho, concluye que es "juridicamente viable continuar ejerciendo la defensa judicial y NO acceder a
    formula conciliatoria"; si hay aspectos favorables al demandante o incertidumbre, senala los puntos a revisar o conciliar.

Si NO hay resoluciones/oficios de Colpensiones en el paquete, NO construyas el marco con la demanda: limita la seccion al encuadre
y la postura con lo que conste en actuaciones de la entidad; si no hay base suficiente, devuelve null.

No uses comillas dobles rectas dentro del texto: usa comillas angulares « » (o simples '). Usa \\n para saltos de linea.
Responde UNICAMENTE con un JSON valido: { "consideraciones": "<texto o null>" }`;

const soloUtil = (s: string) =>
  s.replace(/=== .*? ===/g, "")
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\[No se pudo extraer el texto\]/gi, "")
    .replace(/\s+/g, " ")
    .trim().length;

/**
 * Seccion CONSIDERACIONES. Endpoint aparte (disparado por el cliente tras "Analizar con IA")
 * para no exceder el limite de 60s de Vercel Hobby: cada llamada genera una sola seccion.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as {
      paths?: { path: string; nombre: string }[];
      despacho?: string | null;
      pretension?: string | null;
      textoDocs?: string | null; // texto ya extraído por el análisis principal (evita re-ingerir)
    };
    const paths = body.paths ?? [];

    // Preferir el texto que ya extrajo el análisis principal (rápido; evita re-descargar
    // y re-parsear). Solo se descarga y se usa visión como respaldo cuando NO hay texto útil.
    const textoDocs = (body.textoDocs ?? "").trim();
    const tieneTextoUtil = soloUtil(textoDocs) >= 200;

    const pdfs: { nombre: string; buffer: Buffer }[] = [];
    let textoCompleto = textoDocs;

    if (!tieneTextoUtil) {
      if (paths.length === 0) return NextResponse.json({ consideraciones: null });
      const textos: string[] = [];
      for (const { path, nombre } of paths) {
        if (!path.startsWith(`${user.id}/`)) continue;
        try {
          const { data, error } = await supabase.storage.from("documentos-lexcode").download(path);
          if (error || !data) throw new Error(error?.message);
          const buffer = Buffer.from(await data.arrayBuffer());
          pdfs.push({ nombre, buffer });
          textos.push(`=== ${nombre} ===\n${await extraerTextoPDF(buffer)}`);
        } catch (e) {
          console.error(`extraccion ${nombre}:`, e);
          textos.push(`=== ${nombre} ===\n[No se pudo extraer el texto]`);
        }
      }
      if (pdfs.length === 0) return NextResponse.json({ consideraciones: null });
      textoCompleto = textos.join("\n\n");
    }
    const contexto = `PRETENSION DEL CASO: ${body.pretension ?? "No especificada"}${body.despacho ? `\nDESPACHO: ${body.despacho}` : ""}`;

    // Repositorio institucional para robustecer (coincidencias con lo mencionado en las
    // resoluciones/oficios). Se acota para no inflar el prompt ni el tiempo.
    const TIPO_LABEL: Record<string, string> = {
      directriz: "Directriz", memorando: "Memorando", lineamiento: "Lineamiento", otro: "Documento",
    };
    const { data: repoDocs } = await supabase
      .from("directrices_conciliacion")
      .select("nombre, codigo, tipo_documento, texto_extraido")
      .eq("activo", true)
      .limit(6);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fuentesRepo = ((repoDocs ?? []) as any[])
      .map((d) => `### ${TIPO_LABEL[d.tipo_documento ?? "directriz"] ?? "Documento"} (${d.codigo ? `${d.codigo} — ` : ""}${d.nombre})\n${(d.texto_extraido ?? "").slice(0, 8000)}`)
      .join("\n\n");
    const bloqueRepo = fuentesRepo
      ? `\n\nREPOSITORIO INSTITUCIONAL (usalo SOLO si coincide con algo mencionado en las resoluciones/oficios):\n${fuentesRepo}`
      : "";

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Escaneado (poco texto util) -> VISION; con texto -> camino de texto.
    const escaneado = soloUtil(textoCompleto) < 200;
    let respuesta = "";
    if (escaneado) {
      const recorte = await combinarPDFsBase64(pdfs, { trasladoMax: 6, otrosMax: 14, totalMax: 20 });
      if (!recorte) return NextResponse.json({ consideraciones: null });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: recorte.base64 } },
            { type: "text", text: `${contexto}${bloqueRepo}\n\n${REGLAS_CONSIDERACIONES}` },
          ],
        }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    } else {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `${contexto}\n\nDOCUMENTOS:\n${textoCompleto.slice(0, 30000)}${bloqueRepo}\n\n${REGLAS_CONSIDERACIONES}`,
        }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    }

    const m = respuesta.match(/\{[\s\S]*\}/);
    let consideraciones: string | null = null;
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        const val = parsed?.consideraciones;
        consideraciones = val && String(val).trim() && String(val).trim().toLowerCase() !== "null" ? String(val).trim() : null;
      } catch { /* JSON invalido -> null */ }
    }
    return NextResponse.json({ consideraciones });
  } catch (e) {
    console.error("analizar-consideraciones:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
