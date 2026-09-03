import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();

  return (
    <div className="min-h-screen bg-background">
      <Topbar userEmail={user.email} rol={perfil?.rol ?? null} />
      <Sidebar rol={perfil?.rol ?? null} />
      {/* mt-11 = topbar 44px. md:ml-[220px] = sidebar solo en desktop */}
      <main className="mt-14 p-6 min-h-[calc(100vh-3.5rem)] md:mt-[80px] md:ml-[240px] md:mr-3 md:mb-3 md:p-6 lg:px-9 lg:py-8 md:min-h-[calc(100vh-92px)]">
        <div className="mx-auto max-w-[1400px] w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
