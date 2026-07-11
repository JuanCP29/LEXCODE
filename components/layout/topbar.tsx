"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidebarMobile } from "@/components/layout/sidebar";
import { useTheme } from "@/components/ui/theme-provider";
import { LogOut, ChevronRight, Search, Menu, Sun, Moon, Bell } from "lucide-react";

const breadcrumbMap: Record<string, string> = {
  dashboard:     "Inicio",
  casos:         "Casos",
  nuevo:         "Nuevo caso",
  documentos:    "Historial",
  configuracion: "Configuración",
  generador:     "Generador",
  params:        "Parámetros",
  ficha:         "Ficha",
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-xs">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = breadcrumbMap[seg] ?? seg;
        const href = "/" + segments.slice(0, i + 1).join("/");
        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            {isLast ? (
              <span className="font-semibold text-foreground">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Avatar({ email }: { email?: string }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "?";
  return (
    <div className="w-8 h-8 rounded-full bg-[#1a4a8a] flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
      {initials}
    </div>
  );
}

export function Topbar({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-50 gap-3"
        style={{
          backgroundColor: "var(--topbar)",
          borderBottom: "1px solid var(--topbar-border)",
        }}
      >
        {/* Hamburguesa móvil */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Espaciador sidebar desktop */}
        <div className="hidden md:block w-[220px] shrink-0" />

        {/* Breadcrumb */}
        <div className="flex-1 hidden sm:block">
          <Breadcrumb />
        </div>

        {/* Búsqueda */}
        <div className="relative hidden lg:flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar caso o radicado..."
            className="w-56 h-8 pl-8 pr-3 text-xs bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Toggle tema */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Modo claro" : "Modo nocturno"}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notificaciones */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* Avatar + email + salir */}
        <div className="flex items-center gap-2 pl-1 border-l border-border ml-1">
          <Avatar email={userEmail} />
          <span className="hidden xl:block text-xs text-muted-foreground max-w-[130px] truncate">
            {userEmail}
          </span>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <SidebarMobile open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
