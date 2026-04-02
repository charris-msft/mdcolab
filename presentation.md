# mdcolab — Presentation Notes

> **Format:** 2–3 minute elevator pitch + live tricks. Workshop-style — help attendees start building today.

---

## 📌 What I Built

**mdcolab** — a web app that brings the Microsoft Word commenting experience to markdown files stored in GitHub.

- Authors write & edit markdown in a **rich WYSIWYG editor** (like Notion) backed by their GitHub repo
- Reviewers open a **shared URL**, see beautifully rendered content, and **add Word-style comments** anchored to text selections
- Comments are stored as **GitHub Issues** — reviewers only need read access, no push access required
- **GitHub Copilot AI Assistant** built-in — helps write, edit, review, and improve documents directly in the editor
- **Anonymous sharing** with expiration — share docs with anyone via link, 7-day default expiry
- Deployed to **Azure Container Apps** with full CI/CD

### The Problem It Solves

Technical writers, PMs, and engineers write in markdown because AI tools understand it natively, diffs are meaningful, and it lives alongside code. But when it's time for review, they copy into Word or Google Docs because there's no way to add Word-style comments to a markdown file. **mdcolab eliminates that gap entirely.**

### Key Features

| Feature | Details |
|---------|---------|
| WYSIWYG Editor | Tiptap 2 — headless, extensible, markdown round-trip |
| GitHub-Backed Storage | Every save is a commit to your repo |
| Inline Comments | Text-anchored threads via GitHub Issues |
| Share via URL | Friendly links with file names, optional anonymous access |
| Copilot AI Assistant | Edit mode (rewrites sections) + Review mode (Q&A without changes) |
| Sharing Expiration | 7-day default, configurable, managed from a "Shared Docs" page |

---

## 🔧 How I Built It

### Tech Stack

- **Next.js 16** (App Router, React Server Components, TypeScript)
- **Tiptap 2** (ProseMirror-based rich-text editor)
- **shadcn/ui** + **Tailwind CSS 4** + **Framer Motion** — dark-first glassmorphism design
- **GitHub API** — repo & file operations, Issues for comments
- **GitHub Copilot SDK** (`@github/copilot-sdk`) — AI assistant integration
- **Zustand** — state management (editor, comments, notifications)
- **TanStack Query** — data fetching with 10-second comment polling
- **Azure Container Apps** — deployment (consumption plan, no VM quota needed)

### Build Process — Copilot CLI as the Engine

The entire app was **built using GitHub Copilot CLI** (the terminal agent). Here's how:

1. **Started with a PRD** — wrote a detailed product requirements doc in markdown (naturally!)
2. **Plan-first approach** — Copilot CLI generated an implementation plan with 50+ todos
3. **Fleet-mode parallel execution** — dispatched multiple background agents in parallel to build features simultaneously (e.g., AI chat panel, streaming API, Dockerfile all built concurrently)
4. **Iterative refinement** — live-tested, reported bugs in chat, Copilot fixed them in context
5. **PRD updates** — after major changes (like switching from sidecar JSON to GitHub Issues), asked Copilot to update the PRD to match reality

### Scale of the Project

- **~12,000 lines** of TypeScript/TSX across **120 source files**
- **93 commits** over ~7 weeks (Feb 6 – Mar 30, 2026)
- Features built: WYSIWYG editor, comment system, sharing, Copilot AI, anonymous access, VS Code extension, landing page, onboarding wizard, keyboard shortcuts, command palette, theme switching, and more

---

## ⏱️ How Much Time/Toil This Saves

### For the End User (Document Authors & Reviewers)

- **Eliminates the markdown → Word → markdown conversion loop** — no more copying docs into Word just for review
- **Comments live in GitHub Issues** — no separate tool, no lost feedback, everything in the repo
- **AI-assisted writing** — Copilot helps draft, edit, and review documents in-place

### For the Builder (Me)

