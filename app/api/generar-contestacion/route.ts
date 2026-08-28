import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

type Seccion = "hechos" | "pretensiones" | "defensa";

const REGLAS: Record<Seccion, string> = {
  hechos: `Redacta el PRONUNCIAMIENTO EXPRESO FRENTE A LOS HECHOS DE LA DEMANDA para la contestacion de COLPENSIONES.
Responde a CADA hecho de la demanda, en su MISMO orden y con numeracion ordinal en palabra (AL PRIMERO, AL SEGUNDO, AL TERCERO,
... AL DECIMO, AL DECIMO PRIMERO, AL DECIMO SEGUNDO, etc.), tantos como hechos tenga la demanda. Para cada uno usa UNA postura:
ES CIERTO / NO ES CIERTO / ES CIERTO PARCIALMENTE / NO ME CONSTA (usa NO ME CONSTA para hechos ajenos a Colpensiones que deban
probarse por la parte interesada). Formato de cada linea: «AL PRIMERO: ES CIERTO, que <hecho reformulado en tercera persona>,
conforme documental obrante en el expediente y sin aceptar lo pretendido.» Apoyate en las RESOLUCIONES/EXPEDIENTE para determinar
la postura y las cifras (semanas, IBL, tasa, resoluciones, fechas). Solo lo que conste; no inventes. Tercera persona, formal.
No uses Markdown. Responde SOLO el texto.`,
  pretensiones: `Redacta el PRONUNCIAMIENTO EXPRESO FRENTE A LAS PRETENSIONES para la contestacion de COLPENSIONES.
Para CADA pretension de la demanda, en su orden (A LA PRIMERA, A LA SEGUNDA, A LA TERCERA, ...), redacta la oposicion de la
entidad. Formato: «A LA PRIMERA: ME OPONGO, a que <se declare/condene ... la pretension resumida>, toda vez que <razon de la
defensa: la prestacion ya fue reconocida/liquidada conforme a derecho; la actuacion administrativa se ajusto a la ley; etc.>.»
Fundamenta la oposicion en lo que conste en el expediente y en el analisis del caso. Solo lo que conste; no inventes. Tercera
persona, formal. No uses Markdown. Responde SOLO el texto.`,
  defensa: `Redacta los HECHOS, FUNDAMENTOS Y RAZONES DE LA DEFENSA (fundamentos de derecho de la defensa) de COLPENSIONES.
Narra por que la actuacion de la entidad se ajusto a derecho: las resoluciones expedidas (numeros y fechas), el reconocimiento/
reliquidacion de la prestacion, el IBL, la tasa de reemplazo, las semanas cotizadas y las normas aplicadas (Ley 100 de 1993 y su
modificacion por la Ley 797 de 2003, etc.), con la argumentacion juridica de la defensa. Apoyate en el ANALISIS DEL CASO
(consideraciones) y en el expediente que se incluyen abajo. Formal, tercera persona, extenso y bien estructurado. Solo lo que
conste; no inventes cifras ni normas. No uses Markdown. Responde SOLO el texto.`,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as { caso_id?: string; seccion?: Seccion };
    const { caso_id } = body;
    const seccion = body.seccion;
    if (!caso_id || !seccion || !REGLAS[seccion]) {
      return NextResponse.json({ error: "caso_id y seccion (hechos|pretensiones|defensa) son obligatorios" }, { status: 400 });
    }

    // Caso + texto del expediente (Fase 1) + última ficha (insumos ya procesados).
    const { data: caso } = await supabase
      .from("casos")
      .select("radicado, nombre_demandante, cedula_demandante, pretension, clase_pretension, jurisdiccion, despacho, texto_expediente")
      .eq("id", caso_id)
      .single();
    if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

    const { data: ficha } = await supabase
      .from("fichas_conciliacion")
      .select("sec_1_hechos, sec_2_pretensiones, sec_4_normas, sec_16_consideraciones, resolucion_prestacion")
      .eq("caso_id", caso_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Insumos por sección (se usan solo los pertinentes para acotar el prompt).
    const bloques: string[] = [
      `DATOS: Demandante ${caso.nombre_demandante}${caso.cedula_demandante ? ` (C.C. ${caso.cedula_demandante})` : ""} · Radicado ${caso.radicado} · Pretension ${caso.pretension ?? "—"}${caso.clase_pretension ? ` / ${caso.clase_pretension}` : ""} · Jurisdiccion ${caso.jurisdiccion ?? "—"}.`,
    ];
    if (seccion === "hechos") {
      bloques.push(`HECHOS DE LA DEMANDA (responde a cada uno):\n${ficha?.sec_1_hechos ?? "No disponibles."}`);
      bloques.push(`RESOLUCIONES / EXPEDIENTE (para determinar la postura y las cifras):\n${(caso.texto_expediente ?? "").slice(0, 25000)}`);
    } else if (seccion === "pretensiones") {
      bloques.push(`PRETENSIONES DE LA DEMANDA (oponte a cada una):\n${ficha?.sec_2_pretensiones ?? "No disponibles."}`);
      bloques.push(`ANALISIS DEL CASO (razones de la defensa):\n${(ficha?.sec_16_consideraciones ?? "").slice(0, 8000) || "No disponible."}`);
    } else {
      bloques.push(`ANALISIS DEL CASO (consideraciones):\n${(ficha?.sec_16_consideraciones ?? "").slice(0, 12000) || "No disponible."}`);
      bloques.push(`NORMAS INVOCADAS:\n${ficha?.sec_4_normas ?? "—"}`);
      bloques.push(`RESOLUCIONES / EXPEDIENTE:\n${(caso.texto_expediente ?? "").slice(0, 15000)}`);
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: seccion === "defensa" ? 2800 : 2400,
      messages: [{ role: "user", content: `${bloques.join("\n\n")}\n\n${REGLAS[seccion]}` }],
    });
    const texto = (msg.content[0]?.type === "text" ? msg.content[0].text : "").trim();
    return NextResponse.json({ texto: texto || null });
  } catch (e) {
    console.error("generar-contestacion:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
