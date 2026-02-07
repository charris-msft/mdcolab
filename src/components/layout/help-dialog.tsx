"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleHelp,
  FolderOpen,
  PenLine,
  Link2,
  MessageSquareText,
  CheckCircle2,
  Keyboard,
  Shield,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mdcolab-onboarded";
const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

// ─── Step components ────────────────────────────────────────

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-10 w-10 text-primary" />
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">
          md<span className="text-primary">colab</span>
        </p>
        <p className="text-lg font-semibold mt-2">Welcome to mdcolab</p>
        <p className="text-sm text-muted-foreground mt-1">
          Collaborative markdown review, reimagined.
        </p>
      </div>
    </div>
  );
}

const howItWorksSteps = [
  { icon: FolderOpen, emoji: "📁", label: "Browse", desc: "Open any markdown file from your GitHub repos" },
  { icon: PenLine, emoji: "✏️", label: "Edit", desc: "Write in a rich WYSIWYG editor (authors with write access)" },
  { icon: Link2, emoji: "🔗", label: "Share", desc: "Copy the URL and share with anyone who has repo access" },
  { icon: MessageSquareText, emoji: "💬", label: "Comment", desc: "Select text and click \"Comment\" to start a thread" },
  { icon: CheckCircle2, emoji: "✅", label: "Resolve", desc: "Mark comment threads as resolved when addressed" },
];

function HowItWorksStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 justify-center">
        <Lightbulb className="h-5 w-5 text-primary" />
        <p className="text-lg font-semibold">How It Works</p>
      </div>
      <div className="space-y-3">
        {howItWorksSteps.map((s, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40">
            <span className="text-lg leading-none mt-0.5">{s.emoji}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const tips = [
  { label: "Ctrl+S", desc: "Save changes" },
  { label: "Ctrl+Alt+M", desc: "Add a comment" },
  { label: "Cmd+K", desc: "Open command palette" },
];

function QuickTipsStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 justify-center">
        <Keyboard className="h-5 w-5 text-primary" />
        <p className="text-lg font-semibold">Quick Tips</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Keyboard shortcuts</p>
        <div className="grid gap-1.5">
          {tips.map((t) => (
            <div key={t.label} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{t.desc}</span>
              <kbd className="inline-flex h-6 items-center rounded border bg-muted px-2 font-mono text-xs text-muted-foreground">
                {t.label}
              </kbd>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>💡 Comments are stored as GitHub Issues (labeled <code className="text-xs bg-muted px-1 py-0.5 rounded">mdcolab</code>)</p>
        <p>💡 Anyone with repo access can comment — no write access needed</p>
        <p>💡 Use <strong>Edit</strong> mode to write, <strong>Review</strong> mode to comment</p>
      </div>
    </div>
  );
}

function SecurityStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 justify-center">
        <Shield className="h-5 w-5 text-amber-500" />
        <p className="text-lg font-semibold">Security Recommendation</p>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">Important: Use a test account</p>
        </div>
        <p className="text-sm text-muted-foreground">
          mdcolab accesses your GitHub repos. Until we complete our security review, we recommend:
        </p>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 pl-1">
          <li>Create a free Gmail account for testing</li>
          <li>Create a GitHub account with that email</li>
          <li>Sign into mdcolab with that test account</li>
          <li>Fork any repos you want to review into the test account</li>
        </ol>
        <p className="text-sm text-muted-foreground font-medium">
          This ensures your organization&apos;s private repos stay protected.
        </p>
      </div>
    </div>
  );
}

const steps = [WelcomeStep, HowItWorksStep, QuickTipsStep, SecurityStep];

// ─── Main dialog ────────────────────────────────────────────

export function HelpDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const pathname = usePathname();

  // Auto-show on first visit (not on /d/ routes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onboarded = localStorage.getItem(STORAGE_KEY);
    if (!onboarded && !pathname.startsWith("/d/")) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for custom event (from navbar help icon)
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setDirection(0);
      setOpen(true);
    };
    document.addEventListener("mdcolab:show-help", handler);
    return () => document.removeEventListener("mdcolab:show-help", handler);
  }, []);

  const markOnboarded = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const close = useCallback(() => {
    markOnboarded();
    setOpen(false);
  }, [markOnboarded]);

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      close();
    }
  }, [step, close]);

  const back = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const StepComponent = steps[step];

  const primaryLabel = step === 0 ? "Get Started" : step === TOTAL_STEPS - 1 ? "Got it" : "Next";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else setOpen(true); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Help &amp; Onboarding</DialogTitle>

        {/* Skip button */}
        <div className="flex justify-end px-4 pt-3">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={close}>
            Skip
          </Button>
        </div>

        {/* Content area */}
        <div className="relative min-h-[320px] px-6 pb-2 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots + navigation */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30"
                }`}
                onClick={() => {
                  setDirection(i > step ? 1 : -1);
                  setStep(i);
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {primaryLabel}
              {step < TOTAL_STEPS - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Trigger button for the navbar */
export function HelpButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Help & onboarding"
      onClick={() => document.dispatchEvent(new CustomEvent("mdcolab:show-help"))}
    >
      <CircleHelp className="h-4 w-4" />
    </Button>
  );
}
