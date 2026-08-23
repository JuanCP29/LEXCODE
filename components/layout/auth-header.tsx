import { FoqsLogo } from "@/components/ui/foqs-logo";

interface AuthHeaderProps {
  subtitulo?: string;
}

export function AuthHeader({ subtitulo = "Abogados" }: AuthHeaderProps) {
  return (
    <div className="flex flex-col items-center mb-8 gap-2">
      <FoqsLogo size="lg" />
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
    </div>
  );
}
