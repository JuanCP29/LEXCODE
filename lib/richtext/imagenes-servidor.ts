import { imageSize } from "image-size";
import { extraerImagenes } from "@/lib/richtext/html";

export type ImagenCargada = { data: Buffer; width: number; height: number; tipo: string };

/**
 * Descarga las imágenes incrustadas (por URL pública) y devuelve un mapa
 * url -> { buffer, ancho, alto } para incrustarlas en Word/PDF. Se llama una vez
 * antes de generar el documento; las imágenes que fallen simplemente se omiten.
 */
export async function precargarImagenes(
  htmls: (string | null | undefined)[]
): Promise<Map<string, ImagenCargada>> {
  const urls = new Set<string>();
  htmls.forEach((h) => extraerImagenes(h).forEach((u) => { if (u.startsWith("http")) urls.add(u); }));

  const mapa = new Map<string, ImagenCargada>();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = Buffer.from(await res.arrayBuffer());
        const dim = imageSize(data);
        if (!dim.width || !dim.height) return;
        mapa.set(url, { data, width: dim.width, height: dim.height, tipo: dim.type || "png" });
      } catch {
        /* imagen inaccesible -> se omite */
      }
    })
  );
  return mapa;
}
