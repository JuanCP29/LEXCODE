import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { construirContexto } from "@/lib/ficha/construir-contexto";
import {
  construirPromptV2,
  parsearRespuestaV2,
  planificarSecciones,
  PROMPT_VERSION,
  type ParametrosFichaV2,
} from "@/lib/ficha/construir-prompt-v2";

export const maxDuration = 120;

const MODELO = "claude-sonnet-4-6";

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { caso_id, params } = body as {
      caso_id: string;
      params: ParametrosFichaV2 & {
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

    // 2. Ensamblar contexto con fuentes controladas + validación de insumos
    const paramsPresentes = Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k]) => k);

    const contexto = await construirContexto(supabase, caso_id, user.id, paramsPresentes);

    // 3. Plan por sección: generar / N/A / vacía / directa
    const plan = planificarSecciones(contexto, params);
    const advertencias = plan
      .filter((p) => p.advertencia)
      .map((p) => ({ seccion: p.mapping.sectionNumber, detalle: p.advertencia! }));

    // 4. Llamada a Claude solo con las secciones generables
    const prompt = construirPromptV2(caso, params, contexto, plan);
    let respuestaTexto = "";

    if (prompt) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      respuestaTexto = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
    }

    // 5. Resolver secciones (IA + N/A + directas)
    const secciones = prompt
      ? parsearRespuestaV2(respuestaTexto, plan)
      : parsearRespuestaV2("{}", plan.filter((p) => p.accion !== "generar"));

    // 6. Crear ficha en BD
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
      ia_prompt_usado: prompt || null,
      ia_respuesta_cruda: respuestaTexto || null,
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

    // 7. Trazabilidad por sección (best-effort: no bloquea si la tabla no existe aún)
    try {
      const filasTrazabilidad = plan.map((p) => {
        const m = p.mapping;
        let fuenteId: string | null = null;
        if (p.accion === "generar") {
          if (m.primarySource === "traslado_demanda" || m.primarySource === "mixta") {
            fuenteId = contexto.traslado?.documento_id ?? null;
          } else if (m.primarySource === "directriz_colpensiones") {
            fuenteId = contexto.directriz?.directriz_id ?? null;
          } else if (m.primarySource === "acto_administrativo") {
            fuenteId = contexto.actos[0]?.acto_id ?? null;
          }
        }
        return {
          ficha_id: ficha.id,
          seccion: m.sectionNumber,
          fuente_tipo: p.accion === "generar" ? m.primarySource : "manual",
          fuente_id: fuenteId,
          modelo_ia: p.accion === "generar" ? MODELO : null,
          prompt_version: p.accion === "generar" ? PROMPT_VERSION : null,
          advertencias: p.advertencia ? { detalle: p.advertencia } : null,
          detalle: {
            accion: p.accion,
            fuentes_disponibles: {
              traslado: !!contexto.traslado,
              actos: contexto.actos.length,
              directriz: contexto.directriz
                ? { id: contexto.directriz.directriz_id, codigo: contexto.directriz.codigo, metodo: contexto.directriz.metodo }
                : null,
            },
          },
          creado_por: user.id,
        };
      });
      await supabase.from("ficha_seccion_fuentes").insert(filasTrazabilidad);
    } catch (e) {
      console.error("ficha_seccion_fuentes (no bloqueante):", e);
    }

    // 8. Pendiente automático si hay secciones críticas sin insumos
    const criticasVacias = plan.filter((p) => p.accion === "vacia");
    if (criticasVacias.length > 0) {
      try {
        const { data: existente } = await supabase
          .from("pendientes")
          .select("id")
          .eq("caso_id", caso_id)
          .eq("motivo", "insumos_incompletos")
          .eq("estado", "pendiente")
          .maybeSingle();

        let pendienteId = existente?.id;
        if (!pendienteId) {
          const { data: nuevo } = await supabase
            .from("pendientes")
            .insert({
              caso_id,
              motivo: "insumos_incompletos",
              descripcion: `Ficha generada con secciones incompletas: ${criticasVacias.map((p) => p.mapping.sectionNumber).join(", ")}.`,
              creado_por: user.id,
            })
            .select("id")
            .single();
          pendienteId = nuevo?.id;
        }
        if (pendienteId) {
          await supabase.from("acciones_pendiente").insert({
            pendiente_id: pendienteId,
            tipo: "nota",
            descripcion: `Ficha ${ficha.id}: secciones ${criticasVacias.map((p) => `${p.mapping.sectionNumber} (${p.advertencia})`).join("; ")}`,
            creado_por: user.id,
          });
        }
      } catch (e) {
        console.error("pendiente insumos_incompletos (no bloqueante):", e);
      }
    }

    return NextResponse.json({
      ficha_id: ficha.id,
      secciones,
      advertencias,
      fuentes: {
        traslado: contexto.traslado ? contexto.traslado.nombre_archivo : null,
        actos: contexto.actos.length,
        directriz: contexto.directriz
          ? `${contexto.directriz.codigo ?? ""} ${contexto.directriz.nombre}`.trim()
          : null,
      },
    });

  } catch (error) {
    console.error("Error en /api/generar-ficha:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
