import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { htmlATextoPlano, htmlABloques } from "@/lib/richtext/html";
import { dibujarTablaPdf } from "@/lib/pdf/runs";

// Renderiza contenido (HTML o plano) dentro de una caja del PDF de la ficha,
// respetando negrita/subrayado con la tipografía registrada (FONT/FONT_BOLD) y
// dibujando tablas como rejilla. Conserva el seguimiento de páginas de la caja.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pintarRich(doc: any, raw: string, x: number, y: number, width: number, align: "center" | "justify" | "left", FONT: string, FONT_BOLD: string, bottom: number, top: number) {
  const bloques = htmlABloques(raw);
  const hayTabla = bloques.some((b) => b.tipo === "tabla");
  const hayFormato = bloques.some((b) => b.tipo === "parrafo" && b.runs.some((r) => r.bold || r.underline));
  // Sin tabla ni formato -> render idéntico al original (una sola llamada).
  if (!hayTabla && !hayFormato) {
    const plano = bloques.map((b) => (b.tipo === "parrafo" ? b.runs.map((r) => r.text).join("") : "")).join("\n\n");
    doc.font(FONT).fontSize(9).fillColor(NEGRO).text(plano, x, y, { width, align, lineGap: 2.5 });
    return;
  }
  // Con formato/tablas: cada párrafo se pinta como secuencia "continued" (para
  // mezclar tipografías); las tablas se dibujan como rejilla con bordes.
  doc.x = x; doc.y = y;
  bloques.forEach((b, bi) => {
    if (b.tipo === "tabla") {
      dibujarTablaPdf(doc, b.filas, { x, width, size: 9, font: FONT, fontBold: FONT_BOLD, bottom, top });
      if (bi < bloques.length - 1) doc.moveDown(0.5);
      return;
    }
    const rr = b.runs.length ? b.runs : [{ text: "" }];
    rr.forEach((r, ri) => {
      const primero = ri === 0, ultimo = ri === rr.length - 1;
      doc.font(r.bold ? FONT_BOLD : FONT).fontSize(9).fillColor(NEGRO);
      const opciones = { width, align, lineGap: 2.5, underline: !!r.underline, continued: !ultimo };
      if (primero) doc.text(r.text, x, doc.y, opciones);
      else doc.text(r.text, opciones);
    });
    if (bi < bloques.length - 1) doc.moveDown(0.9); // separación entre párrafos
  });
}

// Logo institucional (si existe). Colócalo en public/plantillas/logo-colpensiones.png
const LOGO_PATH = path.join(process.cwd(), "public", "plantillas", "logo-colpensiones.png");
function logoBuffer(): Buffer | null {
  try { return fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null; }
  catch { return null; }
}

