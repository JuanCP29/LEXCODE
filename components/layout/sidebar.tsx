"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",                     label: "Inicio",         icon: LayoutDashboard },
  { href: "/casos",                         label: "Reparto",         icon: FolderOpen },
  { href: "/documentos",                    label: "Historial",       icon: FileText },
  { href: "/cola-de-casos",                  label: "Asignaciones",    icon: ListChecks },
  { href: "/pendientes",                     label: "Pendientes",      icon: Clock },
  { href: "/configuracion",                 label: "Configuración",   icon: Settings },
  { href: "/configuracion/directrices",     label: "Directrices",     icon: BookMarked, sub: true },
];

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const pathname = usePathname();

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

      {/* Etiqueta firma */}
      <div className="px-5 pt-4 pb-1">
        <p className="text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-widest">
          Collegia Abogados
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, sub }) => {
          const active = pathname === href || (href !== "/configuracion" && pathname.startsWith(`${href}/`)) || pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                sub ? "px-3 py-2 ml-3" : "px-3 py-2.5",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {active && !sub && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#35b9db]" />
              )}
              <Icon className={cn(sub ? "w-3.5 h-3.5" : "w-4 h-4", "shrink-0", active ? "text-[#35b9db]" : "text-[var(--sidebar-muted)]")} />
              <span className={sub ? "text-xs" : ""}>{label}</span>
            </Link>
          );
        })}

        {/* Separador */}
        <div className="pt-4 pb-1 px-2">
          <p className="text-[10px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-widest">
            Generador
          </p>
        </div>

        <Link
          href="/casos/nuevo"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/casos/nuevo"
              ? "bg-sidebar-accent text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <FilePlus className={cn("w-4 h-4 shrink-0", pathname === "/casos/nuevo" ? "text-white" : "text-[var(--sidebar-muted)]")} />
          Nuevo caso
        </Link>
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

export function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-3 top-3 bottom-3 w-[216px] flex-col z-40 rounded-2xl overflow-hidden border border-sidebar-border card-shadow">
      <SidebarContent />
    </aside>
  );
}

export function SidebarMobile({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />
      <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-50 md:hidden shadow-xl animate-in slide-in-from-left duration-200">
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}
