# mdcolab — Product Requirements Document

## Document Information

| Field | Value |
|-------|-------|
| **Product Name** | mdcolab |
| **Version** | 1.0 |
| **Author** | charris |
| **Date** | 2026-02-07 |
| **Status** | Draft |

---

## 1. Executive Summary

**mdcolab** is a web application that transforms how teams collaborate on written documents. It brings the commenting and review experience of Microsoft Word to markdown files stored in GitHub repositories — while adding a premium WYSIWYG editing experience that eliminates the need to switch between markdown editors and .docx files.

Authors write and edit markdown documents in a rich WYSIWYG editor (comparable to Notion), while reviewers open a shared URL, see beautifully rendered content, and add text-anchored comments with threaded replies, @mentions, suggested edits, and track changes. All data — the document and its comments — lives as plain text files in the GitHub repository, fully version-controlled and AI-friendly.

### The Problem

Technical writers, product managers, and engineering teams increasingly author documents in markdown because:
- AI tools can read, generate, and modify it natively
- It's plain text — diffs are meaningful, version control works perfectly
- It lives alongside code in the same repository

But when it's time for review and collaboration, authors are forced to copy their markdown into Microsoft Word or Google Docs because:
- There's no way to add Word-style comments to a markdown file
- IDEs and editors don't understand sidecar comment files
- GitHub PR reviews are line-based, not text-selection-based — designed for code, not prose

**mdcolab eliminates this gap entirely.**

### The Solution

A web application where:
1. Authors connect their GitHub repos and open any markdown file
2. The file renders as a beautiful, readable document (not raw markdown)
3. Authors can **edit** in a rich WYSIWYG editor that saves back to markdown in the repo
4. Authors share a URL with reviewers
5. Reviewers highlight any text and add comments — exactly like Microsoft Word
6. Comments are stored as a sidecar JSON file (`doc.md.comments.json`) in the same repo
7. Everyone can reply, resolve, @mention, suggest edits, and track changes

---

## 2. Target Users

### 2.1 Primary Users

| Persona | Description | Key Need |
|---------|-------------|----------|
| **Document Author** | Technical writer, PM, engineer, architect, or team lead who writes documents in markdown | Edit documents in a rich WYSIWYG editor while seeing reviewer comments. Save as clean markdown to GitHub. |
| **Document Reviewer** | Colleague, stakeholder, or subject-matter expert asked to provide feedback | Read rendered markdown and add text-anchored comments, replies, and suggested edits — without needing to understand markdown or GitHub. |

### 2.2 User Requirements

- All users must have a GitHub account (GitHub OAuth is the sole authentication method)
- Authors must have `push` access to the repository to edit documents
- Reviewers need at minimum `read` access to the repository to view and comment
- No software installation required — the app runs entirely in the browser

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-1 | Users authenticate via GitHub OAuth 2.0 | P0 |
| AUTH-2 | The app requests `repo` scope to read/write repository files | P0 |
| AUTH-3 | User sessions persist across browser sessions (refresh tokens) | P0 |
| AUTH-4 | Users can sign out and revoke access | P0 |
| AUTH-5 | Permission model: users with `push` access to a repo can edit documents; users with `read` access can view and comment | P0 |
| AUTH-6 | Unauthenticated users who visit a document URL are redirected to sign in, then returned to the document | P0 |

### 3.2 Repository & File Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| NAV-1 | Dashboard shows the user's recent documents and repositories | P0 |
| NAV-2 | Users can browse their accessible GitHub repositories (personal + org) | P0 |
| NAV-3 | Users can browse the file tree of a repository and select markdown files (.md, .mdx) | P0 |
| NAV-4 | Users can switch branches when browsing a repository | P1 |
| NAV-5 | Repository list supports search/filter by name | P1 |
| NAV-6 | File tree shows markdown files with an indicator if they have existing comments | P2 |

### 3.3 Document Viewing

