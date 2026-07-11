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
