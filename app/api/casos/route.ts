import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const formData = await request.formData();

    // ── Campos del caso ──────────────────────────────────────────────────
    const radicado           = formData.get("radicado") as string;
    const radicado_bizagi    = formData.get("radicado_bizagi") as string | null;
    const nombre_demandante  = formData.get("nombre_demandante") as string;
    const cedula_demandante  = formData.get("cedula_demandante") as string | null;
    const expediente_pensional = formData.get("expediente_pensional") as string | null;
    const despacho           = formData.get("despacho") as string | null;
    const pretension         = formData.get("pretension") as string | null;
    const clase_pretension   = formData.get("clase_pretension") as string | null;
    const jurisdiccion       = formData.get("jurisdiccion") as string | null;

    if (!radicado || !nombre_demandante) {
      return NextResponse.json(
        { error: "Radicado y nombre del demandante son obligatorios" },
        { status: 400 }
      );
    }

    // ── Archivos ──────────────────────────────────────────────────────────
    const demanda_pdf   = formData.get("demanda_pdf") as File | null;
    const excel_proceso = formData.get("excel_proceso") as File | null;
    const lineamientos  = formData.get("lineamientos") as File | null;

    // ── Crear el caso ─────────────────────────────────────────────────────
    const { data: caso, error: casoError } = await supabase
      .from("casos")
      .insert({
        radicado,
        radicado_bizagi:     radicado_bizagi    || null,
        nombre_demandante,
        cedula_demandante:   cedula_demandante  || null,
        expediente_pensional: expediente_pensional || null,
        despacho:            despacho           || null,
        pretension:          pretension         || null,
        clase_pretension:    clase_pretension   || null,
        jurisdiccion:        jurisdiccion       || null,
        estado:              "activo",
        abogado_id:          user.id,
      })
      .select()
      .single();

    if (casoError) {
      if (casoError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un caso con ese número de radicado" },
          { status: 409 }
        );
      }
      throw casoError;
    }

    // ── Subir archivos ────────────────────────────────────────────────────
    const archivosParaSubir: Array<{
      file: File;
      tipo: "demanda_pdf" | "excel_proceso" | "lineamientos";
    }> = [];

    if (demanda_pdf)   archivosParaSubir.push({ file: demanda_pdf,   tipo: "demanda_pdf" });
    if (excel_proceso) archivosParaSubir.push({ file: excel_proceso, tipo: "excel_proceso" });
    if (lineamientos)  archivosParaSubir.push({ file: lineamientos,  tipo: "lineamientos" });

    for (const { file, tipo } of archivosParaSubir) {
      const ext = file.name.split(".").pop();
      const storagePath = `${user.id}/${caso.id}/${tipo}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("documentos-lexcode")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error(`Error subiendo ${tipo}:`, uploadError);
        continue;
      }

      await supabase.from("archivos_proceso").insert({
        caso_id:        caso.id,
        tipo,
        storage_path:   storagePath,
        nombre_original: file.name,
      });
    }

    return NextResponse.json({ caso_id: caso.id }, { status: 201 });
  } catch (error) {
    console.error("Error creando caso:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