| ID | Requirement | Priority |
|----|-------------|----------|
| VIEW-1 | Markdown files render as beautifully formatted documents (not raw markdown) | P0 |
| VIEW-2 | Rendering supports GitHub-Flavored Markdown: headings, bold, italic, strikethrough, links, images, code blocks, blockquotes, tables, task lists, horizontal rules | P0 |
| VIEW-3 | Code blocks render with syntax highlighting and a language label | P0 |
| VIEW-4 | Math expressions render via KaTeX (`$inline$` and `$$block$$`) | P1 |
| VIEW-5 | The document uses premium typography: reading-optimized max-width, generous line-height, Inter font for prose, JetBrains Mono for code | P0 |
| VIEW-6 | Commented text is highlighted with a soft yellow background | P0 |
| VIEW-7 | Hovering over commented text shows a tooltip preview of the first comment in the thread | P1 |
| VIEW-8 | Clicking commented text scrolls the comment sidebar to that thread | P0 |

### 3.4 Document Editing (WYSIWYG)

| ID | Requirement | Priority |
|----|-------------|----------|
| EDIT-1 | Authors can toggle between **Edit mode** and **Review mode** | P0 |
| EDIT-2 | Edit mode provides a WYSIWYG editing experience — authors see formatted output as they type, not raw markdown | P0 |
| EDIT-3 | A **floating bubble toolbar** appears on text selection with formatting options: bold, italic, strikethrough, inline code, link, highlight, comment, suggest edit | P0 |
| EDIT-4 | A **slash command menu** appears when typing `/`, allowing insertion of: headings (1-6), bullet list, numbered list, task list, blockquote, code block (with language picker), horizontal rule, table, image, callout/admonition, math block | P0 |
| EDIT-5 | **Tables** are editable: insert/delete rows and columns, toggle header row, cell navigation via Tab | P0 |
| EDIT-6 | **Code blocks** include a language selector dropdown, syntax highlighting, and a copy button | P0 |
| EDIT-7 | **Images** can be inserted by pasting, drag-and-drop, or URL. Pasted/dropped images are committed to the repo as assets. | P1 |
| EDIT-8 | Keyboard shortcuts work as expected: Cmd+B bold, Cmd+I italic, Cmd+K link, Cmd+Z undo, Cmd+Shift+Z redo | P0 |
| EDIT-9 | **Auto-save**: Changes auto-save to GitHub after a 3-second debounce of inactivity. A dirty-state indicator shows unsaved changes. Manual save via Cmd+S. | P0 |
| EDIT-10 | **Markdown round-trip fidelity**: The WYSIWYG editor saves clean, idiomatic markdown. Editing a file and saving it should not introduce formatting drift, extra whitespace, or structural changes to unedited sections. | P0 |
| EDIT-11 | YAML frontmatter is preserved through the edit cycle (extracted before parsing, re-prepended on save) | P1 |
| EDIT-12 | Drag-and-drop block reordering: paragraphs, headings, and list items can be reordered by dragging a handle | P2 |
| EDIT-13 | While editing, comment highlights and the comment sidebar remain visible — authors can see feedback while they write | P0 |

### 3.5 Comment System

#### 3.5.1 Comment Creation

| ID | Requirement | Priority |
|----|-------------|----------|
| CMT-1 | Users can select any text in the rendered document and create a comment anchored to that selection | P0 |
| CMT-2 | Comment creation is triggered by: (a) clicking "Comment" in the bubble toolbar, or (b) pressing Ctrl+Alt+M | P0 |
| CMT-3 | The selected text is highlighted and a new empty comment thread appears in the sidebar with focus in the text input | P0 |
| CMT-4 | Comments are posted by pressing Ctrl+Enter or clicking the Post button | P0 |
| CMT-5 | After posting, the comment mark (highlight) persists on the text and the thread appears in the sidebar | P0 |
| CMT-6 | Users can create document-level comments (not anchored to specific text) via a "General Comment" button | P1 |

#### 3.5.2 Comment Display & Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| CMT-10 | Comments appear in a **right-hand sidebar panel** with a glass-effect (translucent) background | P0 |
| CMT-11 | Each comment thread card shows: highlighted text excerpt, author avatar + name, timestamp, comment body, reply count | P0 |
| CMT-12 | **SVG connector lines** visually link the highlighted text in the document to the corresponding comment card in the sidebar | P1 |
| CMT-13 | The sidebar scrolls in sync with the document — comments stay aligned with their anchored text | P0 |
| CMT-14 | **Next/Previous navigation** buttons allow jumping between comment threads (Ctrl+Alt+↓/↑) | P1 |
| CMT-15 | Clicking a comment card scrolls the document to the anchored text | P0 |
| CMT-16 | The currently active/focused comment thread is visually distinguished (brighter highlight, elevated card) | P1 |
| CMT-17 | A badge in the toolbar shows the count of open comment threads | P1 |

