"use client";

import Link from "next/link";
import { FileText, Lock } from "lucide-react";

// Quita la ciudad repetida y el departamento del despacho
// ("JUZGADO ... DE CALI — CALI — VALLE DEL CAUCA" → "JUZGADO ... DE CALI")
function limpiarDespacho(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto.split(/\s*[—–]\s*/)[0].trim();
}

// Convierte texto en MAYÚSCULAS a "Nombre Propio" (deja conectores en minúscula)
const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
function aNombrePropio(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((palabra, i) => {
      if (i > 0 && MINUSCULAS.has(palabra)) return palabra;
      // Mantén tokens con dígitos tal cual (ej. "021")
      if (/\d/.test(palabra)) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

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
          className="text-sm text-primary hover:underline font-medium"
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
              Despacho
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    F. Conciliación
                  </Link>
                </td>

                {/* Botón Demanda */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {fichaLista ? (
                    <Link
                      href={`/demanda/${caso.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-primary-foreground"
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
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                      fichaLista
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : fichaEnProceso
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    {fichaLista ? "Completado" : fichaEnProceso ? "En proceso" : "Pendiente"}
                  </span>
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
                    {aNombrePropio(caso.nombre_demandante)}
                  </span>
                </td>

                {/* Cédula */}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {caso.cedula_demandante ?? "—"}
                </td>

                {/* Despacho */}
                <td className="px-4 py-3 text-sm text-muted-foreground min-w-[280px]">
                  {caso.despacho ? aNombrePropio(limpiarDespacho(caso.despacho)) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completado</span>
          Conciliación lista — Contestación Dda habilitada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">En proceso</span>
          Ficha en proceso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Pendiente</span>
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
