import PDFDocument from "pdfkit";

/**
 * Genera la Ficha de Conciliación Judicial en PDF replicando el formato
 * oficial GDJ-GPO-FMT-005 Versión 3 (14 secciones).
 */

export type DatosFichaPdf = {
  // Encabezado
  fecha_diligencia: string | null;
  radicado_bizagi: string | null;
  radicado: string | null;
  nombre_demandante: string | null;
  cedula_demandante: string | null;
  causante_afiliado: string | null;
  autoridad_citacion: string | null;   // despacho + juez
  caducidad: string | null;
  reconsideracion: string | null;       // 'SI' | 'NO'
  // 14 secciones (por clave de BD)
  [key: string]: string | null;
};

const DEMANDADO_FIJO = "ADMINISTRADORA COLOMBIANA DE PENSIONES – COLPENSIONES. Nit. 900.336.004-7";

// Títulos oficiales v3 en orden, con su columna de BD
const SECCIONES_PDF: { n: number; titulo: string; key: string }[] = [
  { n: 1,  titulo: "SÍNTESIS DE LOS HECHOS", key: "sec_1_hechos" },
  { n: 2,  titulo: "PRETENSIONES", key: "sec_2_pretensiones" },
  { n: 3,  titulo: "CUANTÍA", key: "sec_3_cuantia" },
  { n: 4,  titulo: "PRESUNTAS NORMAS VIOLADAS – FUNDAMENTOS DE DERECHO", key: "sec_4_normas" },
  { n: 5,  titulo: "SENTENCIA", key: "sec_6_sentencia" },
  { n: 6,  titulo: "ARGUMENTOS DE LA APELACIÓN", key: "sec_5_apelacion" },
  { n: 7,  titulo: "PLANTEAMIENTO DEL PROBLEMA JURÍDICO – HOMOLOGADO CON OBJETO CONCILIABLE", key: "sec_8_problema" },
  { n: 8,  titulo: "ANÁLISIS DE LA CADUCIDAD", key: "sec_9_caducidad" },
  { n: 9,  titulo: "JURISPRUDENCIA O PRECEDENTE JUDICIAL", key: "sec_11_jurisprudencia" },
  { n: 10, titulo: "APLICA POLÍTICA, LLAMAMIENTOS, PROTOCOLOS O INSTRUCTIVOS INSTITUCIONALES (EN CASO QUE APLIQUE)", key: "sec_15_politicas" },
  { n: 11, titulo: "CONSIDERACIONES", key: "sec_16_consideraciones" },
  { n: 12, titulo: "EVALUACIÓN DEL RIESGO", key: "sec_17_riesgo" },
  { n: 13, titulo: "RECOMENDACIÓN PARA EL CASO", key: "sec_18_recomendacion" },
  { n: 14, titulo: "ELABORÓ (APODERADO Y FIRMA EXTERNA)", key: "sec_19_elaboro" },
];

const ENCABEZADO_ROWS: { label: string; get: (d: DatosFichaPdf) => string }[] = [
  { label: "FECHA DE LA DILIGENCIA", get: (d) => fmtFecha(d.fecha_diligencia) },
  { label: "RADICACIÓN DE DEMANDA EN BIZAGI", get: (d) => d.radicado_bizagi ?? "" },
  { label: "RADICACIÓN DEL PROCESO (23 DÍGITOS)", get: (d) => d.radicado ?? "" },
  { label: "NOMBRE E IDENTIFICACIÓN DEMANDANTE", get: (d) => [d.nombre_demandante, d.cedula_demandante ? `C.C. ${d.cedula_demandante}` : ""].filter(Boolean).join(". ") },
  { label: "NOMBRE E IDENTIFICACIÓN CAUSANTE Y/O AFILIADO", get: (d) => d.causante_afiliado ?? "" },
  { label: "NOMBRE E IDENTIFICACIÓN DEMANDADO", get: () => DEMANDADO_FIJO },
  { label: "AUTORIDAD QUE EFECTÚA LA CITACIÓN", get: (d) => d.autoridad_citacion ?? "" },
  { label: "CADUCIDAD", get: (d) => d.caducidad ?? "" },
  { label: "RECONSIDERACIÓN", get: (d) => reconsideracionTxt(d.reconsideracion) },
];

