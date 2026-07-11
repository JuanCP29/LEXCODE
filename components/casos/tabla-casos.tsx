"use client";

import Link from "next/link";
import { Bookmark, Star, FileText, Lock } from "lucide-react";

const pretensionLabel: Record<string, string> = {
  vejez:          "Vejez",
  invalidez:      "Invalidez",
  sobrevivientes: "Sobrevivientes",
  indemnizacion:  "Indemnización",
  devolucion:     "Devolución",
};

type FichaMin = { id: string; estado: string };

type CasoConFichas = {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  expediente_pensional: string | null;
  despacho: string | null;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
  estado: string;
  created_at: string;
  fichas_conciliacion: FichaMin[] | null;
};

interface TablaCasosProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  casos: any[];
}

export function TablaCasos({ casos }: TablaCasosProps) {
  const lista = casos as CasoConFichas[];

  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <FileText className="w-10 h-10 opacity-30" />
        <p className="text-sm">No hay casos registrados</p>
        <Link
          href="/casos/nuevo"
          className="text-sm text-[#1a4a8a] hover:underline font-medium"
        >
          Registrar primer caso →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              F. Conciliación
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Contestación Dda
            </th>
            <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Estado
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Radicado
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Demandante
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cédula
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Expediente
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Despacho
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Pretensión
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.map((caso: CasoConFichas, i: number) => {
            const fichas: FichaMin[] = Array.isArray(caso.fichas_conciliacion)
              ? caso.fichas_conciliacion
              : [];
            const fichaLista = fichas.some((f) => f.estado === "listo");
            const fichaEnProceso = fichas.length > 0 && !fichaLista;
            const sinFicha = fichas.length === 0;

            return (
              <tr
                key={caso.id}
                className={`border-b border-border last:border-0 hover:bg-primary/5 transition-colors group ${
                  i % 2 === 0 ? "bg-card" : "bg-muted/20"
                }`}
              >
                {/* Botón F. Conciliación */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/generador/${caso.id}/params`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors border-[#1a4a8a] text-[#1a4a8a] hover:bg-[#1a4a8a] hover:text-white"
                  >
                    F. Conciliación
                  </Link>
                </td>

                {/* Botón Demanda */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {fichaLista ? (
                    <Link
                      href={`/demanda/${caso.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
                    >
                      Contestación Dda
                    </Link>
                  ) : (
                    <span
                      title={
                        sinFicha
                          ? "Genera y cierra la ficha de conciliación primero"
                          : "La ficha de conciliación aún no está lista"
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold border-border text-muted-foreground cursor-not-allowed opacity-50"
                    >
                      <Lock className="w-3 h-3" />
                      Contestación Dda
                    </span>
                  )}
                </td>

                {/* Estado ficha */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {fichaLista ? (
                      <span title="Ficha de conciliación lista">
                        <Bookmark className="w-4 h-4" fill="#16a34a" color="#16a34a" />
                      </span>
                    ) : fichaEnProceso ? (
                      <span title="Ficha en proceso">
                        <Bookmark className="w-4 h-4" fill="#f59e0b" color="#f59e0b" />
                      </span>
                    ) : (
                      <span title="Sin ficha generada">
                        <Star className="w-4 h-4" fill="#ef4444" color="#ef4444" />
                      </span>
                    )}
                    <Link
                      href={`/casos/${caso.id}`}
                      className="text-[10px] text-muted-foreground hover:text-[#1a4a8a] transition-colors font-medium"
                    >
                      Ver
                    </Link>
                  </div>
                </td>

                {/* Radicado */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-foreground/80">
                    {caso.radicado}
                  </span>
                  {caso.radicado_bizagi && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      {caso.radicado_bizagi}
                    </p>
                  )}
                </td>

                {/* Demandante */}
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground text-sm">
                    {caso.nombre_demandante}
                  </span>
                </td>

                {/* Cédula */}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {caso.cedula_demandante ?? "—"}
                </td>

                {/* Expediente */}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {caso.expediente_pensional ?? "—"}
                </td>

                {/* Despacho */}
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate">
                  {caso.despacho ?? "—"}
                </td>

                {/* Pretensión */}
                <td className="px-4 py-3">
                  {caso.pretension ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {pretensionLabel[caso.pretension] ?? caso.pretension}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" fill="#16a34a" color="#16a34a" />
          Conciliación lista — Contestación Dda habilitada
        </span>
        <span className="flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" fill="#f59e0b" color="#f59e0b" />
          Ficha en proceso
        </span>
        <span className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" fill="#ef4444" color="#ef4444" />
          Sin ficha generada
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Lock className="w-3 h-3" />
          Contestación Dda bloqueada hasta cerrar conciliación
        </span>
      </div>
    </div>
  );
}
