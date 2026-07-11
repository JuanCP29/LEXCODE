/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "xlsx", "exceljs", "pdfkit"],
  },
};

export default nextConfig;
