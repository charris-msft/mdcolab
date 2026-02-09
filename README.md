# mdcolab

Collaborative markdown editing backed by GitHub. A modern alternative to Word for document collaboration — share markdown files via URL, leave inline comments, and get AI-powered writing assistance with GitHub Copilot.

## Key Features

- **Rendered markdown viewing & WYSIWYG editing** — read and edit documents with a rich-text editor
- **GitHub-backed storage** — files stay in your repo; every save is a commit
- **Document sharing via URL** — share any markdown file with a link
- **Inline commenting & threaded discussions** — leave comments on specific text, just like Word
- **GitHub Copilot AI Assistant** — AI-powered help for writing and editing documents

## Copilot AI Assistant

Open the Copilot panel with the ✨ sparkle button in the toolbar.

**Edit mode** — AI edits the document directly. Ask it to rewrite sections, fix grammar, add content, or change details. Edits are applied automatically and can be undone with Ctrl+Z.

**Review mode** — Ask questions about the document without making changes. Useful for summaries, fact-checking, or brainstorming.

**Selected text as context** — Select text in the editor, then ask AI to improve, expand, or rephrase just that section.

**Input history** — Press Up/Down arrow keys in the prompt input to recall previous prompts.

> Requires a GitHub Copilot subscription.

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env.local` file with the following variables:

```
GITHUB_ID=<your GitHub OAuth app client ID>
GITHUB_SECRET=<your GitHub OAuth app client secret>
NEXTAUTH_SECRET=<a random secret for NextAuth.js>
NEXTAUTH_URL=http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Tech Stack

- [Next.js 16](https://nextjs.org) — App Router, React Server Components
- [Tiptap](https://tiptap.dev) — rich-text / WYSIWYG editor
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Tailwind CSS](https://tailwindcss.com) — styling
- [GitHub API](https://docs.github.com/en/rest) — repo & file operations
- [GitHub Copilot SDK](https://github.com/features/copilot) — AI assistant integration

## Deployment

The app ships with a `Dockerfile` and Azure Container Apps infrastructure (`infra/` directory). Deploy with the Azure Developer CLI:

```bash
azd up
```
