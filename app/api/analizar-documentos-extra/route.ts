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

// Combina VARIOS PDFs en uno solo (traslado primero, luego las resoluciones/actuaciones),
// con presupuesto de paginas para no exceder los limites de la API.
async function combinarPDFsBase64(
  pdfs: { nombre: string; buffer: Buffer }[],
  opts: { trasladoMax?: number; otrosMax?: number; totalMax?: number } = {}
): Promise<{ base64: string; paginas: number } | null> {
  const { trasladoMax = 25, otrosMax = 12, totalMax = 50 } = opts;
  try {
    const traslado = pdfs.find((p) => /traslad/i.test(p.nombre)) ?? pdfs[0];
    const otros = pdfs.filter((p) => p !== traslado);
    const ordenados = [traslado, ...otros];
    const out = await PDFDocument.create();
    let total = 0;
    for (let i = 0; i < ordenados.length; i++) {
      if (total >= totalMax) break;
      const src = await PDFDocument.load(ordenados[i].buffer, { ignoreEncryption: true });
      const max = i === 0 ? trasladoMax : otrosMax;
      const n = Math.min(max, src.getPageCount(), totalMax - total);
      if (n <= 0) continue;
      const pages = await out.copyPages(src, Array.from({ length: n }, (_, k) => k));
      pages.forEach((p) => out.addPage(p));
      total += n;
    }
    if (total === 0) return null;
    return { base64: Buffer.from(await out.save()).toString("base64"), paginas: total };
  } catch (e) {
    console.error("combinarPDFsBase64:", e);
    return null;
  }
}

// Reglas de redaccion comunes a HECHOS y PRETENSIONES (secciones 1 y 2 de la ficha).
const REGLAS_REDACCION = `- La demanda puede enumerar sus puntos con NUMEROS ("1.", "1)", "1-") o con ORDINALES EN PALABRA ("Primero.", "Segundo.", "Tercero." ... "Septimo.", "Octavo.", "Noveno.", "Decimo.", "Decimo primero.", "Undecimo.", "Duodecimo.", "Decimo tercero.", etc.). DETECTA AMBOS formatos. Recorre la seccion desde el PRIMER punto hasta el ULTIMO, que es el que aparece justo antes de que empiece la siguiente seccion (p. ej. los HECHOS terminan donde comienza "PRETENSIONES").
- INCLUYE ABSOLUTAMENTE TODOS los puntos, SIN EXCEPCION, aunque alguno sea un argumento juridico, doctrinal, jurisprudencial o de contexto (no solo hechos facticos). Presta especial atencion al ULTIMO punto de la seccion: es el que mas se suele omitir. Cada item enumerado debe aparecer en tu resultado.
- Los puntos pueden estar SEPARADOS por imagenes, tablas, capturas de pantalla o pruebas intercaladas; eso NO interrumpe la numeracion: continua con el siguiente ordinal aunque haya contenido no textual en medio.
- Reenumera tu resultado con "1)", "2)", "3)"... en el MISMO orden, separando cada uno del siguiente con una LINEA EN BLANCO (doble salto de linea).
- El TOTAL de puntos de tu resultado debe ser EXACTAMENTE igual al total que enumera la demanda (si van de Primero a Noveno, deben ser 9, de 1) a 9)). NO unas dos en uno, NO omitas ninguno, NO agregues puntos que no existan. Resume cada uno en 1 a 3 frases.
- Escribe en TERCERA PERSONA. Refierete al demandante como "el senor <NOMBRE>" o "la senora <NOMBRE>" (o "el/la demandante"). NUNCA uses "mi apoderado", "mi poderdante", "mi representado", "mi mandante" ni primera persona: es un resumen elaborado por la parte demandada (Colpensiones), no por el abogado que presento la demanda.
- Recoge UNICAMENTE lo que consta en el documento (fechas, resoluciones, semanas, montos, negativas, argumentos). No inventes ni interpretes.`;

// Lee un traslado ESCANEADO con visión de Claude: localiza las secciones HECHOS y PRETENSIONES y las resume.
type SeccionesTraslado = {
  sintesis_hechos: string | null;
  pretensiones: string | null;
  cuantia: string | null;
  normas: string | null;
  problema_juridico: string | null;
  consideraciones: string | null;
};

