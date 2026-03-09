"use client";

import { motion } from "framer-motion";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative flex min-h-[76vh] items-center justify-center overflow-hidden px-6">
      {/* Animated gradient orb */}
      <motion.div
        className="pointer-events-none absolute h-[500px] w-[500px] rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, hsl(250 80% 65% / 0.6), hsl(280 70% 50% / 0.3), transparent 70%)",
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -25, 15, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.h1
          className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          AI-powered markdown
          <br />
          collaboration, <span className="text-primary">reimagined.</span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          Write with a rich WYSIWYG editor and built-in Copilot AI. Share via
          URL. Get Word-style comments. All version-controlled in GitHub.
        </motion.p>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <Button asChild size="lg" className="text-base px-8 py-6">
            <SignInButton className="inline-flex items-center gap-2" />
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            Free to use &middot; No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
