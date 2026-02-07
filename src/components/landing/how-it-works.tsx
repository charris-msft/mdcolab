"use client";

import { motion } from "framer-motion";
import { FileText, Share2, MessageSquare, GitBranch } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "Write in Markdown",
    description: "Use a rich WYSIWYG editor or write raw markdown — your docs live in your GitHub repo, version-controlled.",
  },
  {
    icon: Share2,
    title: "Share via URL",
    description: "Generate a link and share it with anyone. They see beautifully rendered markdown — no GitHub account needed to view.",
  },
  {
    icon: MessageSquare,
    title: "Comment like Word",
    description: "Reviewers select text and add comments, just like Microsoft Word. Threaded replies, resolve, and reopen.",
  },
  {
    icon: GitBranch,
    title: "Everything in GitHub",
    description: "Comments are stored as GitHub Issues. Edits commit to your repo. No extra databases, no vendor lock-in.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-20 border-t border-border/40">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold sm:text-4xl">
            How it <span className="text-primary">works</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Four simple steps from draft to collaborative review — no .docx files required.
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="relative rounded-xl border border-border/60 bg-card/50 p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="absolute -top-3 left-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