// Firma manuscrita de la apoderada externa (sección 14 «Elaboró»). Colócala en
// public/plantillas/firma-elaboro.png (fondo transparente recomendado). Si falta, se
// imprime solo el bloque de texto de la firma.
const FIRMA_PATH = path.join(process.cwd(), "public", "plantillas", "firma-elaboro.png");
function firmaBuffer(): Buffer | null {
  try { return fs.existsSync(FIRMA_PATH) ? fs.readFileSync(FIRMA_PATH) : null; }
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
    const doc = new PDFDocument({ margin: M, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // Índice de la página actual (0-based). Se incrementa con cada página nueva
    // (manual o automática por desbordamiento de texto).
    let paginaActual = 0;
    // pdfkit reinicia el grosor de línea en cada página nueva → fijarlo siempre
    doc.on("pageAdded", () => { doc.lineWidth(0.4); paginaActual++; });

    // Fuente Roboto (más limpia) si está disponible; si no, Helvetica.
    let FONT = "Helvetica", FONT_BOLD = "Helvetica-Bold";
    try {
      const dir = path.join(process.cwd(), "public", "fonts");
      const reg = path.join(dir, "Roboto-Regular.ttf");
      const bold = path.join(dir, "Roboto-Bold.ttf");
      if (fs.existsSync(reg) && fs.existsSync(bold)) {
        doc.registerFont("Roboto", reg);
        doc.registerFont("Roboto-Bold", bold);
        FONT = "Roboto"; FONT_BOLD = "Roboto-Bold";
      }
    } catch { /* fallback Helvetica */ }

    const left = M;
    const W = doc.page.width - 2 * M;
    const bottom = doc.page.height - M;
    doc.lineWidth(0.4);

    // ── Bloque de título (logo · título · meta) ──
    const hTit = 58;
    const wLogo = W * 0.30, wTitulo = W * 0.48, wMeta = W - wLogo - wTitulo;
    const y0 = doc.y;
    // celdas externas
    doc.rect(left, y0, wLogo, hTit).stroke(BORDE);
    doc.rect(left + wLogo, y0, wTitulo, hTit).stroke(BORDE);
    // logo institucional (imagen si existe; si no, texto) — tamaño moderado
    const logo = logoBuffer();
    if (logo) {
      try {
        doc.image(logo, left + 14, y0 + 8, { fit: [wLogo * 0.62, hTit - 22], valign: "center" });
      } catch {
        doc.fillColor(NEGRO).font(FONT_BOLD).fontSize(9).text("COLPENSIONES", left, y0 + hTit / 2 - 6, { width: wLogo, align: "center" });
      }
    } else {
      doc.fillColor(NEGRO).font(FONT_BOLD).fontSize(9)
        .text("COLPENSIONES", left, y0 + hTit / 2 - 6, { width: wLogo, align: "center" });
    }
    // título — mismo tamaño que el cuerpo (9), centrado
    doc.fillColor(NEGRO).font(FONT_BOLD).fontSize(9);
    const hTitleTxt = doc.heightOfString("FICHA DE CONCILIACIÓN JUDICIAL", { width: wTitulo - 16 });
    doc.text("FICHA DE CONCILIACIÓN JUDICIAL", left + wLogo + 8, y0 + (hTit - hTitleTxt) / 2, { width: wTitulo - 16, align: "center" });
    // meta: 3 filas (código, versión, fecha)
    const metaX = left + wLogo + wTitulo;
    const wMetaL = wMeta * 0.38, wMetaV = wMeta - wMetaL;
    const metaRows = [["Código:", "GDJ-GPO-FMT-005"], ["Versión:", "3"], ["Fecha:", "07/04/2025"]];
    const hMetaRow = hTit / 3;
    metaRows.forEach((mr, i) => {
      const my = y0 + i * hMetaRow;
      doc.rect(metaX, my, wMetaL, hMetaRow).stroke(BORDE);
      doc.rect(metaX + wMetaL, my, wMetaV, hMetaRow).stroke(BORDE);
      doc.font(FONT_BOLD).fontSize(7).fillColor(NEGRO)
        .text(mr[0], metaX + 3, my + 4, { width: wMetaL - 5 });
      doc.font(FONT).fontSize(7)
        .text(mr[1], metaX + wMetaL + 3, my + 4, { width: wMetaV - 5 });
    });
    doc.y = y0 + hTit + 10;
    doc.x = left;

    // ── Tabla de encabezado (9 filas, blanco con bordes) ──
    const labelW = W * 0.40;
    const valueW = W - labelW;
    for (const row of ENCABEZADO_ROWS) {
      const valor = row.get(datos);
      doc.font(FONT_BOLD).fontSize(9);
      const hLabel = doc.heightOfString(row.label, { width: labelW - 10 });
      doc.font(FONT).fontSize(9);
      const hValue = doc.heightOfString(valor || " ", { width: valueW - 10 });
      const rowH = Math.max(hLabel, hValue, 14) + 8;
      if (doc.y + rowH > bottom) { doc.addPage(); doc.y = M; }
      const ry = doc.y;
      doc.rect(left, ry, labelW, rowH).stroke(BORDE);
      doc.rect(left + labelW, ry, valueW, rowH).stroke(BORDE);
      const labelY = ry + (rowH - hLabel) / 2;
      const valueY = ry + (rowH - hValue) / 2;
      doc.fillColor(NEGRO).font(FONT_BOLD).fontSize(9)
        .text(row.label, left + 5, labelY, { width: labelW - 10 });
      doc.font(FONT).fontSize(9)
        .text(valor, left + labelW + 5, valueY, { width: valueW - 10 });
      doc.y = ry + rowH;
      doc.x = left;
    }

    doc.moveDown(0.3);

    // ── 14 secciones contiguas (sin espacios entre ellas) ──
    // Secciones estandarizadas con texto fijo (y si va centrado)
    const ESTANDAR: Record<string, { texto: string; centrado: boolean }> = {
      sec_6_sentencia: { texto: "No aplica", centrado: true },
      sec_5_apelacion: { texto: "No aplica", centrado: true },
      sec_9_caducidad: { texto: "Se establece que la acción a la fecha no se afectado con la caducidad atendiendo la naturaleza de lo pretendido.", centrado: false },
    };
    const MIN_CAJA = 34;
    for (const s of SECCIONES_PDF) {
      const est = ESTANDAR[s.key];
      const centrarEst = est?.centrado ?? false;
      const contenidoRaw = est ? est.texto : ((datos[s.key] ?? "").toString().trim() || "N/A");
      const contenido = htmlATextoPlano(contenidoRaw) || "N/A";
      const tituloFull = `${s.n}. ${s.titulo}`;

      // Título de la sección
      doc.font(FONT_BOLD).fontSize(9);
      const hTitS = doc.heightOfString(tituloFull, { width: W - 12 }) + 8;
      // Evitar título huérfano: si no caben el título + un mínimo de contenido, saltar de página.
      if (doc.y + hTitS + MIN_CAJA > bottom) { doc.addPage(); doc.y = M; }

      const ty = doc.y;
      doc.rect(left, ty, W, hTitS).stroke(BORDE);
      doc.fillColor(NEGRO).font(FONT_BOLD).fontSize(9)
        .text(tituloFull, left + 6, ty + 4, { width: W - 12, align: "center" });
      doc.y = ty + hTitS;
      doc.x = left;

      // ── Sección 14 (Elaboró): firma manuscrita encima del bloque de datos ──
      const esFirma = s.key === "sec_19_elaboro";
      const firma = esFirma ? firmaBuffer() : null;
      if (firma) {
        const imgH = 48, gap = 4;
        doc.font(FONT_BOLD).fontSize(9).fillColor(NEGRO);
        const hTxt = doc.heightOfString(contenido, { width: W - 12, lineGap: 2.5 });
        const boxH = 6 + imgH + gap + hTxt + 8;
        if (doc.y + boxH > bottom) { doc.addPage(); doc.y = M; }
        const by = doc.y;
        doc.rect(left, by, W, boxH).stroke(BORDE);
        try { doc.image(firma, left + 6, by + 6, { fit: [170, imgH] }); } catch { /* imagen inválida */ }
        doc.font(FONT_BOLD).fontSize(9).fillColor(NEGRO)
          .text(contenido, left + 6, by + 6 + imgH + gap, { width: W - 12, align: "left", lineGap: 2.5 });
        doc.y = by + boxH;
        doc.x = left;
        continue;
      }

      // Caja de respuesta — el contenido largo se divide entre páginas y el borde
      // se dibuja por segmentos en cada página que ocupa.
      const alignCaja = (centrarEst ? "center" : "justify") as "center" | "justify" | "left";
      doc.font(FONT).fontSize(9).fillColor(NEGRO);
      const pIni = paginaActual;
      const yIni = doc.y;
      pintarRich(doc, contenidoRaw, left + 6, yIni + 6, W - 12, alignCaja, FONT, FONT_BOLD, bottom, M);
      const pFin = paginaActual;
      const yFin = doc.y + 6; // padding inferior

      for (let p = pIni; p <= pFin; p++) {
        doc.switchToPage(p);
        const top = p === pIni ? yIni : M - 6;
        const bot = p === pFin ? Math.max(yFin, top + MIN_CAJA) : bottom;
        doc.rect(left, top, W, bot - top).stroke(BORDE);
      }
      // Volver a la última página y dejar el cursor contiguo para la siguiente sección.
      doc.switchToPage(pFin);
      doc.x = left;
      doc.y = pFin === pIni ? Math.max(yFin, yIni + MIN_CAJA) : Math.max(yFin, (M - 6) + MIN_CAJA);
      // sin moveDown: las secciones quedan contiguas
    }

    doc.end();
  });
}
