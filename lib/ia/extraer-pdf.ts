type PDFParseClass = typeof import("pdf-parse")["PDFParse"];

let pdfParsePromise: Promise<PDFParseClass> | null = null;

function cargarPDFParse(): Promise<PDFParseClass> {
  if (!pdfParsePromise) {
    pdfParsePromise = (async () => {
      // Este módulo Node instala DOMMatrix, Path2D e ImageData desde
      // @napi-rs/canvas. Debe cargarse ANTES de pdf-parse/pdfjs-dist.
      const { getPath } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      PDFParse.setWorker(getPath());
      return PDFParse;
    })();
  }
  return pdfParsePromise;
}

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  return (await extraerTextoPDFDetallado(buffer)).texto;
}

export type ExtraccionPDF = {
  texto: string;
  paginas: number;       // total de páginas
  paginasVacias: number; // páginas sin texto útil (probable capa escaneada / imagen)
};

// Extracción con diagnóstico por página. Detecta PDFs MIXTOS (algunas páginas digitales y
// otras escaneadas): esos pasan el umbral de "tiene texto" pero pierden el contenido de las
// páginas imagen. `paginasVacias` permite disparar OCR aunque el total de texto no sea bajo.
export async function extraerTextoPDFDetallado(buffer: Buffer): Promise<ExtraccionPDF> {
  const PDFParse = await cargarPDFParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const paginas = result.total ?? (Array.isArray(result.pages) ? result.pages.length : 0);
    const paginasVacias = (result.pages ?? []).filter(
      (p) => (p?.text ?? "").trim().length < 30
    ).length;
    return { texto: (result.text ?? "").trim(), paginas, paginasVacias };
  } finally {
    await parser.destroy();
  }
}