#### 3.5.3 Threaded Replies

| ID | Requirement | Priority |
|----|-------------|----------|
| CMT-20 | Users can reply to any comment in a thread | P0 |
| CMT-21 | Replies are displayed nested within the thread card, each with its own author avatar, timestamp, and body | P0 |
| CMT-22 | Replying to a thread triggers a notification for the thread's participants | P1 |

#### 3.5.4 Comment Resolution

| ID | Requirement | Priority |
|----|-------------|----------|
| CMT-30 | Any participant can resolve a comment thread | P0 |
| CMT-31 | Resolved threads are visually dimmed (reduced opacity) or hidden, depending on the active filter | P0 |
| CMT-32 | A filter toggle in the sidebar allows viewing: **Open**, **Resolved**, or **All** threads | P0 |
| CMT-33 | Resolved threads can be re-opened | P0 |
| CMT-34 | The text highlight for resolved threads changes from yellow to a subtle gray | P1 |

#### 3.5.5 Comment Editing & Deletion

| ID | Requirement | Priority |
|----|-------------|----------|
| CMT-40 | Users can edit their own comments (shows "edited" indicator with timestamp) | P0 |
| CMT-41 | Users can delete their own comments | P0 |
| CMT-42 | If all comments in a thread are deleted, the thread and its text highlight are removed | P0 |

### 3.6 @Mentions

| ID | Requirement | Priority |
|----|-------------|----------|
| MEN-1 | Typing `@` in a comment body opens an autocomplete dropdown of GitHub usernames | P0 |
| MEN-2 | The autocomplete searches GitHub users via the API, filtered by characters typed after `@` | P0 |
| MEN-3 | Selected mentions render as styled pills (linked to GitHub profile) in the comment body | P1 |
| MEN-4 | Mentioned users receive a notification (in-app notification bell) | P1 |
| MEN-5 | Mentions are stored in the comment's `mentions` array in the sidecar JSON | P0 |

### 3.7 Suggested Edits

| ID | Requirement | Priority |
|----|-------------|----------|
| SUG-1 | When creating a comment on a text selection, users can click "Suggest Edit" to propose replacement text | P0 |
| SUG-2 | The suggestion shows a **diff preview**: original text with red strikethrough and proposed text in green | P0 |
| SUG-3 | The document author (or anyone with push access) can **Accept** or **Reject** the suggestion | P0 |
| SUG-4 | Accepting a suggestion replaces the anchored text in the document and marks the suggestion as accepted | P0 |
| SUG-5 | Rejecting a suggestion marks it as rejected without changing the document | P0 |
| SUG-6 | Suggested edits are stored in the comment's `suggestedEdit` field in the sidecar JSON | P0 |

### 3.8 Track Changes

| ID | Requirement | Priority |
|----|-------------|----------|
| TRK-1 | A "Track Changes" toggle shows all pending, accepted, and rejected suggestions inline in the document | P1 |
| TRK-2 | Pending suggestions display as: original text with strikethrough + proposed text with colored underline | P1 |
| TRK-3 | Accepted changes show a brief green flash animation, then appear as normal text | P2 |
| TRK-4 | A track changes history panel lists all suggestions chronologically with their status | P2 |

### 3.9 Sharing

| ID | Requirement | Priority |
|----|-------------|----------|
| SHR-1 | Every document has a shareable URL: `/d/{owner}/{repo}/{branch}/{...path}` | P0 |
| SHR-2 | A "Share" button copies the URL to the clipboard with a confirmation toast | P0 |
| SHR-3 | Anyone with a GitHub account who has read access to the repository can open the URL, view the document, and add comments | P0 |
| SHR-4 | The sharing URL is the same as the editing URL — the UI adapts based on the user's permission level | P0 |

### 3.10 Search & Filtering

