import { PDFParse } from "pdf-parse";
import path from "path";

// En Next.js App Router el worker de PDF.js debe configurarse manualmente
// apuntando al archivo .mjs incluido en el paquete.
const workerPath = path.resolve(
  process.cwd(),
  "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"
);
PDFParse.setWorker(workerPath);

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
