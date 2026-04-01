import { auth } from "@/lib/auth";
import { AppNavbar } from "@/components/layout/app-navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Anonymous access is allowed for /d/* and /shared routes.
  // The proxy (middleware) already redirects unauthenticated users
  // to sign-in for non-allowed routes, so if we reach here without
  // a session, the proxy has already approved this request.

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