- **The initial app was scaffolded and functional in a single extended Copilot CLI session** — from PRD to deployed on Azure
- 50+ features implemented via parallel agent dispatch — **tasks that would take days sequentially were done in hours**
- Bug fixes were conversational: "the toolbar scrolls with the content" → Copilot investigated, identified the CSS issue, and fixed it
- Infrastructure was generated — Bicep templates, Dockerfile, `azure.yaml`, CI/CD workflow — all via `azd` + Copilot
- PRD was kept in sync with implementation — Copilot updated 20+ sections when I said "fleet deployed, update the PRD"

---

## 🚧 Challenges

### Technical Challenges

1. **GitHub Issues as comment storage** — Original plan used sidecar JSON files, but that requires write/push access. Reviewers don't have that. Pivoting to GitHub Issues was the critical architectural decision — anyone with read access can comment.

2. **Copilot SDK in containers** — The SDK spawns a CLI subprocess (`@github/copilot` binary). Alpine Linux (musl) didn't work — had to switch to `node:22-slim` (glibc). Node 22+ required. Getting this right in the Dockerfile took multiple iterations.

3. **EMU (Enterprise Managed User) accounts** — EMU tokens return zero repos, zero installations. Enterprise admin must explicitly allow the app. Discovered this the hard way and had to build special error handling and documentation.

4. **Azure Container Apps vs App Service** — Every subscription I tried had ZERO App Service VM quota across all SKUs and regions. Container Apps (consumption plan) was the only option that worked without quota requests.

5. **Comment anchor drift** — When document text changes, comment anchors can break. Built a 3-tier fallback: exact match → fuzzy match → mark as orphaned.

6. **Windows Docker + Azure CLI encoding bug** — ACR build crashed with `UnicodeEncodeError` when Next.js output contained Unicode triangle characters. The image actually pushed successfully despite the CLI crash — confusing to debug.

7. **False "unsaved changes" on load** — Tiptap fires `onUpdate` during initial markdown→ProseMirror conversion. Fixed with a `useRef` guard that only enables dirty tracking after user interaction.

### Process Challenges

- **Copilot agent context limits** — Long sessions require checkpointing; the agent loses context of earlier work. Breaking work into focused sessions helped.
- **Secrets management** — The agent correctly refused to handle credentials directly. Had to manually set secrets via Azure CLI.
- **VPN interference** — VPN blocked `management.azure.com` and ACR login. Had to turn it off for every deployment.

---

## 💡 Advice for Other Builders

### Working with Copilot CLI Effectively

1. **Start with a PRD** — Give the agent a clear, detailed spec. The better your requirements doc, the better the output. I wrote mine in markdown (of course) and kept it updated as the app evolved.

2. **Use plan mode** — Let Copilot generate a structured implementation plan with todos and dependencies. This keeps both you and the agent aligned on what's next.

3. **Dispatch agents in parallel** — For independent features, use background agents. I built the AI chat panel, streaming API, and Dockerfile updates all simultaneously. This is where the real time savings come from.

4. **Iterate conversationally** — Don't try to get everything right in one prompt. Live-test, report what's broken, and let the agent fix it in context. "The toolbar scrolls away when I scroll the doc" is a perfectly good bug report.

5. **Let the agent update documentation** — After big changes, ask Copilot to update your PRD/docs. It's remarkably good at identifying what changed and updating 20+ sections in one pass.

6. **Keep sessions focused** — Rather than one marathon session, break work into focused chunks. The agent works better with clear, scoped tasks.

7. **Trust but verify** — Copilot makes great architectural decisions (like switching from sidecar JSON to GitHub Issues), but always test the deployed result. Some bugs only appear in production (like the Alpine/musl incompatibility).

### Architecture Tips

- **GitHub Issues for comments** is a powerful pattern — free, searchable, integrates with existing workflows, and requires minimal permissions
- **Azure Container Apps consumption plan** bypasses VM quota issues that plague App Service
- **Manual save (not auto-save) for Git-backed apps** — accidental commits are too disruptive
- **Tiptap as a unified viewer/editor** — one component handles both modes, reducing complexity significantly

---

## 🔗 Links

- **Live App**: [mdcolab on Azure Container Apps](https://ca-web-v6zqqr2u3p5du.calmflower-64b2252f.eastus2.azurecontainerapps.io/)
- **GitHub Repo**: [charris-msft/mdcolab](https://github.com/charris-msft/mdcolab)
