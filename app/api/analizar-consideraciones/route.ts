import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { combinarPDFsBase64 } from "@/lib/ia/combinar-pdfs";
import { buscarCoincidenciasRepositorio, construirFuentesRepositorio } from "@/lib/ia/repositorio-match";

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

// El analisis se centra en la RESOLUCION OBJETO DE ANALISIS, no en todos los oficios del paquete.
const FOCO_RESOLUCION =
  "El analisis se centra UNICAMENTE en LA RESOLUCION OBJETO DE ANALISIS: la resolucion/oficio de COLPENSIONES demandada, es decir, " +
  "la que resolvio el ULTIMO recurso y agoto la via gubernativa (normalmente la actuacion MAS RECIENTE que decide de fondo la " +
  "reclamacion; en el paquete suele ser un oficio o resolucion DPE, DIR, GNR o VPB). NO hagas un recuento de todas las " +
  "resoluciones/oficios: usa las demas actuaciones (p. ej. la SUB inicial) SOLO como antecedente imprescindible y en la medida en " +
  "que la resolucion objeto de analisis las cite.";

// Reglas de la seccion CONSIDERACIONES (fuente exclusiva: resoluciones/oficios de Colpensiones).
const REGLAS_CONSIDERACIONES = `Redacta UNICAMENTE la seccion CONSIDERACIONES de la Ficha de Conciliacion (campo unico "consideraciones").
${FOCO_RESOLUCION}
Tercera persona, formal y
tecnico, de extension MODERADA y enfocada (aprox. 4 a 7 parrafos; se conciso, no divagues), con SUBTITULOS breves cuando ayude
(p. ej. "MARCO NORMATIVO", "CALCULO DE SEMANAS Y TASA DE REEMPLAZO", "ANALISIS DEL CASO", "CONCLUSION Y POSTURA"). Usa UNICAMENTE
lo que conste; no inventes cifras ni normas.

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
    Colpensiones que MENCIONEN las resoluciones/oficios. ADEMAS, ten en cuenta LA SENTENCIA MAS RELEVANTE identificada en la
    Seccion 4 (si abajo se incluye el bloque «JURISPRUDENCIA RELEVANTE IDENTIFICADA EN LA SECCION 4»): elige la de MAYOR relevancia
    para la pretension, analiza su ratio decidendi y su INCIDENCIA en el riesgo del caso.

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

Para transcribir articulos o textos usa comillas angulares « » (no comillas dobles rectas).
Responde UNICAMENTE con el TEXTO de la seccion (varios parrafos, con sus subtitulos si aplican), SIN JSON, sin comillas
envolventes y sin encabezados como "Consideraciones:". Si no hay base suficiente en actuaciones de la entidad, responde
exactamente la palabra: null`;

// En Vercel Hobby (60s) una sola llamada no alcanza a generar la seccion completa y detallada.
// Se divide en dos partes que el cliente pide en paralelo y concatena.
const REGLAS_PARTE1 = `Redacta la PRIMERA PARTE de la seccion CONSIDERACIONES de la Ficha de Conciliacion.
${FOCO_RESOLUCION}
Tercera persona, formal y tecnico. FUENTE EXCLUSIVA: solo las resoluciones/oficios; NO incorpores informacion del TRASLADO/demanda.
Incluye, con SUBTITULOS breves:
(1) ENCUADRE + RAZONES: por que Colpensiones nego o reconocio parcialmente (motivacion, IBL, tasa de reemplazo, semanas, fechas de
    causacion/efectividad, numeros de resolucion que consten).
(2) MARCO NORMATIVO: las normas que LAS RESOLUCIONES/OFICIOS citan o aplican (NO las de la demanda), TRANSCRIBIENDO ENTRE COMILLAS
    los articulos clave y APLICANDOLOS a las cifras del expediente (formulas segun prestacion: VEJEZ r=65,50-0,50s +1,5%/50sem;
    INDEMNIZACION I=SBC x SC x PPC; etc.). Cita solo lo que conste.
NO incluyas jurisprudencia ni conclusion/postura: eso va en otra parte. Termina justo despues del marco normativo.
No uses formato Markdown (nada de ** ni #); para resaltar usa MAYUSCULAS en los subtitulos.
Comillas angulares « ». Responde SOLO el texto, sin JSON ni encabezados. Si no hay resoluciones/oficios, responde: null`;

