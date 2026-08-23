import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// Fuente tipo SF Pro: en macOS toma la del sistema (San Francisco); en Windows/otros
// usa Inter (muy cercana). El stack se define en globals.css (body).
const inter = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
// Serif de marca (wordmark FoQs).
const serif = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "FoQs — Collegia Abogados",
  description: "Sistema de gestión de conciliaciones y demandas judiciales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${serif.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
