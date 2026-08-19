import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Logo institucional (si existe). Colócalo en public/plantillas/logo-colpensiones.png
const LOGO_PATH = path.join(process.cwd(), "public", "plantillas", "logo-colpensiones.png");
function logoBuffer(): Buffer | null {
  try { return fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null; }
  catch { return null; }
}

/**
 * Ficha de Conciliación Judicial en PDF replicando el formato oficial
 * GDJ-GPO-FMT-005 Versión 3 (14 secciones). Estilo fiel al modelo Excel:
 * fondo blanco, solo bordes; títulos de sección centrados en negro;
 * cajas de respuesta altas (aspecto de formulario).
 */

export type DatosFichaPdf = {
  fecha_diligencia: string | null;
  radicado_bizagi: string | null;
  radicado: string | null;
  nombre_demandante: string | null;
  cedula_demandante: string | null;
  causante_afiliado: string | null;
  autoridad_citacion: string | null;
  caducidad: string | null;
  reconsideracion: string | null;
  [key: string]: string | null;
};

const DEMANDADO_FIJO = "ADMINISTRADORA COLOMBIANA DE PENSIONES – COLPENSIONES. Nit. 900.336.004-7";

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
  { n: 10, titulo: "APLICA POLÍTICA, LLAMAMIENTOS, PROTOCOLOS O INSTRUCTIVOS INSTITUCIONALES: (EN CASO QUE APLIQUE)", key: "sec_15_politicas" },
  { n: 11, titulo: "CONSIDERACIONES", key: "sec_16_consideraciones" },
  { n: 12, titulo: "EVALUACIÓN DEL RIESGO", key: "sec_17_riesgo" },
  { n: 13, titulo: "RECOMENDACIÓN PARA EL CASO", key: "sec_18_recomendacion" },
  { n: 14, titulo: "ELABORÓ (APODERADO Y FIRMA EXTERNA)", key: "sec_19_elaboro" },
];

const ENCABEZADO_ROWS: { label: string; get: (d: DatosFichaPdf) => string }[] = [
  { label: "FECHA DE LA DILIGENCIA", get: (d) => fmtFecha(d.fecha_diligencia) },
  { label: "RADICACIÓN DE DEMANDA EN BIZAGI", get: (d) => limpiarNum(d.radicado_bizagi) },
  { label: "RADICACIÓN DEL PROCESO (23 DÍGITOS)", get: (d) => limpiarNum(d.radicado) },
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
// Corrige radicados que llegaron en notación científica (ej. 7.6e+22)
function limpiarNum(v: string | null): string {
  if (!v) return "";
  const s = String(v).trim();
  if (/e\+?\d+/i.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) return n.toLocaleString("fullwide", { useGrouping: false });
  }
  return s;
}
function reconsideracionTxt(v: string | null): string {
  if (v === "SI") return "SI  _X_        NO  ___";
  if (v === "NO") return "SI  ___        NO  _X_";
  return "SI  ___        NO  ___";
}

const BORDE = "#000000";
const NEGRO = "#000000";

