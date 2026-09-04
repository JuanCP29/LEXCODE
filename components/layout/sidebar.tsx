"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FoqsLogo } from "@/components/ui/foqs-logo";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  FilePlus,
  BookMarked,
  Clock,
  ListChecks,
  Building2,
  Users,
  Undo2,
  X,
} from "lucide-react";
import { ROL, esAdmin, esCoordinador } from "@/lib/auth/roles";

type BadgeKey = "reparto" | "devoluciones";
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: BadgeKey };

// Un ítem está activo por coincidencia exacta o por prefijo, evitando solapes
// (Configuración solo exacto; Reparto no se activa en "/casos/nuevo").
function esActivo(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/configuracion") return false;
  if (href === "/casos") return pathname.startsWith("/casos/") && pathname !== "/casos/nuevo";
  return pathname.startsWith(`${href}/`);
}

interface SidebarContentProps {
  onClose?: () => void;
  rol?: string | null;
}

// Grupo extra solo visible para el Propietario (superadmin).
const GRUPO_PLATAFORMA: { titulo: string; items: NavItem[] } = {
  titulo: "Plataforma",
  items: [{ href: "/organizaciones", label: "Organizaciones", icon: Building2 }],
};

function SidebarContent({ onClose, rol }: SidebarContentProps) {
  const pathname = usePathname();
  const [contadores, setContadores] = useState<Record<BadgeKey, number>>({ reparto: 0, devoluciones: 0 });

  // Contadores de casos activos (cargados − completados). Se refrescan al navegar,
  // así el badge refleja asignaciones/finalizaciones recién hechas.
  useEffect(() => {
    let cancel = false;
    fetch("/api/contadores")
      .then((r) => r.json())
      .then((d) => { if (!cancel) setContadores({ reparto: d.reparto ?? 0, devoluciones: d.devoluciones ?? 0 }); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [pathname]);

  // Navegación por rol:
  //  · Propietario (superadmin): solo plataforma (Inicio, Configuración, Repositorio, Organizaciones).
  //  · Coordinador: operación de su organización (reparto, asignaciones, devoluciones, equipo, nuevo caso).
  //  · Sustanciador: sus casos (reparto, historial, pendientes) + Configuración.
  const prop = rol === ROL.SUPERADMIN;
  const coord = esCoordinador(rol);

  const espacioItems: NavItem[] = [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    ...(!prop ? [
      { href: "/casos", label: "Reparto", icon: FolderOpen, badge: "reparto" as BadgeKey },
      { href: "/documentos", label: "Historial", icon: FileText },
    ] : []),
    ...(coord ? [
      { href: "/cola-de-casos", label: "Asignaciones", icon: ListChecks },
      { href: "/devoluciones", label: "Devoluciones", icon: Undo2, badge: "devoluciones" as BadgeKey },
    ] : []),
    ...(!prop ? [{ href: "/pendientes", label: "Pendientes", icon: Clock }] : []),
  ];
  const herramientasItems: NavItem[] = [
    { href: "/configuracion", label: "Configuración", icon: Settings },
    ...(esAdmin(rol) ? [{ href: "/configuracion/directrices", label: "Repositorio", icon: BookMarked }] : []),
    ...(coord ? [{ href: "/equipo", label: "Equipo", icon: Users }] : []),
  ];
  const creacionItems: NavItem[] = coord ? [{ href: "/casos/nuevo", label: "Nuevo caso", icon: FilePlus }] : [];

  const grupos = [
    { titulo: "Espacio de trabajo", items: espacioItems },
    { titulo: "Herramientas", items: herramientasItems },
    ...(creacionItems.length ? [{ titulo: "Creación", items: creacionItems }] : []),
    ...(prop ? [GRUPO_PLATAFORMA] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar">

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard" onClick={onClose}>
          <FoqsLogo tone="dark" size="md" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-muted hover:text-sidebar-foreground md:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav — grupos con líneas separadoras tenues */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo} className={cn(gi > 0 && "mt-3 pt-3 border-t border-white/[0.06]")}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-widest">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.items.map(({ href, label, icon: Icon, badge }) => {
                const active = esActivo(pathname, href);
                const count = badge ? contadores[badge] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#35b9db]" />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#35b9db]" : "text-[var(--sidebar-muted)]")} />
                    <span>{label}</span>
                    {badge && count > 0 && (
                      <span
                        className={cn(
                          "ml-auto shrink-0 min-w-[20px] text-center text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md",
                          active ? "bg-[#35b9db]/20 text-[#35b9db]" : "bg-white/10 text-[var(--sidebar-muted)]"
                        )}
                      >
                        {count > 999 ? "999+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie — bloque de cuenta */}
      <div className="px-3 py-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <span className="w-8 h-8 rounded-full bg-[#35b9db] text-[#08131f] flex items-center justify-center text-xs font-bold shrink-0 select-none">
            CO
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-accent-foreground truncate leading-tight">Collegia Abogados</p>
            <p className="text-[11px] text-[var(--sidebar-muted)] leading-tight">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ rol }: { rol?: string | null }) {
  return (
    <aside className="hidden md:flex fixed left-3 top-3 bottom-3 w-[216px] flex-col z-40 rounded-2xl overflow-hidden border border-sidebar-border card-shadow">
      <SidebarContent rol={rol} />
    </aside>
  );
}

export function SidebarMobile({ open, onClose, rol }: { open?: boolean; onClose?: () => void; rol?: string | null }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-50 md:hidden shadow-xl animate-in slide-in-from-left duration-200">
        <SidebarContent onClose={onClose} rol={rol} />
      </aside>
    </>
  );
}
