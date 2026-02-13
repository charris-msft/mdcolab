import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppNavbar } from "@/components/layout/app-navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    // Allow anonymous access to /d/* routes — the page component handles access checks
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? "";
    if (!pathname.startsWith("/d/")) {
      redirect("/api/auth/signin");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