| ID | Requirement | Priority |
|----|-------------|----------|
| SRC-1 | A **command palette** (Cmd+K) provides quick access to: navigate to heading, search comments, switch mode, toggle sidebar | P1 |
| SRC-2 | Comment sidebar supports filtering by: author, status (open/resolved), date range | P1 |
| SRC-3 | Full-text search across comment bodies with highlighted results in the sidebar | P2 |

---

## 4. Comment Storage Specification

### 4.1 Storage Model

Comments are stored in a **sidecar JSON file** alongside the markdown document in the same GitHub repository.

- For a document at `docs/design.md`, comments are stored at `docs/design.md.comments.json`
- The sidecar file is committed to the repository like any other file
- This means comments are version-controlled, searchable, and AI-readable

### 4.2 Schema

```jsonc
{
  "version": "1.0",
  "documentHash": "sha256-of-md-content-at-time-of-last-save",
  "threads": [
    {
      "id": "uuid-v4",
      "status": "open | resolved",
      "anchor": {
        "type": "text-range | document",
        "markdownOffset": {          // only for text-range type
          "start": 1423,
          "end": 1489
        },
        "selectedText": "the exact text that was highlighted",
        "context": {
          "before": "30 chars before the selection",
          "after": "30 chars after the selection"
        }
      },
      "comments": [
        {
          "id": "uuid-v4",
          "author": {
            "login": "github-username",
            "avatarUrl": "https://github.com/username.png"
          },
          "body": "Comment text with @mentions",
          "mentions": ["username1", "username2"],
          "suggestedEdit": null | {
            "replacement": "proposed replacement text",
            "status": "pending | accepted | rejected",
            "resolvedBy": "github-username | null",
            "resolvedAt": "ISO-8601 | null"
          },
          "createdAt": "ISO-8601",
          "updatedAt": "ISO-8601 | null"
        }
      ]
    }
  ]
}
```

### 4.3 Concurrency Control

- File updates use GitHub's `sha` parameter for optimistic concurrency
- On SHA mismatch (409 conflict): fetch latest version, merge comment arrays by UUID, retry
- Comment UUIDs ensure idempotent merges — no duplicate threads from concurrent writes

### 4.4 Anchor Resilience

When a document is edited outside mdcolab (e.g., in VS Code), character offsets may shift:

1. On load, attempt exact offset match against the current markdown content
2. If `selectedText` at the stored offset doesn't match, perform fuzzy search using `selectedText` + `context` (before/after text)
3. If fuzzy match succeeds, re-anchor and update offsets on next save
4. If fuzzy match fails, mark the thread as **orphaned** and display it in a separate "Orphaned Comments" section in the sidebar

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| PERF-1 | Initial page load (document view) | < 2 seconds (LCP) |
| PERF-2 | Time to interactive (editor ready) | < 3 seconds |
| PERF-3 | Comment post latency (optimistic) | < 200ms perceived |
| PERF-4 | Document save latency | < 2 seconds (GitHub API round-trip) |
| PERF-5 | Support documents up to 100KB of markdown (~50 pages of prose) | No degradation |

### 5.2 Reliability

| ID | Requirement |
|----|-------------|
| REL-1 | Optimistic UI for all comment operations — UI updates immediately, reconciles with server response |
| REL-2 | Auto-save with conflict detection and retry (no silent data loss) |
| REL-3 | Graceful degradation when GitHub API is unavailable — show cached content with "offline" indicator |
| REL-4 | All errors surface via toast notifications with actionable messages |

### 5.3 Security

| ID | Requirement |
|----|-------------|
| SEC-1 | GitHub OAuth tokens stored server-side in encrypted sessions (never exposed to client) |
| SEC-2 | All API routes validate session authentication |
| SEC-3 | Users can only access repositories they have permission to view on GitHub |
| SEC-4 | No server-side database — no user data stored outside GitHub |
| SEC-5 | Comment bodies sanitized to prevent XSS in rendered output |

### 5.4 Accessibility

| ID | Requirement |
|----|-------------|
| A11Y-1 | All interactive elements are keyboard-navigable |
| A11Y-2 | Comment sidebar is navigable via keyboard (Tab, Arrow keys, Enter) |
| A11Y-3 | Color contrast meets WCAG 2.1 AA standards in both light and dark mode |
| A11Y-4 | Screen reader support for comment threads (ARIA labels, live regions for new comments) |
| A11Y-5 | Focus management: focus moves to comment input when creating a new comment |

