// Clases Tailwind para cada estado de ficha
export const ESTADO_CLASES: Record<string, { text: string; bg: string; label: string }> = {
  listo:      { text: "text-[#3b6d11]", bg: "bg-[#eaf3de]", label: "Listo" },
  en_revision:{ text: "text-[#854f0b]", bg: "bg-[#faeeda]", label: "En revisión" },
  borrador:   { text: "text-[#185fa5]", bg: "bg-[#e6f1fb]", label: "Borrador" },
  pendiente:  { text: "text-[#a32d2d]", bg: "bg-[#fcebeb]", label: "Pendiente" },
  activo:     { text: "text-[#3b6d11]", bg: "bg-[#eaf3de]", label: "Activo" },
  archivado:  { text: "text-[#64748b]", bg: "bg-[#f1f5f9]", label: "Archivado" },
};

export function estadoBadgeClases(estado: string): string {
  const e = ESTADO_CLASES[estado];
  if (!e) return "text-gray-600 bg-gray-100";
  return `${e.text} ${e.bg}`;
}

// Colores unificados para el estado de trabajo del caso (pendiente / en proceso / completado)
// Usados en Reparto y en Cola de casos para que sean idénticos en toda la app.
export const WORKFLOW_ESTADO: Record<string, { label: string; clase: string }> = {
  pendiente:  { label: "Pendiente",  clase: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  en_proceso: { label: "En proceso", clase: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  completado: { label: "Completado", clase: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};
