"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User, LogIn } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {session.user.image && (
        <img
          src={session.user.image}
          alt={session.user.name ?? "User"}
          className="h-8 w-8 rounded-full"
        />
      )}
      <span className="text-sm font-medium">{session.user.name}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
