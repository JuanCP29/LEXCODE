/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "xlsx", "exceljs", "pdfkit"],
    outputFileTracingIncludes: {
      "/api/documentos-caso": ["./node_modules/pdf-parse/dist/worker/pdf.worker.mjs"],
      "/api/documentos-caso/[id]/reprocesar": ["./node_modules/pdf-parse/dist/worker/pdf.worker.mjs"],
      "/api/regenerar-seccion": ["./node_modules/pdf-parse/dist/worker/pdf.worker.mjs"],
      "/api/directrices": ["./node_modules/pdf-parse/dist/worker/pdf.worker.mjs"],
      "/api/analizar-documentos-extra": ["./node_modules/pdf-parse/dist/worker/pdf.worker.mjs"],
    },
  },
};

export default nextConfig;