### 5.5 Browser Support

| Browser | Version |
|---------|---------|
| Chrome | Latest 2 versions |
| Firefox | Latest 2 versions |
| Safari | Latest 2 versions |
| Edge | Latest 2 versions |
| Mobile Safari (iOS) | Latest version |
| Chrome (Android) | Latest version |

---

## 6. UI/UX Specifications

### 6.1 Design Philosophy

**"Linear meets Notion"** — The interface should feel fast, clean, and premium. Every pixel should look intentional. The design should make people say "I want to use this" before they even understand what it does.

### 6.2 Design Principles

1. **Content is king**: The markdown document is the primary focus. All UI chrome (toolbars, sidebars) is secondary and recedes when not in use.
2. **Dark-first**: The dark theme is the default and the hero in all marketing materials. Light mode is fully supported but dark mode is the "brand" experience.
3. **Motion with purpose**: Framer Motion animations for panel transitions, toolbar appearances, comment highlights. Never gratuitous — every animation conveys meaning (appearing, moving, completing).
4. **Typography-driven**: Inter for UI, reading-optimized serif or sans-serif for document body, JetBrains Mono for code. Generous line-height, optimal reading width (65-75 characters).
5. **Glass and depth**: Subtle glassmorphism for floating panels (comment sidebar, toolbars, command palette). Creates a sense of layered interface without being distracting.

### 6.3 Color System

#### Dark Mode (Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `hsl(222, 47%, 6%)` | Page background |
| `--surface` | `hsl(222, 35%, 10%)` | Card/panel backgrounds |
| `--surface-hover` | `hsl(222, 30%, 14%)` | Hover and active states |
| `--border` | `hsl(222, 20%, 18%)` | Borders and dividers |
| `--text-primary` | `hsl(210, 40%, 96%)` | Primary text |
| `--text-secondary` | `hsl(215, 20%, 55%)` | Secondary/muted text |
| `--accent` | `hsl(250, 80%, 65%)` | Primary actions, links |
| `--accent-hover` | `hsl(250, 80%, 72%)` | Hover on accent elements |
| `--success` | `hsl(142, 71%, 45%)` | Resolved, accepted |
| `--warning` | `hsl(38, 92%, 50%)` | Pending suggestions |
| `--danger` | `hsl(0, 84%, 60%)` | Errors, rejected |
| `--comment-highlight` | `hsla(50, 100%, 60%, 0.15)` | Commented text background |
| `--comment-highlight-active` | `hsla(50, 100%, 60%, 0.30)` | Active/hovered comment highlight |

#### Light Mode

Inverted luminance values with the same hue palette. Accent colors remain consistent. Comment highlights use a slightly more opaque yellow.

### 6.4 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [← Back] [File Path breadcrumb]    [Edit│Review]  │
│           [Share] [💬 12] [⋮ Menu]           [Save ✓]      │
├─────────────────────────────────────┬───────────────────────┤
│                                     │                       │
│           Document Area             │   Comment Sidebar     │
│     (centered, max-width 720px)     │   (320px, glass bg)   │
│                                     │                       │
│     ┌──────────────────────┐        │   ┌─────────────────┐ │
│     │ # Heading            │        │   │ Thread 1        │ │
│     │                      │        │   │ "selected text" │ │
│     │ Paragraph text with  │───────────▶│ @user: comment  │ │
│     │ [highlighted text]   │        │   │ [Reply] [✓]     │ │
│     │ continues here...    │        │   └─────────────────┘ │
│     │                      │        │                       │
│     │ More content...      │        │   ┌─────────────────┐ │
│     │                      │        │   │ Thread 2        │ │
│     │ Another [highlighted │───────────▶│ ...             │ │
│     │ section] of text     │        │   └─────────────────┘ │
│     └──────────────────────┘        │                       │
│                                     │   [Open ▾] [+ General]│
├─────────────────────────────────────┴───────────────────────┤
│  Status bar: GitHub API: 4,832/5,000 │ Last saved 2m ago   │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 Key Interactions

