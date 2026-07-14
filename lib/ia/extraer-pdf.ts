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
  const PDFParse = await cargarPDFParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
