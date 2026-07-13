import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";

export const maxDuration = 60;

const TIPOS_VALIDOS = ["traslado_demanda", "acto_administrativo", "historia_laboral", "anexo"];
// Tipos cuyo texto se extrae y alimenta la generación de la ficha
const TIPOS_CON_EXTRACCION = ["traslado_demanda", "acto_administrativo", "historia_laboral"];

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

// ── GET: listar documentos de un caso ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const casoId = request.nextUrl.searchParams.get("caso_id");
  if (!casoId) return NextResponse.json({ error: "Falta caso_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("documentos_caso")
    .select("id, tipo_documento, nombre_archivo, mime_type, estado_procesamiento, error_procesamiento, created_at")
    .eq("caso_id", casoId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documentos: data });
}

// ── POST: subir documento + extraer texto + estructurar acto administrativo ───
export async function POST(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await request.formData();
  const casoId = formData.get("caso_id") as string;
  const tipoDocumento = formData.get("tipo_documento") as string;
  const archivo = formData.get("archivo") as File | null;

  if (!casoId || !tipoDocumento || !archivo) {
    return NextResponse.json({ error: "Faltan campos: caso_id, tipo_documento, archivo" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(tipoDocumento)) {
    return NextResponse.json({ error: `Tipo inválido. Válidos: ${TIPOS_VALIDOS.join(", ")}` }, { status: 400 });
  }

  // Verificar que el caso pertenece al usuario (o es admin)
  const { data: caso } = await supabase
    .from("casos")
    .select("id, abogado_id")
    .eq("id", casoId)
    .single();
  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const esPdf = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");

  // 1. Subir a Storage — carpeta por usuario (política RLS del bucket)
  const timestamp = Date.now();
  const nombreSaneado = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/casos/${casoId}/${tipoDocumento}/${timestamp}_${nombreSaneado}`;

  const { error: upErr } = await supabase.storage
    .from("documentos-lexcode")
    .upload(storagePath, buffer, { contentType: archivo.type || "application/octet-stream" });
  if (upErr) return NextResponse.json({ error: `Error al subir: ${upErr.message}` }, { status: 500 });

  // 2. Registrar en documentos_caso
  const { data: doc, error: docErr } = await supabase
    .from("documentos_caso")
    .insert({
      caso_id: casoId,
      tipo_documento: tipoDocumento,
      nombre_archivo: archivo.name,
      storage_path: storagePath,
      mime_type: archivo.type,
      estado_procesamiento: TIPOS_CON_EXTRACCION.includes(tipoDocumento) ? "procesando" : "ok",
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (docErr || !doc) return NextResponse.json({ error: docErr?.message }, { status: 500 });

  // 3. Extracción de texto (solo tipos que alimentan la ficha)
  let estadoFinal = "ok";
  let advertencia: string | null = null;

  if (TIPOS_CON_EXTRACCION.includes(tipoDocumento)) {
    if (!esPdf) {
      estadoFinal = "error";
      advertencia = "Solo se admite PDF para extracción de texto. El archivo quedó almacenado pero no se procesó.";
      await supabase.from("documentos_caso")
        .update({ estado_procesamiento: "error", error_procesamiento: advertencia })
        .eq("id", doc.id);
    } else {
      try {
        const texto = await extraerTextoPDF(buffer);
        if (!texto || texto.length < 50) {
          // PDF escaneado sin capa de texto
          estadoFinal = "error";
          advertencia = "El PDF no contiene texto extraíble (posible documento escaneado). Requiere transcripción manual.";
          await supabase.from("documentos_caso")
            .update({ estado_procesamiento: "error", error_procesamiento: advertencia })
            .eq("id", doc.id);
          await crearPendienteDocumento(supabase, casoId, user.id, archivo.name, advertencia);
        } else {
          await supabase.from("documentos_caso")
            .update({ estado_procesamiento: "ok", texto_extraido: texto })
            .eq("id", doc.id);

          // 4. Acto administrativo → extracción estructurada con Claude
          if (tipoDocumento === "acto_administrativo") {
            try {
              const datos = await extraerDatosActo(texto);
              await supabase.from("actos_administrativos").insert({
                caso_id: casoId,
                documento_id: doc.id,
                ...datos,
              });
            } catch (e) {
              advertencia = "Documento almacenado y texto extraído, pero falló la estructuración automática del acto.";
              console.error("extraerDatosActo:", e);
            }
          }
        }
      } catch (e) {
        estadoFinal = "error";
        advertencia = "Error al procesar el PDF.";
        console.error("extraccion documento:", e);
        await supabase.from("documentos_caso")
          .update({ estado_procesamiento: "error", error_procesamiento: advertencia })
          .eq("id", doc.id);
        await crearPendienteDocumento(supabase, casoId, user.id, archivo.name, advertencia);
      }
    }
  }

  return NextResponse.json({ documento_id: doc.id, estado: estadoFinal, advertencia });
}

// ── Extracción estructurada de acto administrativo ────────────────────────────
async function extraerDatosActo(texto: string) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const prompt = `Eres un asistente jurídico especializado en seguridad social colombiana.
Analiza el texto de un acto administrativo de Colpensiones (resolución, certificación, etc.)
y extrae ÚNICAMENTE los datos que aparezcan explícitamente. Si un dato no aparece, devuelve null.
NO inventes ni infieras datos que no estén en el texto.

TEXTO DEL ACTO:
${texto.slice(0, 15000)}

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional):
{
  "numero_acto": "número de la resolución o acto, ej: SUB-123456" o null,
  "fecha_acto": "YYYY-MM-DD" o null,
  "tipo_acto": "resolucion_reconoce" | "resolucion_niega" | "resuelve_recurso" | "certificacion" | "otro",
  "sentido_decision": "resumen del sentido de la decisión en una frase" o null,
  "prestacion": "prestación discutida (vejez, invalidez, sobrevivientes, etc.)" o null,
  "semanas_reconocidas": número o null,
  "tasa_aplicada": número decimal (porcentaje) o null,
  "ingreso_base": número entero (pesos) o null,
  "resumen": "resumen de los argumentos de la entidad en 2-3 oraciones basado SOLO en el texto"
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const respuesta = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respuesta IA sin JSON");

  const datos = JSON.parse(jsonMatch[0]);
  return {
    numero_acto: datos.numero_acto ?? null,
    fecha_acto: datos.fecha_acto ?? null,
    tipo_acto: datos.tipo_acto ?? "otro",
    sentido_decision: datos.sentido_decision ?? null,
    prestacion: datos.prestacion ?? null,
    semanas_reconocidas: datos.semanas_reconocidas ?? null,
    tasa_aplicada: datos.tasa_aplicada ?? null,
    ingreso_base: datos.ingreso_base ?? null,
    resumen: datos.resumen ?? null,
    datos_extraidos: datos,
  };
}

// ── Pendiente automático por documento no procesable ──────────────────────────
async function crearPendienteDocumento(
  supabase: ReturnType<typeof sb>,
  casoId: string,
  userId: string,
  nombreArchivo: string,
  detalle: string
) {
  try {
    const { data: existente } = await supabase
      .from("pendientes")
      .select("id")
      .eq("caso_id", casoId)
      .eq("motivo", "documento_ilegible")
      .eq("estado", "pendiente")
      .maybeSingle();

    let pendienteId = existente?.id;
    if (!pendienteId) {
      const { data: nuevo } = await supabase
        .from("pendientes")
        .insert({
          caso_id: casoId,
          motivo: "documento_ilegible",
          descripcion: detalle,
          creado_por: userId,
        })
        .select("id")
        .single();
      pendienteId = nuevo?.id;
    }
    if (pendienteId) {
      await supabase.from("acciones_pendiente").insert({
        pendiente_id: pendienteId,
        tipo: "documento_error",
        descripcion: `${nombreArchivo}: ${detalle}`,
        creado_por: userId,
      });
    }
  } catch (e) {
    console.error("crearPendienteDocumento:", e);
  }
}
