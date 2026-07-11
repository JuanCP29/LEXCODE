import { FormNuevoCaso } from "@/components/casos/form-nuevo-caso";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NuevoCasoPage() {
  return (
    <div className="max-w-2xl">
      {/* Encabezado */}
      <div className="mb-8">
        <Link
          href="/casos"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a casos
        </Link>
        <h1 className="text-xl font-semibold text-white">Nuevo caso</h1>
        <p className="text-sm text-gray-400 mt-1">
          Registra el proceso y adjunta los documentos. Luego podrás generar la ficha de conciliación con IA.
        </p>
      </div>

      <FormNuevoCaso />
    </div>
  );
}
