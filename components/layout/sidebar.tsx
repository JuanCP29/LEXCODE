"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CollegiaLogo } from "@/components/ui/collegia-logo";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  FilePlus,
  BookMarked,
  Clock,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",                     label: "Inicio",         icon: LayoutDashboard },
  { href: "/casos",                         label: "Casos",           icon: FolderOpen },
  { href: "/documentos",                    label: "Historial",       icon: FileText },
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
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          {/* Ícono angular */}
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1a4a8a]">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <polygon points="10,2 18,8 2,8" fill="white" />
              <rect x="3"  y="8" width="2.5" height="10" fill="white" />
              <rect x="7"  y="8" width="2.5" height="10" fill="white" />
              <rect x="11" y="8" width="2.5" height="10" fill="white" />
              <rect x="15" y="8" width="2.5" height="10" fill="white" />
            </svg>
          </span>
          <span className="font-bold text-lg tracking-tight text-sidebar-foreground">
            <span className="text-[#1a4a8a]">LEG</span><span>IUX</span>
          </span>
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
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                sub ? "px-3 py-2 ml-3" : "px-3 py-2.5",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn(sub ? "w-3.5 h-3.5" : "w-4 h-4", "shrink-0", active ? "text-[#1a4a8a] dark:text-[#93c5fd]" : "text-[var(--sidebar-muted)]")} />
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
              ? "bg-[#1a4a8a] text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <FilePlus className={cn("w-4 h-4 shrink-0", pathname === "/casos/nuevo" ? "text-white" : "text-[var(--sidebar-muted)]")} />
          Nuevo caso
        </Link>
      </nav>

      {/* Pie — logo Collegia original */}
      <div className="px-4 py-3 border-t border-sidebar-border shrink-0 flex items-center justify-center">
        <CollegiaLogo size="sm" />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-col z-40">
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