function fmtFecha(f: string | null): string {
  if (!f) return "";
  try { return new Date(f).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase(); }
  catch { return f; }
}
function reconsideracionTxt(v: string | null): string {
  if (v === "SI") return "SI _X_   NO ___";
  if (v === "NO") return "SI ___   NO _X_";
  return "SI ___   NO ___";
}

const AZUL   = "#1a4a8a";
const GRIS   = "#e8edf3";
const BORDE  = "#7a869a";
const NEGRO  = "#1a1a1a";

export async function generarFichaPdf(datos: DatosFichaPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const M = 36;
    const doc = new PDFDocument({ margin: M, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = M;
    const right = doc.page.width - M;
    const W = right - left;
    const bottom = doc.page.height - M;

    // Salto de página si no cabe alto `h` desde y actual
    const ensure = (h: number) => {
      if (doc.y + h > bottom) doc.addPage();
    };

    // ── Encabezado / título ──
    const encH = 46;
    doc.rect(left, doc.y, W, encH).lineWidth(1).stroke(BORDE);
    doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(13)
      .text("FICHA DE CONCILIACIÓN JUDICIAL", left + 8, doc.y + 8, { width: W * 0.66 });
    const codeX = left + W * 0.68;
    doc.fillColor(NEGRO).font("Helvetica").fontSize(8);
    doc.text("CÓDIGO:  GDJ-GPO-FMT-005", codeX, doc.y - 26, { width: W * 0.32 });
    doc.text("VERSIÓN:  3", codeX, doc.y, { width: W * 0.32 });
    doc.text("FECHA:  07/04/2025", codeX, doc.y, { width: W * 0.32 });
    doc.y = doc.y + 6;
    doc.x = left;
    doc.moveDown(0.4);

    // ── Tabla de encabezado (9 filas) ──
    const labelW = W * 0.42;
    const valueW = W - labelW;
    for (const row of ENCABEZADO_ROWS) {
      const valor = row.get(datos);
      doc.font("Helvetica-Bold").fontSize(8);
      const hLabel = doc.heightOfString(row.label, { width: labelW - 12 });
      doc.font("Helvetica").fontSize(8);
      const hValue = doc.heightOfString(valor || " ", { width: valueW - 12 });
      const rowH = Math.max(hLabel, hValue) + 10;
      ensure(rowH);
      const y0 = doc.y;
      // celdas
      doc.rect(left, y0, labelW, rowH).fillAndStroke(GRIS, BORDE);
      doc.rect(left + labelW, y0, valueW, rowH).stroke(BORDE);
      doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(8)
        .text(row.label, left + 6, y0 + 5, { width: labelW - 12 });
      doc.font("Helvetica").fontSize(8)
        .text(valor, left + labelW + 6, y0 + 5, { width: valueW - 12 });
      doc.y = y0 + rowH;
      doc.x = left;
    }

    doc.moveDown(0.5);

    // ── 14 secciones ──
    for (const s of SECCIONES_PDF) {
      const contenido = (datos[s.key] ?? "").toString().trim() || "N/A";
      const tituloFull = `${s.n}. ${s.titulo}`;

      // Título de sección (barra gris)
      doc.font("Helvetica-Bold").fontSize(8);
      const hTit = doc.heightOfString(tituloFull, { width: W - 12 }) + 8;
      ensure(hTit + 24);
      let y0 = doc.y;
      doc.rect(left, y0, W, hTit).fillAndStroke(GRIS, BORDE);
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(8)
        .text(tituloFull, left + 6, y0 + 4, { width: W - 12 });
      doc.y = y0 + hTit;
      doc.x = left;

      // Contenido (caja)
      doc.font("Helvetica").fontSize(9);
      const hCont = doc.heightOfString(contenido, { width: W - 12, align: "justify" }) + 10;
      // Si el contenido no cabe entero, dejar que fluya (pdfkit pagina el texto)
      y0 = doc.y;
      const cajaH = Math.min(hCont, bottom - y0);
      doc.rect(left, y0, W, cajaH).stroke(BORDE);
      doc.fillColor(NEGRO).text(contenido, left + 6, y0 + 5, { width: W - 12, align: "justify" });
      doc.x = left;
      if (doc.y < y0 + cajaH) doc.y = y0 + cajaH;
      doc.moveDown(0.3);
    }

    doc.end();
  });
}