| Interaction | Behavior |
|-------------|----------|
| Select text in document | Bubble toolbar appears above selection with: Bold, Italic, Code, Link, Highlight, **Comment**, Suggest Edit |
| Click "Comment" in toolbar | Sidebar scrolls to a new empty thread card; text gets yellow highlight; cursor focuses in comment input |
| Post a comment | Comment appears in thread; highlight becomes permanent; toast confirms "Comment added" |
| Hover over highlighted text | Tooltip shows first comment preview; highlight intensifies |
| Click highlighted text | Sidebar scrolls to thread; thread card elevates/glows to indicate active state |
| Click comment card | Document scrolls to anchored text; highlight pulses briefly |
| Resolve a thread | Card dims with slide animation; highlight changes to gray; count badge updates |
| Type `/` in edit mode | Slash command dropdown appears with block options, filterable by typing |
| Press Cmd+K | Command palette opens (centered modal) with search input |
| Press Cmd+S | Document saves to GitHub; save indicator shows "Saving..." → "Saved ✓" |
| Drag block handle | Block lifts with shadow; drop zone indicators appear between other blocks |

---

## 7. Technical Architecture

### 7.1 Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 14+ (App Router), TypeScript | SSR for initial load, API routes for backend, server components |
| Editor | Tiptap 2 (ProseMirror-based) | Headless WYSIWYG, custom marks for comments, extensions for slash commands, markdown serialization |
| Markdown serialization | `tiptap-markdown` + custom serializers | Clean round-trip: markdown → Tiptap JSON → markdown |
| Auth | NextAuth.js (GitHub OAuth) | Industry-standard, built-in session management |
| GitHub API | Octokit | Official SDK, typed, maintained by GitHub |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI | Utility-first CSS, accessible component primitives |
| Animation | Framer Motion | Declarative animations, layout transitions |
| State | Zustand | Lightweight global state (editor state, comment state, UI state) |
| Data fetching | TanStack Query | Caching, optimistic updates, background refetch, stale-while-revalidate |
| Icons | Lucide React | Consistent with shadcn/ui |
| Fonts | Inter (UI), JetBrains Mono (code) | Premium, readable, open-source |
| Deployment | Azure App Service | Managed hosting, CI/CD via GitHub Actions |

### 7.2 Architecture Diagram

```
Browser (Client)
    │
    ├── Next.js App (React Server Components + Client Components)
    │   ├── Tiptap Editor (client)
    │   │   ├── Markdown Extension (parse/serialize)
    │   │   ├── Comment Mark Extension (custom)
    │   │   ├── Slash Commands Extension
    │   │   └── Bubble Toolbar Extension
    │   ├── Comment Sidebar (client)
    │   │   ├── Thread Cards
    │   │   ├── SVG Connectors
    │   │   └── Reply/Resolve UI
    │   ├── Zustand Stores
    │   │   ├── EditorStore (document state, dirty flag)
    │   │   └── CommentStore (threads, active thread, filters)
    │   └── TanStack Query (data fetching layer)
    │
    ├── Next.js API Routes / Server Actions
    │   ├── GET  /api/repos                    → List user repos
    │   ├── GET  /api/repos/:owner/:repo/tree  → File tree
    │   ├── GET  /api/file/:owner/:repo/:branch/:path  → File content
    │   ├── PUT  /api/file/:owner/:repo/:branch/:path  → Save file
    │   ├── GET  /api/comments/:owner/:repo/:branch/:path  → Load comments
    │   ├── PUT  /api/comments/:owner/:repo/:branch/:path  → Save comments
    │   └── GET  /api/users/search?q=          → Search GitHub users
    │
    └── External
        ├── GitHub OAuth (authentication)
        └── GitHub REST API (file read/write, user search)
```

### 7.3 Key Technical Decisions

#### Tiptap as the Unified Core
Using Tiptap for both viewing (read-only) and editing eliminates the need for two separate rendering paths. View mode is simply `editor.setEditable(false)`. Comment marks work identically in both modes. ProseMirror's position mapping system keeps comment anchors stable during editing — when text is inserted before a comment mark, the mark's position adjusts automatically.

#### No Database
All persistent state lives in the GitHub repository as files. This means:
- Zero infrastructure beyond the web app itself
- Comments are version-controlled alongside the document
- No data migration, no database management, no backup strategy needed
- Trade-off: no real-time push updates (polling or manual refresh for now)

