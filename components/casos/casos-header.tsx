"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileSpreadsheet } from "lucide-react";
import { ImportarExcelModal } from "@/components/casos/importar-excel-modal";

interface CasosHeaderProps {
  total: number;
}

export function CasosHeader({ total }: CasosHeaderProps) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cola de casos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} proceso{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Importar Excel */}
          <button
            onClick={() => setModalAbierto(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Importar Excel
          </button>

          {/* Nuevo caso manual */}
          <Link
            href="/casos/nuevo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1a4a8a] text-white text-sm font-medium hover:bg-[#163d73] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo caso
          </Link>
        </div>
      </div>

      {modalAbierto && (
        <ImportarExcelModal onClose={() => setModalAbierto(false)} />
      )}
    </>
  );
}
