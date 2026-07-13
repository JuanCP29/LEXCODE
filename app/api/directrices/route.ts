import { NextRequest, NextResponse } from "next/server";
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

// GET — listar directrices (filtro opcional ?pretension=vejez)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const pretension = searchParams.get("pretension");

    let query = supabase
      .from("directrices_conciliacion")
      .select("id, nombre, codigo, fecha_directriz, pretension, clase_pretension, nombre_original, activo, created_at, directriz_tipologias(tipologia_id, tipologias(id, nombre, parent_id))")
      .order("pretension")
      .order("nombre");

    if (pretension) {
      query = query.or(`pretension.eq.${pretension},pretension.eq.general`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ directrices: data });
  } catch (e) {
    console.error("GET /api/directrices:", e);
    return NextResponse.json({ error: "Error al obtener directrices" }, { status: 500 });
  }
}

// POST — subir nueva directriz (solo admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // Verificar rol admin
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfil?.rol !== "admin") {
      return NextResponse.json({ error: "Solo administradores pueden gestionar directrices" }, { status: 403 });
    }

    const formData = await request.formData();
    const archivo  = formData.get("archivo") as File | null;
    const nombre   = formData.get("nombre") as string;
    const pretension      = formData.get("pretension") as string;
    const clase_pretension = formData.get("clase_pretension") as string | null;
    const codigo           = formData.get("codigo") as string | null;
    const fecha_directriz  = formData.get("fecha_directriz") as string | null;
    const tipologiasRaw    = formData.get("tipologia_ids") as string | null; // JSON array de UUIDs

    if (!archivo || !nombre || !pretension) {
      return NextResponse.json({ error: "Faltan campos requeridos: archivo, nombre, pretension" }, { status: 400 });
    }

    let tipologiaIds: string[] = [];
    try {
      tipologiaIds = tipologiasRaw ? JSON.parse(tipologiasRaw) : [];
    } catch { /* array vacío si viene malformado */ }

    // Extraer texto del PDF
    let textoExtraido = "";
    try {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      textoExtraido = await extraerTextoPDF(buffer);
    } catch {
      textoExtraido = "[No se pudo extraer el texto automáticamente]";
    }

    // Subir PDF a Storage
    const storagePath = `directrices/${pretension}/${Date.now()}_${archivo.name}`;
    const arrayBuffer = await archivo.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("directrices-lexcode")
      .upload(storagePath, arrayBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload:", uploadError);
      // Continuar sin storage si falla — el texto ya está extraído
    }

    // Insertar en DB
    const { data: directriz, error: insertError } = await supabase
      .from("directrices_conciliacion")
      .insert({
        nombre,
        pretension,
        clase_pretension: clase_pretension || null,
        codigo: codigo || null,
        fecha_directriz: fecha_directriz || null,
        storage_path: uploadError ? null : storagePath,
        nombre_original: archivo.name,
        texto_extraido: textoExtraido,
        subido_por: user.id,
        activo: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Asociar a tipologías
    if (tipologiaIds.length > 0) {
      const { error: relError } = await supabase.from("directriz_tipologias").insert(
        tipologiaIds.map((tid) => ({ directriz_id: directriz.id, tipologia_id: tid }))
      );
      if (relError) console.error("directriz_tipologias insert:", relError);
    }

    return NextResponse.json({ directriz }, { status: 201 });
  } catch (e) {
    console.error("POST /api/directrices:", e);
    return NextResponse.json({ error: "Error al crear directriz" }, { status: 500 });
  }
}
