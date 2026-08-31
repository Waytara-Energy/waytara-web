import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

// Placeholder authenticated shell. Not actually gated yet — there's no
// login page or middleware redirect wired up. Once those exist, this is
// where a `requireRole([...])` guard (from `@waytara/supabase/auth`) or a
// middleware-based check drops in.
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