const REGLAS_PARTE2 = `Redacta la SEGUNDA PARTE de la seccion CONSIDERACIONES de la Ficha de Conciliacion. Ya se redactaron el encuadre y el
marco normativo; NO los repitas. ${FOCO_RESOLUCION} Tercera
persona, formal y tecnico. FUENTE EXCLUSIVA: solo resoluciones/oficios (y el repositorio institucional si coincide); NO el
TRASLADO/demanda. Incluye, con SUBTITULOS breves:
(3) MARCO JURISPRUDENCIAL E INSTITUCIONAL: precedentes con radicado (Corte Constitucional SU/C/T, CSJ Sala Laboral SL, Consejo de
    Estado) y lineamientos, directrices, circulares, conceptos, memorandos u oficios de la OAL de Colpensiones que MENCIONEN las
    resoluciones/oficios. ADEMAS, ten en cuenta LA SENTENCIA MAS RELEVANTE identificada en la Seccion 4 (si abajo se incluye el
    bloque «JURISPRUDENCIA RELEVANTE IDENTIFICADA EN LA SECCION 4»): elige la de MAYOR relevancia para la pretension, analiza su
    ratio decidendi y su INCIDENCIA en el riesgo del caso.
    ROBUSTECIMIENTO: si mas abajo se incluye un bloque "REPOSITORIO INSTITUCIONAL" que coincide con esa sentencia o con un concepto/
    memorando/OAL, APOYATE en su contenido y CITALO entre parentesis (p. ej. «(Repositorio: Memorando OAL 016)»).
(4) CONCLUSION Y POSTURA (OBLIGATORIA AL FINAL): postura de Colpensiones + recomendacion clara (si la actuacion se ajusto a derecho,
    "viable continuar la defensa judicial y NO acceder a formula conciliatoria"; si hay dudas, los puntos a revisar o conciliar).
En (3) se CONCISO (resume la ratio de cada sentencia en 1-2 frases; no transcribas en exceso) para RESERVAR espacio: la (4)
CONCLUSION Y POSTURA es obligatoria y debe quedar COMPLETA, nunca cortada. No uses formato Markdown (nada de ** para negritas ni #);
para resaltar, usa MAYUSCULAS en los subtitulos.
Empieza directamente con el subtitulo del marco jurisprudencial. Comillas angulares « ». Responde SOLO el texto, sin JSON ni
encabezados. Si no hay base, responde: null`;

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
      caso_id?: string | null;   // para leer el texto persistido del expediente (Fase 1)
      parte?: number;            // 1 = encuadre+normativo · 2 = jurisprudencia+conclusion · 0/omitido = completa
      normasSec4?: string | null; // Normas+Jurisprudencia de la Sección 4 (para traer la sentencia más relevante)
    };
    const paths = body.paths ?? [];
    const parte = body.parte === 1 ? 1 : body.parte === 2 ? 2 : 0;

    // Bloque de jurisprudencia identificada en la Sección 4 (solo lo posterior a "Jurisprudencia:").
    const normasSec4 = (body.normasSec4 ?? "").trim();
    const idxJ = normasSec4.search(/jurisprudencia\s*:/i);
    const jurisSec4 = idxJ >= 0 ? normasSec4.slice(idxJ) : "";

    // Preferir el texto que ya extrajo el análisis principal (rápido; evita re-descargar
    // y re-parsear). Si no viene, se usa el texto persistido del caso. Solo se descarga y se
    // usa visión como último respaldo cuando NO hay texto útil por ninguna vía.
    let textoDocs = (body.textoDocs ?? "").trim();
    if (soloUtil(textoDocs) < 200 && body.caso_id) {
      const { data: caso } = await supabase
        .from("casos")
        .select("texto_expediente")
        .eq("id", body.caso_id)
        .single();
      const persistido = (caso?.texto_expediente ?? "").trim();
      if (soloUtil(persistido) >= 200) textoDocs = persistido;
    }
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

    // Repositorio institucional + sentencia relevante de la Sección 4. Solo aplica a la parte 2
    // (o a la completa): la parte 1 no usa jurisprudencia, asi que evita ese input y va mas rapida.
    let bloqueRepo = "";
    let bloqueSec4 = "";
    if (parte !== 1) {
      // El emparejador cruza tanto las resoluciones como la sentencia identificada en la Sec. 4.
      const coincidencias = await buscarCoincidenciasRepositorio(supabase, `${textoCompleto}\n${jurisSec4}`);
      const fuentesRepo = construirFuentesRepositorio(coincidencias, 8000);
      bloqueRepo = fuentesRepo
        ? `\n\nREPOSITORIO INSTITUCIONAL (coincide con lo citado en el caso; usalo para robustecer):\n${fuentesRepo}`
        : "";
      bloqueSec4 = jurisSec4
        ? `\n\nJURISPRUDENCIA RELEVANTE IDENTIFICADA EN LA SECCION 4 (tenla en cuenta; elige la MAS relevante para la pretension y valora su incidencia en el riesgo del caso):\n${jurisSec4.slice(0, 1500)}`
        : "";
    }

    const reglas = parte === 1 ? REGLAS_PARTE1 : parte === 2 ? REGLAS_PARTE2 : REGLAS_CONSIDERACIONES;
    // Topes por parte, calibrados para caber en ~60s con margen (Hobby). La parte 1
    // (encuadre + normativo) es mas corta que la 2 (jurisprudencia + repo + conclusion).
    const maxTok = parte === 2 ? 2800 : parte === 1 ? 2200 : 2400;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Escaneado (poco texto util) -> VISION; con texto -> camino de texto.
    const escaneado = soloUtil(textoCompleto) < 200;
    let respuesta = "";
    if (escaneado) {
      const recorte = await combinarPDFsBase64(pdfs, { trasladoMax: 6, otrosMax: 14, totalMax: 20 });
      if (!recorte) return NextResponse.json({ consideraciones: null });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTok,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: recorte.base64 } },
            { type: "text", text: `${contexto}${bloqueRepo}${bloqueSec4}\n\n${reglas}` },
          ],
        }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    } else {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTok,
        messages: [{
          role: "user",
          content: `${contexto}\n\nDOCUMENTOS:\n${textoCompleto.slice(0, 30000)}${bloqueRepo}${bloqueSec4}\n\n${reglas}`,
        }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    }

    // Texto plano (robusto para texto largo). Limpia cercos de codigo y trata "null" como vacio.
    let texto = respuesta.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    // Si por compatibilidad viniera un JSON { "consideraciones": "..." }, lo aceptamos.
    if (texto.startsWith("{")) {
      try { const p = JSON.parse(texto); if (p?.consideraciones) texto = String(p.consideraciones).trim(); } catch { /* se usa tal cual */ }
    }
    const consideraciones = texto && texto.toLowerCase() !== "null" ? texto : null;
    return NextResponse.json({ consideraciones });
  } catch (e) {
    console.error("analizar-consideraciones:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
