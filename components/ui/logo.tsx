import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <span className={cn("font-bold tracking-tight select-none", sizes[size], className)}>
      <span className="text-white">LEG</span>
      <span style={{ color: "#6b7dff" }}>IUX</span>
    </span>
  );
}
