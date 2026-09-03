// Roles de la aplicación (multi-tenant).
//   superadmin   → Propietario de la plataforma (FoQs).
//   coordinador  → Administrador de la organización cliente (asigna/controla reparto).
//   sustanciador → Abogado que gestiona sus casos asignados.
// 'admin' / 'abogado' / 'asistente' son valores LEGADOS (pre-migración); se
// mantienen reconocidos durante la transición.
export const ROL = {
  SUPERADMIN: "superadmin",
  COORDINADOR: "coordinador",
  SUSTANCIADOR: "sustanciador",
} as const;

// Nivel administrador de plataforma/config (Directrices, Configuración avanzada).
// Incluye 'admin' legado para no romper el acceso durante la migración.
export function esAdmin(rol?: string | null): boolean {
  return rol === "admin" || rol === ROL.SUPERADMIN;
}

// Coordinación: asignar casos, controlar reparto/seguimiento, gestionar equipo.
export function puedeCoordinar(rol?: string | null): boolean {
  return esAdmin(rol) || rol === ROL.COORDINADOR;
}

// Usuarios que pueden RECIBIR casos asignados (incluye valores legados).
export const ROLES_ASIGNABLES = [
  ROL.SUSTANCIADOR, ROL.COORDINADOR,
  "abogado", "asistente", "revisor", "admin",
];
