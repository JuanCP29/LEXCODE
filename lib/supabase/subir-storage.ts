"use client";

/**
 * Sube un archivo directo del navegador a Supabase Storage.
 * Evita el límite de 4.5MB del body en las funciones serverless de Vercel:
 * el binario nunca pasa por la API — solo se envía la ruta.
 *
 * Las políticas RLS del bucket exigen que la primera carpeta sea el uid.
 */
import { createClient } from "@/lib/supabase/client";

export async function subirArchivoStorage(
  file: File,
  subcarpeta: string // ej. `casos/${casoId}/traslado_demanda` o `tmp`
): Promise<{ path: string; nombre: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const nombreSaneado = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${subcarpeta}/${Date.now()}_${nombreSaneado}`;

  const { error } = await supabase.storage
    .from("documentos-lexcode")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (error) throw new Error(`Error al subir a Storage: ${error.message}`);
  return { path, nombre: file.name };
}