async function analizarTrasladoVision(
  anthropic: Anthropic,
  pdfs: { nombre: string; buffer: Buffer }[],
  despacho?: string | null
): Promise<SeccionesTraslado> {
  const vacio: SeccionesTraslado = { sintesis_hechos: null, pretensiones: null, cuantia: null, normas: null, problema_juridico: null, consideraciones: null };
  if (pdfs.length === 0) return vacio;
  // Combina el traslado (demanda) con las demas actuaciones/resoluciones cargadas.
  const recorte = await combinarPDFsBase64(pdfs);
  if (!recorte) return vacio;

  // La jurisdicción se determina por el despacho (autoritativo cuando se conoce).
  const esAdministrativo = /administrativ/i.test(despacho ?? "");
  const jurisdiccionDirectiva = despacho
    ? (esAdministrativo
        ? `JURISDICCION DEL CASO: CONTENCIOSO ADMINISTRATIVA (el despacho es "${despacho}", un Juzgado/Tribunal Administrativo). Por tanto, en el campo "problema_juridico" DEBES OBLIGATORIAMENTE iniciar por la procedencia de la declaratoria de NULIDAD del acto administrativo o resolucion demandada, siguiendo la estructura del caso CONTENCIOSO ADMINISTRATIVA del punto E, tomando el/los numero(s) de resolucion y fecha(s) que aparezcan en la demanda.`
        : `JURISDICCION DEL CASO: ORDINARIA LABORAL (el despacho es "${despacho}"). En "problema_juridico" usa la estructura del caso ORDINARIA LABORAL del punto E.`)
    : `JURISDICCION DEL CASO: determinala segun el documento (ver punto E).`;

  const prompt = `Este PAQUETE contiene el TRASLADO de una demanda laboral/pensional y, ademas, puede incluir una o varias
RESOLUCIONES u OFICIOS de COLPENSIONES (las "ultimas actuaciones relacionadas": numeros que empiezan por SUB, DPE, GNR, VPB,
DIR, HL o BZ), que son la respuesta previa de la entidad a la reclamacion del ciudadano. Puede estar escaneado (imagenes).
${jurisdiccionDirectiva}
De la DEMANDA (traslado) extrae las secciones A) a E). De las RESOLUCIONES/OFICIOS de Colpensiones elabora la seccion F).

A) HECHOS -> campo "sintesis_hechos". Seccion titulada "HECHOS" (o "HECHOS DE LA DEMANDA", "III. HECHOS").
B) PRETENSIONES -> campo "pretensiones". Seccion titulada "PRETENSIONES" (o "PETICIONES").
   Para A) y B) aplica EXACTAMENTE estas reglas:
${REGLAS_REDACCION}
   TIEMPO VERBAL (importante):
   - En A) HECHOS: redacta en TIEMPO PASADO (p. ej. "cotizo", "solicito", "nego", "fallecio").
   - En B) PRETENSIONES: redacta las pretensiones y condenas solicitadas en TIEMPO PRESENTE (modo subjuntivo de peticion).
     Usa "Que se declare", "Que se condene", "Que se ordene", "Que se reconozca", "Que se pague", "Que se reliquide".
     NO uses pasado como "Que se declarara", "Que se condenara", "Que se ordenara", "Que se reconociera".

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

E) PROBLEMA JURIDICO -> campo "problema_juridico". Redacta el PLANTEAMIENTO DEL PROBLEMA JURIDICO en UN SOLO PARRAFO,
   como PLANTEAMIENTO DE LA CONTROVERSIA (NO en forma de pregunta: no uses signos "¿ ?" ni termines con "?").

   Usa la JURISDICCION indicada arriba (o, si no se indico, deducela: CONTENCIOSO ADMINISTRATIVA cuando el despacho es un
   Juzgado/Tribunal Administrativo o la demanda invoca el medio de control de "nulidad y restablecimiento del derecho";
   ORDINARIA LABORAL cuando es un Juzgado Laboral del Circuito o Municipal).

   REDACCION SEGUN LA JURISDICCION:
   * CONTENCIOSO ADMINISTRATIVA: el planteamiento DEBE INICIAR por determinar la PROCEDENCIA DE LA DECLARATORIA DE NULIDAD del
     acto administrativo o resolucion demandada. Usa la estructura: "Determinar si se debe declarar la nulidad [total o parcial]
     de la Resolucion No <numero> del <fecha> mediante la cual COLPENSIONES <reconocio/nego/liquido ...>, [y del acto
     administrativo ficto o presunto por la no contestacion del recurso, cuando aplique,] y si, como consecuencia de ello,
     hay lugar a <la accion principal> con el correspondiente retroactivo e intereses moratorios o indexacion." Usa el o los
     numeros de resolucion y las fechas que consten en la demanda.
   * ORDINARIA LABORAL: usa la estructura "Determinar si <nucleo de la controversia respecto de la accion principal>, y si,
     como consecuencia de ello, hay lugar a <la accion principal> con el correspondiente retroactivo e intereses moratorios o
     indexacion."

   En AMBOS casos ATERRIZA a UNA SOLA ACCION PRINCIPAL (RELIQUIDACION si ya goza de pension; RECONOCIMIENTO si no la tiene;
   NULIDAD/reincorporacion si se discute traslado de regimen). NO menciones costas procesales ni agencias en derecho.
   Tercera persona, formal, COLPENSIONES como demandada. Si no puedes determinar la controversia, pon null.

F) CONSIDERACIONES -> campo "consideraciones". Es la seccion MAS IMPORTANTE. Analiza LAS RESOLUCIONES u OFICIOS de COLPENSIONES
   presentes en el paquete (SUB, DPE, GNR, VPB, DIR, HL, BZ) —la respuesta previa de la entidad, negativa o parcialmente
   positiva— frente a lo que hoy se reclama. Redactala siguiendo esta ESTRUCTURA, en TERCERA PERSONA, formal y tecnico, extensa
   (varios parrafos). Cuando el analisis lo amerite, USA SUBTITULOS breves (p. ej. "MARCO NORMATIVO", "CALCULO DE SEMANAS Y TASA
   DE REEMPLAZO", "ANALISIS DEL CASO", "CONCLUSION Y POSTURA"). Usa UNICAMENTE lo que conste; no inventes cifras ni normas.

   (1) ENCUADRE + RAZONES: enmarca brevemente la controversia e identifica con precision LAS RAZONES por las que Colpensiones
       nego o reconocio parcialmente (motivacion, normas y calculos usados: IBL, tasa de reemplazo, semanas, fechas de
       causacion y efectividad), citando los numeros de resolucion y fechas que consten.

   (2) MARCO NORMATIVO ADAPTADO AL TIPO DE PRESTACION: identifica el tipo de prestacion en disputa y trae SUS normas propias,
       TRANSCRIBIENDO ENTRE COMILLAS los articulos clave y APLICANDOLOS a las cifras del expediente:
       - VEJEZ / RELIQUIDACION: Ley 100 de 1993 arts. 21 (IBL), 33 (semanas) y 34 (monto), con la modificacion de la Ley 797 de
         2003; incluye y aplica la formula "r = 65,50 - 0,50 s" y el incremento de 1,5% por cada 50 semanas adicionales.
       - SOBREVIVIENTES: Ley 100 arts. 46 y 47 (mod. arts. 12 y 13 de la Ley 797); principio de la norma vigente al momento del
         fallecimiento y la condicion mas beneficiosa (Acuerdo 049 de 1990 cuando aplique).
       - INDEMNIZACION SUSTITUTIVA: Ley 100 art. 37 y Decreto 1730 de 2001; incluye y aplica la formula "I = SBC x SC x PPC".
       - REGIMEN DE TRANSICION: Ley 100 art. 36 y art. 48 de la Constitucion.
       - INEFICACIA DE TRASLADO: deber de informacion, ineficacia del traslado y reincorporacion al Regimen de Prima Media.

   (3) MARCO JURISPRUDENCIAL E INSTITUCIONAL: cita precedentes aplicables con su radicado (Corte Constitucional SU/C/T, Corte
       Suprema Sala Laboral SL, Consejo de Estado) y, si constan, lineamientos, directrices o circulares de Colpensiones.

   (4) CONCLUSION Y POSTURA (OBLIGATORIA AL FINAL): fija expresamente la postura de Colpensiones y una RECOMENDACION clara:
       si la actuacion de la entidad se ajusto a derecho, concluye que es "juridicamente viable continuar ejerciendo la defensa
       judicial y NO acceder a formula conciliatoria"; si hay aspectos favorables al demandante o incertidumbre, senala los
       puntos susceptibles de revisar o conciliar. Cierra siempre con esta postura/recomendacion.

   Si en el paquete NO hay resoluciones/oficios de Colpensiones, elabora el analisis con las resoluciones mencionadas en la
   demanda; si aun asi no hay informacion suficiente, pon null.

REGLA DE FORMATO JSON (CRITICA): dentro de los valores de texto NUNCA uses comillas dobles rectas ("). Para citar o
TRANSCRIBIR articulos, sentencias o textos, usa SIEMPRE comillas angulares « » (o comillas simples '). Esto es obligatorio para
no invalidar el JSON. Usa \\n para los saltos de linea.

Devuelve UNICAMENTE un JSON con esta forma exacta:
{ "sintesis_hechos": "1) ...\\n\\n2) ...", "pretensiones": "1) ...\\n\\n2) ...", "cuantia": "La cuantia fue estimada...", "normas": "• Ley ...\\n• Decreto ...", "problema_juridico": "Determinar si ...", "consideraciones": "..." }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
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
      problema_juridico: limpiar(parsed?.problema_juridico),
      consideraciones: limpiar(parsed?.consideraciones),
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
    let despachoHint: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json() as { paths: { path: string; nombre: string }[]; despacho?: string | null };
      const { paths } = body;
      despachoHint = body.despacho?.trim() || null;
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
    const soloUtil = (s: string) =>
      s.replace(/=== .*? ===/g, "")
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .replace(/\[No se pudo extraer el texto\]/gi, "")
        .replace(/\s+/g, " ")
        .trim().length;
    const caracteresExtraidos = soloUtil(textoCompleto);
    // Texto útil del TRASLADO específicamente (documento principal para las secciones 1-4 + problema).
    const trasladoIdx = pdfs.findIndex((p) => /traslad/i.test(p.nombre));
    const idxPrincipal = trasladoIdx >= 0 ? trasladoIdx : 0;
    const trasladoChars = textos[idxPrincipal] ? soloUtil(textos[idxPrincipal]) : caracteresExtraidos;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // ── Usar VISIÓN si el paquete no tiene texto útil, o si el TRASLADO está escaneado (aunque otras
    //    actuaciones traigan texto): la visión lee todos los PDFs como imágenes y genera las 6 secciones. ──
    if (caracteresExtraidos < 200 || trasladoChars < 200) {
      const vision = await analizarTrasladoVision(anthropic, pdfs, despachoHint);
      const encontrados = [vision.sintesis_hechos, vision.pretensiones, vision.cuantia, vision.normas, vision.problema_juridico, vision.consideraciones].filter(Boolean);
      return NextResponse.json({
        campos: {},
        suggestions: {
          sintesis_hechos: vision.sintesis_hechos,
          pretensiones: vision.pretensiones,
          cuantia: vision.cuantia,
          normas: vision.normas,
          problema_juridico: vision.problema_juridico,
          consideraciones: vision.consideraciones,
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
- FORMATO JSON (CRITICO): dentro de los valores de texto NUNCA uses comillas dobles rectas ("). Para citar o TRANSCRIBIR
  articulos, sentencias o textos usa SIEMPRE comillas angulares « » (o comillas simples '), para no invalidar el JSON.

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
    "pretensiones": "sintesis de las PRETENSIONES de la demanda (busca la seccion 'PRETENSIONES' o 'PETICIONES' del traslado). Detecta ordinales en numero o en palabra e INCLUYE TODAS. ENUMERA '1)', '2)', '3)'... separando cada una con LINEA EN BLANCO (\\n\\n), con EXACTAMENTE el mismo numero de pretensiones que la demanda, tercera persona, sin 'mi apoderado'/'mi poderdante' ni primera persona. TIEMPO PRESENTE (subjuntivo de peticion): 'Que se declare', 'Que se condene', 'Que se ordene', 'Que se reconozca', 'Que se pague'; NO uses 'Que se declarara/condenara/ordenara'. Solo lo que conste. Devuelve el texto o null.",
    "cuantia": "busca la seccion 'CUANTIA', 'COMPETENCIA Y CUANTIA' o 'ESTIMACION DE LA CUANTIA'. Devuelve EXACTAMENTE la frase 'La cuantia fue estimada por la parte actora, en <VALOR>.' donde <VALOR> es el monto en FORMATO MONEDA con simbolo '$', miles con punto y decimales con coma (ej '$275.353.309,53'), SIN escribir 'COP' ni 'pesos'; si esta en salarios minimos dejalo como '20 SMLMV'. Si no hay valor, null.",
    "normas": "busca la seccion 'FUNDAMENTOS Y RAZONES DE DERECHO', 'NORMAS VIOLADAS' o 'CONCEPTO DE VIOLACION'. Relaciona la normatividad CONSOLIDANDO por norma: cada ley/decreto/codigo/Constitucion aparece UNA SOLA VEZ listando TODOS sus articulos juntos, separados por coma y ordenados. UNA norma por linea, y cada linea DEBE EMPEZAR con una vineta '• ' (ej '• Ley 100 de 1993, articulos 9, 10, 34, 141'). Sin repetir. No inventes. Devuelve el texto o null.",
    "problema_juridico": "PLANTEAMIENTO DEL PROBLEMA JURIDICO en UN SOLO PARRAFO, como planteamiento de la controversia (NO en forma de pregunta, sin signos '¿ ?'). SEGUN LA JURISDICCION: si es CONTENCIOSO ADMINISTRATIVA (Juzgado o Tribunal Administrativo, o medio de control de nulidad y restablecimiento del derecho), INICIA por la procedencia de la nulidad: 'Determinar si se debe declarar la nulidad [total/parcial] de la Resolucion No <numero> del <fecha> mediante la cual COLPENSIONES <reconocio/nego...>, y si, como consecuencia, hay lugar a <accion principal> con retroactivo e intereses o indexacion'; si es ORDINARIA LABORAL, usa 'Determinar si <controversia>, y si, como consecuencia, hay lugar a <accion principal> con retroactivo e intereses o indexacion'. ATERRIZA a UNA SOLA ACCION (reliquidacion si ya goza de pension; reconocimiento si no; nulidad/reincorporacion si traslado). NO menciones costas procesales. Tercera persona, COLPENSIONES demandada. Si no se puede determinar, null.",
    "consideraciones": "SECCION MAS IMPORTANTE. Analiza las RESOLUCIONES/OFICIOS de COLPENSIONES (SUB, DPE, GNR, VPB, DIR, HL, BZ) que consten (su respuesta previa a lo reclamado). Estructura, en tercera persona, formal y extensa (con SUBTITULOS breves cuando ayude): (1) ENCUADRE + RAZONES por las que Colpensiones nego/reconocio parcialmente (motivacion, IBL, tasa de reemplazo, semanas, fechas, numeros de resolucion); (2) MARCO NORMATIVO ADAPTADO AL TIPO DE PRESTACION, TRANSCRIBIENDO ENTRE COMILLAS los articulos clave y APLICANDOLOS a las cifras: VEJEZ/RELIQUIDACION -> Ley 100 arts. 21, 33, 34 (mod. Ley 797) y formula 'r = 65,50 - 0,50 s' + 1,5% por 50 semanas; SOBREVIVIENTES -> arts. 46, 47 (mod. 12, 13 Ley 797), norma vigente al fallecimiento y condicion mas beneficiosa (Acuerdo 049/1990); INDEMNIZACION SUSTITUTIVA -> art. 37 y Decreto 1730/2001, formula 'I = SBC x SC x PPC'; TRANSICION -> art. 36 y art. 48 CN; INEFICACIA DE TRASLADO -> deber de informacion y reincorporacion a RPM; (3) JURISPRUDENCIA con radicado (SU/C/T, SL, Consejo de Estado) e lineamientos de Colpensiones; (4) CONCLUSION Y POSTURA OBLIGATORIA al final con recomendacion clara de conciliar o no ('viable continuar la defensa y NO acceder a formula conciliatoria', o los aspectos a revisar). Solo lo que conste. Si no hay resoluciones, usa las mencionadas en la demanda; si no hay info suficiente, null.",
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

    // El JSON puede venir mal formado (p. ej. comillas dobles sin escapar dentro de una
    // transcripcion). En ese caso NO se cae la peticion: se reintenta el analisis por VISIÓN,
    // que lee todos los PDFs como imagenes y tiene su propio manejo de errores.
    let parsed: { data?: Record<string, unknown>; suggestions?: Record<string, unknown> } | null = null;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (errParse) {
      console.error("JSON del camino de texto invalido, reintentando por visión:", errParse);
      const vision = await analizarTrasladoVision(anthropic, pdfs, despachoHint);
      const encontrados = [vision.sintesis_hechos, vision.pretensiones, vision.cuantia, vision.normas, vision.problema_juridico, vision.consideraciones].filter(Boolean);
      return NextResponse.json({
        campos: {},
        suggestions: {
          sintesis_hechos: vision.sintesis_hechos,
          pretensiones: vision.pretensiones,
          cuantia: vision.cuantia,
          normas: vision.normas,
          problema_juridico: vision.problema_juridico,
          consideraciones: vision.consideraciones,
        },
        fieldsFound: 0,
        suggestionsFound: encontrados.length,
        caracteres_extraidos: encontrados.length > 0 ? 999 : caracteresExtraidos,
        escaneado: true,
        archivos_procesados: textos.length,
      });
    }
    // Compatibilidad: si la IA devolvió el formato plano antiguo, tratarlo como data.
    const campos = (parsed?.data ?? parsed ?? {}) as Record<string, unknown>;
    const suggestions = (parsed?.suggestions ?? {}) as Record<string, unknown>;

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
