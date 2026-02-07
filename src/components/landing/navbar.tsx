"use client";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="glass sticky top-0 z-50 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <SignInButton className="inline-flex items-center" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
