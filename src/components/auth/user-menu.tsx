"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) return null;

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
