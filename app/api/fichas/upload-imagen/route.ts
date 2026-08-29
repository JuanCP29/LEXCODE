import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "ficha-imagenes";
const MAX_BYTES = 4 * 1024 * 1024; // 4MB (límite práctico del body serverless)
const MIME_OK = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Crea el bucket público la primera vez (idempotente). Silencioso si ya existe.
async function asegurarBucket(supabase: ReturnType<typeof admin>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: MIME_OK,
  });
}

function extDe(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Sube una imagen embebida en una sección (p.ej. Consideraciones) a un bucket
 * público y devuelve su URL pública (persistente, apta para el editor y para
 * incrustarla luego en Word/PDF). Usa service-role para no exigir políticas RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const casoId = (form.get("caso_id") as string | null) ?? "misc";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    const mime = (file.type || "").toLowerCase();
    if (!MIME_OK.includes(mime)) {
      return NextResponse.json({ error: "Formato no admitido (usa PNG, JPG, GIF o WebP)" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera 4MB" }, { status: 413 });
    }

    const supabase = admin();
    await asegurarBucket(supabase);

    const carpeta = casoId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extDe(mime)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    console.error("upload-imagen:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