#### Sidecar JSON vs. PR Comments
We chose sidecar JSON files over GitHub PR review comments because:
- PR comments are tied to the PR lifecycle (closed PR = hard to find comments)
- PR comments are line-based, not text-selection-based
- Sidecar files are permanent, portable, and independent of Git workflows
- Sidecar files can be read/written by AI tools, scripts, and other apps

---

## 8. URL Routing

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing page (marketing) | No |
| `/auth/signin` | GitHub OAuth sign-in | No |
| `/auth/callback` | OAuth callback handler | No |
| `/dashboard` | User dashboard (recent docs, repos) | Yes |
| `/repos` | Repository browser | Yes |
| `/repos/{owner}/{repo}` | File tree browser | Yes |
| `/d/{owner}/{repo}/{branch}/{...path}` | Document view/edit + comments | Yes |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first comment | < 30 seconds from opening a shared URL | Analytics event tracking |
| Markdown round-trip fidelity | 100% for standard GFM documents | Automated test suite |
| Editor responsiveness | < 50ms input latency | Lighthouse / real-user monitoring |
| Comment anchor accuracy | > 95% correct re-anchoring after external edits | Automated test + manual QA |
| User retention | > 40% weekly return rate | Analytics |

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Markdown round-trip introduces formatting drift | High — data corruption | Medium | Comprehensive test suite with 50+ markdown documents. Diff on every save to detect drift. |
| GitHub API rate limits (5,000/hr) exceeded by heavy users | Medium — degraded experience | Medium | Aggressive caching (TanStack Query), conditional requests (ETags), debounced writes. Show rate limit to user. |
| Concurrent comment writes cause data loss | High — user frustration | Low | SHA-based optimistic concurrency, UUID-based merge, automatic retry with user notification. |
| Comment anchors break after large document restructuring | Medium — orphaned comments | Medium | Fuzzy re-anchoring with selectedText + context. Orphaned comments UI. "Re-anchor" manual action. |
| Tiptap markdown serializer doesn't handle edge cases | High — garbled output | Medium | Custom serializer overrides. Extensive test coverage. User can view raw markdown before saving. |
| Performance degrades on very large documents (>100KB) | Medium — slow editor | Low | Virtual scrolling for long docs. Warn on large files. Lazy-load comment sidebar. |

---

## 11. Future Considerations (Out of Scope for v1)

| Feature | Description |
|---------|-------------|
| Real-time collaboration | Multiple cursors, live typing via Tiptap Collaboration (Hocuspocus server). Requires a WebSocket backend. |
| GitLab/Bitbucket support | Abstract the Git provider layer to support other platforms. |
| AI writing assistant | `/ai` slash commands for summarize, expand, rewrite, translate. Leverage LLM APIs. |
| GitHub App integration | Install as a GitHub App for automatic comment notifications via GitHub's notification system. |
| Offline support | Service worker for offline viewing and comment queuing. |
| Mobile native app | React Native or PWA for mobile-optimized experience. |
| Export to PDF/DOCX | Generate PDF or .docx from rendered markdown with comments as margin notes. |
| Approval workflows | "Approve" / "Request Changes" actions like GitHub PR reviews. |
| Comment templates | Predefined comment templates (e.g., "Needs clarification", "Out of scope"). |
| Analytics dashboard | Author dashboard showing review activity, response times, resolution rates. |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **Sidecar file** | A companion file (e.g., `doc.md.comments.json`) stored alongside the markdown file in the same directory |
| **Thread** | A comment and its replies, anchored to a specific text selection or the document as a whole |
| **Anchor** | The text selection (or document reference) that a comment thread is attached to |
| **Orphaned comment** | A comment whose anchored text can no longer be found in the document (e.g., the text was deleted) |
| **Bubble toolbar** | A floating toolbar that appears above selected text with formatting and commenting options |
| **Slash commands** | A menu triggered by typing `/` that allows inserting blocks (headings, lists, tables, etc.) |
| **Track changes** | A view mode that shows pending, accepted, and rejected suggested edits inline in the document |
| **Round-trip fidelity** | The property that converting markdown → editor state → markdown produces identical output |
