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

  return (
    <div className="min-h-screen bg-background">
      <Topbar userEmail={user.email} />
      <Sidebar />
      {/* mt-11 = topbar 44px. md:ml-[220px] = sidebar solo en desktop */}
      <main className="md:ml-[220px] mt-14 p-6 min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>
    </div>
  );
}