export async function generarFichaPdf(datos: DatosFichaPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const M = 40;
    const doc = new PDFDocument({ margin: M, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = M;
    const W = doc.page.width - 2 * M;
    const bottom = doc.page.height - M;
    doc.lineWidth(0.7);

    // ── Bloque de título (logo · título · meta) ──
    const hTit = 54;
    const wLogo = W * 0.20, wTitulo = W * 0.52, wMeta = W - wLogo - wTitulo;
    const y0 = doc.y;
    // celdas externas
    doc.rect(left, y0, wLogo, hTit).stroke(BORDE);
    doc.rect(left + wLogo, y0, wTitulo, hTit).stroke(BORDE);
    // logo institucional (imagen si existe; si no, texto)
    const logo = logoBuffer();
    if (logo) {
      try {
        doc.image(logo, left + 6, y0 + 6, { fit: [wLogo - 12, hTit - 12], align: "center", valign: "center" });
      } catch {
        doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(9).text("COLPENSIONES", left, y0 + hTit / 2 - 6, { width: wLogo, align: "center" });
      }
    } else {
      doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(9)
        .text("COLPENSIONES", left, y0 + hTit / 2 - 6, { width: wLogo, align: "center" });
    }
    // título centrado
    doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(12)
      .text("FICHA DE CONCILIACIÓN JUDICIAL", left + wLogo + 4, y0 + 12, { width: wTitulo - 8, align: "center" });
    // meta: 3 filas (código, versión, fecha)
    const metaX = left + wLogo + wTitulo;
    const wMetaL = wMeta * 0.42, wMetaV = wMeta - wMetaL;
    const metaRows = [["CÓDIGO:", "GDJ-GPO-FMT-005"], ["VERSIÓN:", "3"], ["FECHA:", "07/04/2025"]];
    const hMetaRow = hTit / 3;
    metaRows.forEach((mr, i) => {
      const my = y0 + i * hMetaRow;
      doc.rect(metaX, my, wMetaL, hMetaRow).stroke(BORDE);
      doc.rect(metaX + wMetaL, my, wMetaV, hMetaRow).stroke(BORDE);
      doc.font("Helvetica").fontSize(7).fillColor(NEGRO)
        .text(mr[0], metaX + 3, my + hMetaRow / 2 - 4, { width: wMetaL - 6 });
      doc.font("Helvetica").fontSize(7)
        .text(mr[1], metaX + wMetaL + 3, my + hMetaRow / 2 - 4, { width: wMetaV - 6 });
    });
    doc.y = y0 + hTit + 8;
    doc.x = left;

    // ── Tabla de encabezado (9 filas, blanco con bordes) ──
    const labelW = W * 0.37;
    const valueW = W - labelW;
    for (const row of ENCABEZADO_ROWS) {
      const valor = row.get(datos);
      doc.font("Helvetica-Bold").fontSize(9);
      const hLabel = doc.heightOfString(row.label, { width: labelW - 10 });
      doc.font("Helvetica").fontSize(9);
      const hValue = doc.heightOfString(valor || " ", { width: valueW - 10 });
      const rowH = Math.max(hLabel, hValue, 14) + 8;
      if (doc.y + rowH > bottom) { doc.addPage(); doc.y = M; }
      const ry = doc.y;
      doc.rect(left, ry, labelW, rowH).stroke(BORDE);
      doc.rect(left + labelW, ry, valueW, rowH).stroke(BORDE);
      const labelY = ry + (rowH - hLabel) / 2;
      const valueY = ry + (rowH - hValue) / 2;
      doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(9)
        .text(row.label, left + 5, labelY, { width: labelW - 10 });
      doc.font("Helvetica").fontSize(9)
        .text(valor, left + labelW + 5, valueY, { width: valueW - 10 });
      doc.y = ry + rowH;
      doc.x = left;
    }

    doc.moveDown(0.6);

    // ── 14 secciones: título centrado negro + caja de respuesta alta ──
    const MIN_CAJA = 64;
    for (const s of SECCIONES_PDF) {
      const contenido = (datos[s.key] ?? "").toString().trim() || "N/A";
      const tituloFull = `${s.n}. ${s.titulo}`;

      doc.font("Helvetica-Bold").fontSize(9);
      const hTitS = doc.heightOfString(tituloFull, { width: W - 12 }) + 8;
      if (doc.y + hTitS + MIN_CAJA > bottom) { doc.addPage(); doc.y = M; }

      // Título (centrado, negro, bordeado, blanco)
      let ty = doc.y;
      doc.rect(left, ty, W, hTitS).stroke(BORDE);
      doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(9)
        .text(tituloFull, left + 6, ty + 4, { width: W - 12, align: "center" });
      doc.y = ty + hTitS;
      doc.x = left;

      // Caja de respuesta (alta, justificada)
      doc.font("Helvetica").fontSize(9);
      const hCont = doc.heightOfString(contenido, { width: W - 12, align: "justify" });
      const cajaH = Math.max(hCont + 12, MIN_CAJA);
      let cy = doc.y;
      if (cy + cajaH > bottom && cajaH <= bottom - M) { doc.addPage(); doc.y = M; cy = doc.y; }
      const cajaHFinal = Math.min(cajaH, bottom - cy);
      doc.rect(left, cy, W, cajaHFinal).stroke(BORDE);
      doc.fillColor(NEGRO).text(contenido, left + 6, cy + 6, { width: W - 12, align: "justify" });
      doc.x = left;
      doc.y = Math.max(doc.y, cy + cajaHFinal);
      doc.moveDown(0.2);
    }

    doc.end();
  });
}
