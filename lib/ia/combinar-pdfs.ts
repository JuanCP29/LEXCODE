import { PDFDocument } from "pdf-lib";

/**
 * Combina VARIOS PDFs en uno solo (traslado primero, luego las resoluciones/actuaciones),
 * con presupuesto de páginas para no exceder los límites de la API ni el tiempo de la función.
 * Compartido por los endpoints que leen el paquete por visión.
 */
export async function combinarPDFsBase64(
  pdfs: { nombre: string; buffer: Buffer }[],
  opts: { trasladoMax?: number; otrosMax?: number; totalMax?: number } = {}
): Promise<{ base64: string; paginas: number } | null> {
  const { trasladoMax = 25, otrosMax = 12, totalMax = 50 } = opts;
  try {
    const traslado = pdfs.find((p) => /traslad/i.test(p.nombre)) ?? pdfs[0];
    const otros = pdfs.filter((p) => p !== traslado);
    const ordenados = [traslado, ...otros];
    const out = await PDFDocument.create();
    let total = 0;
    for (let i = 0; i < ordenados.length; i++) {
      if (total >= totalMax) break;
      const src = await PDFDocument.load(ordenados[i].buffer, { ignoreEncryption: true });
      const max = i === 0 ? trasladoMax : otrosMax;
      const n = Math.min(max, src.getPageCount(), totalMax - total);
      if (n <= 0) continue;
      const pages = await out.copyPages(src, Array.from({ length: n }, (_, k) => k));
      pages.forEach((p) => out.addPage(p));
      total += n;
    }
    if (total === 0) return null;
    return { base64: Buffer.from(await out.save()).toString("base64"), paginas: total };
  } catch (e) {
    console.error("combinarPDFsBase64:", e);
    return null;
  }
}
