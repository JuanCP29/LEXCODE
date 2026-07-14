import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";

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

    // Los archivos se suben directo del navegador a Storage (evita el límite
    // de 4.5MB de Vercel); aquí llegan solo las rutas.
    const { paths } = await request.json() as { paths: { path: string; nombre: string }[] };

    if (!paths || paths.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron archivos" },
        { status: 400 }
      );
    }

    // Extraer texto de cada PDF descargándolo de Storage
    const textos: string[] = [];
    for (const { path, nombre } of paths) {
      if (!path.startsWith(`${user.id}/`)) continue; // solo rutas del usuario
      try {
        const { data: archivoData, error: dlErr } = await supabase.storage
          .from("documentos-lexcode")
          .download(path);
        if (dlErr || !archivoData) throw new Error(dlErr?.message);
        const buffer = Buffer.from(await archivoData.arrayBuffer());
        const texto = await extraerTextoPDF(buffer);
        textos.push(`=== ${nombre} ===\n${texto}`);
      } catch {
        textos.push(`=== ${nombre} ===\n[No se pudo extraer el texto]`);
      }
    }

    // Limpieza de archivos temporales (best-effort)
    supabase.storage
      .from("documentos-lexcode")
      .remove(paths.filter((p) => p.path.includes("/tmp/")).map((p) => p.path))
      .catch(() => {});

    const textoCompleto = textos.join("\n\n");

    const prompt = `Eres un asistente juridico especializado en derecho laboral y seguridad social colombiana.
Analiza el texto extraido de documentos del proceso (Sentencia, AOE, SUB u otros) y extrae los datos listados.
Si un dato no aparece o no es claro, devuelve null para ese campo.

DOCUMENTOS:
${textoCompleto.slice(0, 15000)}

Devuelve UNICAMENTE un objeto JSON valido con estos campos (sin texto adicional):
{
  "resolucion_prestacion": "numero de resolucion SUB o FONDO o null",
  "semanas_cotizadas": numero entero o null,
  "tasa_aplicada": numero decimal porcentaje o null,
  "tasa_solicitada": numero decimal porcentaje o null,
  "cuantia_tipo": "determinada" o "indeterminada" o null,
  "cuantia_valor": numero entero pesos colombianos o null,
  "hay_fallo": true si hay sentencia de primera instancia o false o null,
  "sintesis_fallo": "resumen del fallo en 2-3 oraciones" o null,
  "pretende_intereses": true o false o null,
  "pretende_indexacion": true o false o null
}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
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

    const campos = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      campos,
      archivos_procesados: paths.map((p) => p.nombre),
    });
  } catch (e) {
    console.error("analizar-documentos-extra:", e);
    return NextResponse.json(
      { error: "Error al analizar documentos" },
      { status: 500 }
    );
  }
}
