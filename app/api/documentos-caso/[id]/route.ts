import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

async function getDocDelUsuario(supabase: ReturnType<typeof sb>, docId: string, userId: string) {
  const { data: doc } = await supabase
    .from("documentos_caso")
    .select("id, storage_path, nombre_archivo, caso_id, casos!inner(abogado_id)")
    .eq("id", docId)
    .single();
  if (!doc) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const abogadoId = (doc.casos as any)?.abogado_id;
  if (abogadoId !== userId) return null;
  return doc;
}

// ── GET: URL firmada de descarga (1 hora) ──────────────────────────────────────
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const doc = await getDocDelUsuario(supabase, params.id, user.id);
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const { data, error } = await supabase.storage
    .from("documentos-lexcode")
    .createSignedUrl(doc.storage_path, 60 * 60);

  if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, nombre: doc.nombre_archivo });
}

// ── DELETE: eliminar documento (Storage + registro) ────────────────────────────
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const doc = await getDocDelUsuario(supabase, params.id, user.id);
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  await supabase.storage.from("documentos-lexcode").remove([doc.storage_path]);
  const { error } = await supabase.from("documentos_caso").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
