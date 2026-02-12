import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppNavbar } from "@/components/layout/app-navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    // Redirect to NextAuth sign-in; it will pass callbackUrl to our custom sign-in page
    redirect("/api/auth/signin");
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
