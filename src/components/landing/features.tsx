"use client";

import { type Variants, motion } from "framer-motion";
import {
  FileEdit,
  MessageSquare,
  Link2,
  GitCompareArrows,
  Lock,
  Moon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  className: string;
}

const features: Feature[] = [
  {
    icon: FileEdit,
    title: "WYSIWYG Editor",
    description:
      "Write markdown with a Notion-like editor. Tables, code blocks, task lists — all beautiful.",
    className: "md:col-span-2",
  },
  {
    icon: MessageSquare,
    title: "Word-Style Comments",
    description:
      "Select any text to comment. Threaded replies, @mentions, and resolution — just like Word.",
    className: "md:col-span-1",
  },
  {
    icon: Link2,
    title: "Share via URL",
    description:
      "One link to share. Anyone with a GitHub account can review and comment.",
    className: "md:col-span-1",
  },
  {
    icon: GitCompareArrows,
    title: "Suggested Edits",
    description:
      "Propose changes with inline diffs. Authors accept or reject with one click.",
    className: "md:col-span-2",
  },
  {
    icon: Lock,
    title: "Version Controlled",
    description:
      "Everything lives in your GitHub repo. Comments are sidecar JSON files — fully versioned.",
    className: "md:col-span-2",
  },
  {
    icon: Moon,
    title: "Dark Mode First",
    description:
      "A premium dark theme that looks stunning. Light mode too, if you must.",
    className: "md:col-span-1",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to{" "}
          <span className="text-primary">collaborate on markdown</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Built for teams who write in markdown and need real-time feedback
          without leaving GitHub.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            className={`glass rounded-xl p-6 ${feature.className}`}
            variants={itemVariants}
          >
            <feature.icon className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-2 text-lg font-semibold tracking-tight">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
