"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

export function SignInButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
      className={className}
    >
      <Github className="mr-2 h-5 w-5 inline" />
      Sign in with GitHub
    </button>
  );
}
