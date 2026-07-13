import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { construirContexto } from "@/lib/ficha/construir-contexto";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

/**
 * GET — estado de insumos del caso para la generación de la ficha.
 * Los parámetros del formulario se evalúan en el cliente; aquí se reporta
 * el estado de las fuentes documentales, tipología y directriz.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // params del formulario que el cliente ya conoce (CSV opcional en query)
  const paramsCsv = request.nextUrl.searchParams.get("params") ?? "";
  const paramsPresentes = paramsCsv ? paramsCsv.split(",") : [];

  try {
    const contexto = await construirContexto(supabase, params.id, user.id, paramsPresentes);

    return NextResponse.json({
      fuentes: {
        traslado: contexto.traslado
          ? { nombre: contexto.traslado.nombre_archivo, caracteres: contexto.traslado.texto.length }
          : null,
        actos: contexto.actos.map((a) => ({
          numero: a.numero_acto,
          tipo: a.tipo_acto,
          fecha: a.fecha_acto,
        })),
        directriz: contexto.directriz
          ? { nombre: contexto.directriz.nombre, codigo: contexto.directriz.codigo, metodo: contexto.directriz.metodo }
          : null,
        tipologia: contexto.tieneTipologia,
        perfil: contexto.tienePerfil,
      },
      validacion: contexto.validacion,
    });
  } catch (e) {
    console.error("GET insumos:", e);
    return NextResponse.json({ error: "Error al evaluar insumos" }, { status: 500 });
  }
}
