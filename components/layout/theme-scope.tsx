"use client";

import { useTheme } from "@/components/ui/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Aplica el tema (clase `dark`) SOLO al área que envuelve, no a <html>.
 * Así la app interna puede lucir oscura sin afectar login/antesala.
 */
export function ThemeScope({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return <div className={cn(theme === "dark" && "dark", className)}>{children}</div>;
}
