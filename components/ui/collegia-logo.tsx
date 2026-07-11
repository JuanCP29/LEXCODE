import Image from "next/image";

interface CollegiaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { width: 120, height: 40 },
  md: { width: 160, height: 53 },
  lg: { width: 220, height: 73 },
};

export function CollegiaLogo({ className, size = "md" }: CollegiaLogoProps) {
  const { width, height } = sizes[size];
  return (
    <Image
      src="/PHOTO-2026-05-27-12-39-13.jpg"
      alt="Collegia Abogados"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
