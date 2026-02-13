# mdcolab — Product Requirements Document

## Document Information

| Field | Value |
| --- | --- |
| **Product Name** | mdcolab |
| **Version** | 1.2 |
| **Author** | charris |
| **Date** | 2026-02-07 |
| **Last Updated** | 2026-02-07 |
| **Status** | Updated |

## Revision History

| Date | Version | Changes |
| --- | --- | --- |
| 2026-02-07 | 1.2 | Added descriptive tooltips with keyboard shortcuts on all editor toolbar, bubble toolbar, and comment sidebar buttons/toggles (§3.4, §6); comment threads in sidebar now sorted by document position (top to bottom) instead of creation time (§3.5.2, §6); bidirectional comment highlighting — clicking a comment in the sidebar highlights anchored text with pulse animation, clicking highlighted text opens sidebar and activates corresponding thread, uses `data-comment-mark` attributes on rendered spans (§3.5.2); dashboard repo cards now show `owner/reponame` format with muted owner prefix (§3.2); localStorage-based recent documents tracking displayed on dashboard with relative timestamps, file name, repo path, and direct links, max 10 entries (§3.2); active comment marks have brighter highlight + CSS pulse animation, hover state shows intermediate highlight (§6); updated Next.js to 16.1.6 (§7.1); added Vitest and Playwright to tech stack (§7.1). |
| 2025-07-17 | 1.1 | Updated PRD to reflect actual implementation: comment storage changed from sidecar JSON to GitHub Issues (§4); auto-save replaced with manual save (EDIT-9); deployment changed from App Service to Azure Container Apps (§7.1); auth clarified as next-auth v4 (§7.1); permission model refined (§2.2, AUTH-5); added new features — file creation, onboarding wizard, review mode commenting, comment anchor highlighting (§3); updated key technical decisions (§7.3); updated glossary (§12). |
| 2026-02-07 | 1.0 | Initial draft |

---

## 1. Executive Summary

**mdcolab** is a web application that transforms how teams collaborate on written documents. It brings the commenting and review experience of Microsoft Word to markdown files stored in GitHub repositories — while adding a premium WYSIWYG editing experience that eliminates the need to switch between markdown editors and .docx files.

Authors write and edit markdown documents in a rich WYSIWYG editor (comparable to Notion), while reviewers open a shared URL, see beautifully rendered content, and add text-anchored comments with threaded replies. Comments are stored as **GitHub Issues** on the repository — meaning anyone with read access can participate in reviews without needing write/push access to the repo.

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
6. Comments are stored as **GitHub Issues** on the repository — reviewers only need read access
7. Everyone can reply and resolve threads via the GitHub Issues integration

---

## 2. Target Users

### 2.1 Primary Users

| Persona | Description | Key Need |
| --- | --- | --- |
| **Document Author** | Technical writer, PM, engineer, architect, or team lead who writes documents in markdown | Edit documents in a rich WYSIWYG editor while seeing reviewer comments. Save as clean markdown to GitHub. |
| **Document Reviewer** | Colleague, stakeholder, or subject-matter expert asked to provide feedback | Read rendered markdown and add text-anchored comments, replies, and suggested edits — without needing to understand markdown or GitHub. |

### 2.2 User Requirements [Updated]

- All users must have a GitHub account (GitHub OAuth is the sole authentication method)
- Authors must have `push` access to the repository to edit documents AND comment
- Reviewers need at minimum `read` access to the repository to view and comment (commenting uses GitHub Issues, which only requires read access)
- Users without any access to a repository are redirected to sign in, then receive a 404 from the GitHub API
- No software installation required — the app runs entirely in the browser

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| AUTH-1 | Users authenticate via GitHub OAuth 2.0 (next-auth v4) | P0 |
| AUTH-2 | The app requests `repo` scope to read/write repository files and issues | P0 |
| AUTH-3 | User sessions persist across browser sessions (refresh tokens) | P0 |
| AUTH-4 | Users can sign out and revoke access | P0 |
| AUTH-5 | Permission model: users with `push` access can edit documents and comment; users with `read` access can view and comment (via GitHub Issues); users without access are redirected to sign in and receive a 404 from the GitHub API | P0 |
| AUTH-6 | Unauthenticated users who visit a document URL are redirected to sign in, then returned to the document | P0 |

### 3.2 Repository & File Navigation [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| NAV-1 | Dashboard shows the user's recent documents and repositories. Repository cards display `owner/reponame` format with a muted owner prefix. | P0 |
| NAV-2 | Users can browse their accessible GitHub repositories (personal + org) | P0 |
| NAV-3 | Users can browse the file tree of a repository and select markdown files (.md, .mdx) | P0 |
| NAV-4 | Users can switch branches when browsing a repository | P1 |
| NAV-5 | Repository list supports search/filter by name | P1 |
| NAV-6 | File tree shows markdown files with an indicator if they have existing comments | P2 |
| NAV-7 | **New file creation**: A "+ New" button in the repo browser allows users to create new `.md` files inline | P0 |
| NAV-8 | **Recent documents**: localStorage-based tracking of recently opened documents (max 10 entries), displayed on the dashboard with relative timestamps, file name, repo path, and direct links | P0 |
| NAV-9 | **Repository owner display**: Repository cards on the dashboard show `owner/reponame` format with a muted owner prefix | P0 |

### 3.3 Document Viewing

| ID | Requirement | Priority |
| --- | --- | --- |
| VIEW-1 | Markdown files render as beautifully formatted documents (not raw markdown) | P0 |
| VIEW-2 | Rendering supports GitHub-Flavored Markdown: headings, bold, italic, strikethrough, links, images, code blocks, blockquotes, tables, task lists, horizontal rules | P0 |
| VIEW-3 | Code blocks render with syntax highlighting and a language label | P0 |
| VIEW-4 | Math expressions render via KaTeX (`$inline$` and `$$block$$`) | P1 |
| VIEW-5 | The document uses premium typography: reading-optimized max-width, generous line-height, Inter font for prose, JetBrains Mono for code | P0 |
| VIEW-6 | Commented text is highlighted with a soft yellow background | P0 |
| VIEW-7 | Hovering over commented text shows a tooltip preview of the first comment in the thread | P1 |
| VIEW-8 | Clicking commented text scrolls the comment sidebar to that thread | P0 |

### 3.4 Document Editing (WYSIWYG) [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| EDIT-1 | Authors can toggle between **Edit mode** and **Review mode** | P0 |
| EDIT-2 | Edit mode provides a WYSIWYG editing experience — authors see formatted output as they type, not raw markdown | P0 |
| EDIT-3 | A **floating bubble toolbar** appears on text selection with formatting options: bold, italic, strikethrough, inline code, link, highlight, comment, suggest edit | P0 |
| EDIT-4 | A **slash command menu** appears when typing `/`, allowing insertion of: headings (1-6), bullet list, numbered list, task list, blockquote, code block (with language picker), horizontal rule, table, image, callout/admonition, math block | P0 |
| EDIT-5 | **Tables** are editable: insert/delete rows and columns, toggle header row, cell navigation via Tab | P0 |
| EDIT-6 | **Code blocks** include a language selector dropdown, syntax highlighting, and a copy button | P0 |
| EDIT-7 | **Images** can be inserted by pasting, drag-and-drop, or URL. Pasted/dropped images are committed to the repo as assets. | P1 |
| EDIT-8 | Keyboard shortcuts work as expected: Cmd+B bold, Cmd+I italic, Cmd+K link, Cmd+Z undo, Cmd+Shift+Z redo | P0 |
| EDIT-9 | **Manual save only**: Changes are saved to GitHub via Ctrl+S / Cmd+S or the Save button. A dirty-state indicator shows unsaved changes. There is no auto-save — saving to a GitHub repository is an intentional action to avoid accidental commits. | P0 |
| EDIT-10 | **Markdown round-trip fidelity**: The WYSIWYG editor saves clean, idiomatic markdown. Editing a file and saving it should not introduce formatting drift, extra whitespace, or structural changes to unedited sections. | P0 |
| EDIT-11 | YAML frontmatter is preserved through the edit cycle (extracted before parsing, re-prepended on save) | P1 |
| EDIT-12 | Drag-and-drop block reordering: paragraphs, headings, and list items can be reordered by dragging a handle | P2 |
| EDIT-13 | While editing, comment highlights and the comment sidebar remain visible — authors can see feedback while they write | P0 |
| EDIT-14 | **Tooltips**: All interactive buttons and toggles in the editor toolbar, bubble toolbar, and comment sidebar have descriptive tooltips with keyboard shortcuts where applicable | P0 |

### 3.5 Comment System

#### 3.5.1 Comment Creation [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| CMT-1 | Users can select any text in the rendered document and create a comment anchored to that selection | P0 |
| CMT-2 | In Edit mode, comment creation is triggered by: (a) clicking "Comment" in the bubble toolbar, or (b) pressing Ctrl+Alt+M | P0 |
| CMT-3 | In Review mode (non-editable), a **floating "Comment" button** appears near the text selection to trigger comment creation | P0 |
| CMT-4 | The selected text is highlighted and a new empty comment thread appears in the sidebar with focus in the text input | P0 |
| CMT-5 | Comments are posted by pressing Ctrl+Enter or clicking the Post button | P0 |
| CMT-6 | After posting, the comment is created as a GitHub Issue; the highlight persists on the text and the thread appears in the sidebar | P0 |
| CMT-7 | Users can create document-level comments (not anchored to specific text) via a "General Comment" button | P1 |

#### 3.5.2 Comment Display & Navigation [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| CMT-10 | Comments appear in a **right-hand sidebar panel** with a glass-effect (translucent) background | P0 |
| CMT-11 | Each comment thread card shows: highlighted text excerpt, author avatar + name, timestamp, comment body, reply count | P0 |
| CMT-12 | **Bidirectional comment highlighting**: Clicking a comment card in the sidebar highlights the anchored text in the document with a pulse animation; clicking highlighted text in the document opens the sidebar and activates the corresponding comment thread. Uses `data-comment-mark` attributes on rendered spans. | P0 |
| CMT-13 | **Comment ordering**: Comment threads in the sidebar are sorted by document position (top to bottom), matching the order text appears in the file, not by creation time | P0 |
| CMT-14 | **Next/Previous navigation** buttons allow jumping between comment threads (Ctrl+Alt+↓/↑) | P1 |
| CMT-15 | Clicking a comment card scrolls the document to the anchored text | P0 |
| CMT-16 | The currently active/focused comment thread is visually distinguished (brighter highlight, elevated card) | P1 |
| CMT-17 | A badge in the toolbar shows the count of open comment threads | P1 |

#### 3.5.3 Threaded Replies [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| CMT-20 | Users can reply to any comment thread | P0 |
| CMT-21 | Replies are stored as GitHub Issue comments on the corresponding Issue and displayed nested within the thread card, each with its own author avatar, timestamp, and body | P0 |
| CMT-22 | Replying to a thread triggers a notification for the thread's participants | P1 |

#### 3.5.4 Comment Resolution [Updated]

| ID | Requirement | Priority |
| --- | --- | --- |
| CMT-30 | Any participant can resolve a comment thread (this closes the corresponding GitHub Issue) | P0 |
| CMT-31 | Resolved threads are visually dimmed (reduced opacity) or hidden, depending on the active filter | P0 |
| CMT-32 | A filter toggle in the sidebar allows viewing: **Open**, **Resolved**, or **All** threads | P0 |
| CMT-33 | Resolved threads can be re-opened (this reopens the corresponding GitHub Issue) | P0 |
| CMT-34 | The text highlight for resolved threads changes from yellow to a subtle gray | P1 |

#### 3.5.5 Comment Editing & Deletion

| ID | Requirement | Priority |
| --- | --- | --- |
| CMT-40 | Users can edit their own comments (shows "edited" indicator with timestamp) | P0 |
| CMT-41 | Users can delete their own comments | P0 |
| CMT-42 | If all comments in a thread are deleted, the thread and its text highlight are removed | P0 |

### 3.6 @Mentions

| ID | Requirement | Priority |
| --- | --- | --- |
| MEN-1 | Typing `@` in a comment body opens an autocomplete dropdown of GitHub usernames | P0 |
| MEN-2 | The autocomplete searches GitHub users via the API, filtered by characters typed after `@` | P0 |
| MEN-3 | Selected mentions render as styled pills (linked to GitHub profile) in the comment body | P1 |
| MEN-4 | Mentioned users receive a notification (in-app notification bell) | P1 |
| MEN-5 | Mentions are stored in the comment body text within the GitHub Issue | P0 |

### 3.7 Suggested Edits

| ID | Requirement | Priority |
| --- | --- | --- |
| SUG-1 | When creating a comment on a text selection, users can click "Suggest Edit" to propose replacement text | P0 |
| SUG-2 | The suggestion shows a **diff preview**: original text with red strikethrough and proposed text in green | P0 |
| SUG-3 | The document author (or anyone with push access) can **Accept** or **Reject** the suggestion | P0 |
| SUG-4 | Accepting a suggestion replaces the anchored text in the document and marks the suggestion as accepted | P0 |
| SUG-5 | Rejecting a suggestion marks it as rejected without changing the document | P0 |
| SUG-6 | Suggested edits are stored within the comment body in the GitHub Issue | P0 |

### 3.8 Track Changes

| ID | Requirement | Priority |
| --- | --- | --- |
| TRK-1 | A "Track Changes" toggle shows all pending, accepted, and rejected suggestions inline in the document | P1 |
| TRK-2 | Pending suggestions display as: original text with strikethrough + proposed text with colored underline | P1 |
| TRK-3 | Accepted changes show a brief green flash animation, then appear as normal text | P2 |
| TRK-4 | A track changes history panel lists all suggestions chronologically with their status | P2 |

### 3.9 Sharing

| ID | Requirement | Priority |
| --- | --- | --- |
| SHR-1 | Every document has a shareable URL: `/d/{owner}/{repo}/{branch}/{...path}` | P0 |
| SHR-2 | A "Share" button copies the URL to the clipboard with a confirmation toast | P0 |
| SHR-3 | Anyone with a GitHub account who has read access to the repository can open the URL, view the document, and add comments | P0 |
| SHR-4 | The sharing URL is the same as the editing URL — the UI adapts based on the user's permission level | P0 |

### 3.10 Search & Filtering

| ID | Requirement | Priority |
| --- | --- | --- |
| SRC-1 | A **command palette** (Cmd+K) provides quick access to: navigate to heading, search comments, switch mode, toggle sidebar | P1 |
| SRC-2 | Comment sidebar supports filtering by: author, status (open/resolved), date range | P1 |
| SRC-3 | Full-text search across comment bodies with highlighted results in the sidebar | P2 |

### 3.11 Onboarding & Help [New]

| ID | Requirement | Priority |
| --- | --- | --- |
| ONB-1 | A **4-page onboarding wizard** is shown on the user's first visit to guide them through the app's features | P0 |
| ONB-2 | The onboarding flow includes security guidance about using test accounts and repositories for evaluation | P0 |
| ONB-3 | Users can dismiss the wizard and it will not reappear (persisted via localStorage) | P0 |
| ONB-4 | A "Help" button in the toolbar allows users to replay the onboarding wizard at any time | P1 |

---

## 4. Comment Storage Specification [Updated]

### 4.1 Storage Model [Updated]

Comments are stored as **GitHub Issues** on the repository. This approach was chosen over the original sidecar JSON design because reviewers typically have read access (not push/write access) to a repository — and GitHub Issues can be created by anyone with read access.

- Each comment thread = one GitHub Issue
- Issue title format: `[mdcolab] "selected text excerpt..." — filepath`
- Two labels per Issue: `mdcolab` (global identifier) + `file:{filepath}` (per-file filtering)
- The Issue body contains comment metadata in an HTML comment block (invisible when rendered) followed by the first comment text
- Thread replies = GitHub Issue comments
- Resolving a thread = closing the GitHub Issue
- Reopening a thread = reopening the GitHub Issue

**Key benefit**: Anyone with read access to the repository can create and participate in comment threads — no write/push access needed. This enables true collaborative review where stakeholders, managers, and subject-matter experts can provide feedback without being repository contributors.

### 4.2 Issue Structure [Updated]

**Issue Title:**
```
[mdcolab] "first 50 chars of selected text..." — path/to/document.md
```

**Issue Labels:**
- `mdcolab` — applied to all mdcolab comment Issues for global identification
- `file:path/to/document.md` — applied for per-file filtering when loading comments

**Issue Body:**
```markdown
<!-- mdcolab-metadata
{
  "anchor": {
    "selectedText": "the exact text that was highlighted",
    "prefix": "30 chars before the selection",
    "suffix": "30 chars after the selection"
  },
  "filepath": "path/to/document.md",
  "branch": "main"
}
-->

The actual comment text written by the reviewer.
```

The HTML comment block (`<!-- mdcolab-metadata ... -->`) is invisible when viewing the Issue on GitHub but is parsed by mdcolab to reconstruct the comment anchor.

### 4.3 Concurrency & Consistency [Updated]

- GitHub Issues have built-in concurrency handling — no SHA-based optimistic locking needed for comments
- Multiple users can comment simultaneously without conflict
- Issue state (open/closed) is authoritative for thread resolution status
- Comments are loaded by querying Issues with the `mdcolab` label and `file:{filepath}` label

### 4.4 Anchor Resilience

When a document is edited outside mdcolab (e.g., in VS Code), the anchored text may no longer match:

1. On load, attempt exact match of `selectedText` in the current document content
2. If exact match fails, perform fuzzy search using `selectedText` + `prefix`/`suffix` context
3. If fuzzy match succeeds, re-anchor the comment to the new position
4. If fuzzy match fails, mark the thread as **orphaned** and display it in a separate "Orphaned Comments" section in the sidebar

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
| --- | --- | --- |
| PERF-1 | Initial page load (document view) | &lt; 2 seconds (LCP) |
| PERF-2 | Time to interactive (editor ready) | &lt; 3 seconds |
| PERF-3 | Comment post latency (optimistic) | &lt; 200ms perceived |
| PERF-4 | Document save latency | &lt; 2 seconds (GitHub API round-trip) |
| PERF-5 | Support documents up to 100KB of markdown (\~50 pages of prose) | No degradation |

### 5.2 Reliability

| ID | Requirement |
| --- | --- |
| REL-1 | Optimistic UI for all comment operations — UI updates immediately, reconciles with server response |
| REL-2 | Manual save with conflict detection — if the file has changed on GitHub since loading, warn the user before overwriting |
| REL-3 | Graceful degradation when GitHub API is unavailable — show cached content with "offline" indicator |
| REL-4 | All errors surface via toast notifications with actionable messages |

### 5.3 Security

| ID | Requirement |
| --- | --- |
| SEC-1 | GitHub OAuth tokens stored server-side in encrypted sessions (never exposed to client) |
| SEC-2 | All API routes validate session authentication |
| SEC-3 | Users can only access repositories they have permission to view on GitHub |
| SEC-4 | No server-side database — no user data stored outside GitHub |
| SEC-5 | Comment bodies sanitized to prevent XSS in rendered output |

### 5.4 Accessibility

| ID | Requirement |
| --- | --- |
| A11Y-1 | All interactive elements are keyboard-navigable |
| A11Y-2 | Comment sidebar is navigable via keyboard (Tab, Arrow keys, Enter) |
| A11Y-3 | Color contrast meets WCAG 2.1 AA standards in both light and dark mode |
| A11Y-4 | Screen reader support for comment threads (ARIA labels, live regions for new comments) |
| A11Y-5 | Focus management: focus moves to comment input when creating a new comment |

### 5.5 Browser Support

| Browser | Version |
| --- | --- |
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
| --- | --- | --- |
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

### 6.5 Comment Highlight UX [Updated]

- **Active comment marks** have a brighter highlight (`--comment-highlight-active`) plus a CSS pulse animation to draw the user's eye
- **Hover state** on comment marks shows an intermediate highlight between the default and active states
- **Comment ordering** in the sidebar matches document flow — threads are sorted by their anchor position in the document (top to bottom), not by creation time
- **Bidirectional activation**: Clicking a comment card pulses the anchored text; clicking anchored text opens the sidebar and activates the corresponding thread

### 6.6 Key Interactions [Updated]

| Interaction | Behavior |
| --- | --- |
| Select text in document | Bubble toolbar appears above selection with: Bold, Italic, Code, Link, Highlight, **Comment**, Suggest Edit. All buttons have descriptive tooltips with keyboard shortcuts. |
| Click "Comment" in toolbar | Sidebar scrolls to a new empty thread card; text gets yellow highlight; cursor focuses in comment input |
| Post a comment | Comment appears in thread; highlight becomes permanent; toast confirms "Comment added" |
| Hover over highlighted text | Tooltip shows first comment preview; highlight intensifies |
| Click highlighted text | Sidebar opens (if closed) and activates the corresponding comment thread; thread card elevates/glows to indicate active state. Uses `data-comment-mark` attributes on rendered spans. |
| Click comment card | Document scrolls to anchored text; highlight pulses with CSS animation |
| Resolve a thread | Card dims with slide animation; highlight changes to gray; count badge updates |
| Type `/` in edit mode | Slash command dropdown appears with block options, filterable by typing |
| Press Cmd+K | Command palette opens (centered modal) with search input |
| Press Cmd+S | Document saves to GitHub; save indicator shows "Saving..." → "Saved ✓" |
| Drag block handle | Block lifts with shadow; drop zone indicators appear between other blocks |

---

## 7. Technical Architecture

### 7.1 Stack [Updated]

| Component | Technology | Rationale |
| --- | --- | --- |
| Framework | Next.js 16.1.6 (App Router), TypeScript | SSR for initial load, API routes for backend, server components |
| Editor | Tiptap 2 (ProseMirror-based) | Headless WYSIWYG, custom marks for comments, extensions for slash commands, markdown serialization |
| Markdown serialization | `tiptap-markdown` + custom serializers | Clean round-trip: markdown → Tiptap JSON → markdown |
| Auth | NextAuth.js v4 (GitHub OAuth) — uses `NextAuthOptions` + `getServerSession` pattern | Industry-standard, built-in session management |
| GitHub API | Octokit | Official SDK, typed, maintained by GitHub |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI | Utility-first CSS, accessible component primitives |
| Animation | Framer Motion | Declarative animations, layout transitions |
| State | Zustand | Lightweight global state (editor state, comment state, UI state) |
| Data fetching | TanStack Query | Caching, optimistic updates, background refetch, stale-while-revalidate |
| Icons | Lucide React | Consistent with shadcn/ui |
| Fonts | Inter (UI), JetBrains Mono (code) | Premium, readable, open-source |
| Unit Testing | Vitest | Fast, ESM-native test runner compatible with the Next.js/TypeScript stack |
| E2E Testing | Playwright | Cross-browser end-to-end testing for critical user flows |
| Deployment | Azure Container Apps | Containerized hosting via Container Registry, Managed Identity with AcrPull role, Consumption plan, deployed via `azd up` |

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
    │   ├── GET  /api/comments/:owner/:repo/:path      → Load comments (GitHub Issues with mdcolab + file: labels)
    │   ├── POST /api/comments/:owner/:repo/:path      → Create comment (GitHub Issue)
    │   ├── POST /api/comments/:owner/:repo/:path/:issueNumber/reply  → Reply (Issue comment)
    │   ├── PATCH /api/comments/:owner/:repo/:path/:issueNumber       → Resolve/reopen (close/open Issue)
    │   └── GET  /api/users/search?q=          → Search GitHub users
    │
    └── External
        ├── GitHub OAuth (authentication)
        └── GitHub REST API (file read/write, Issues for comments, user search)
```

### 7.3 Key Technical Decisions [Updated]

#### Tiptap as the Unified Core

Using Tiptap for both viewing (read-only) and editing eliminates the need for two separate rendering paths. View mode is simply `editor.setEditable(false)`. Comment marks work identically in both modes. ProseMirror's position mapping system keeps comment anchors stable during editing — when text is inserted before a comment mark, the mark's position adjusts automatically. The `tiptap-markdown` extension handles round-trip serialization between markdown and the editor's internal document model.

#### No Database

All persistent state lives in the GitHub repository — documents as files, comments as Issues. This means:

- Zero infrastructure beyond the web app itself
- Comments leverage GitHub's built-in issue tracking (notifications, search, API)
- No data migration, no database management, no backup strategy needed
- Trade-off: no real-time push updates (polling or manual refresh for now)

#### GitHub Issues vs. Sidecar JSON [Updated]

The original design specified sidecar `.comments.json` files committed alongside documents. This was changed to **GitHub Issues** because:

- **Access control**: Sidecar JSON files require push/write access to commit. Reviewers typically have read-only access. GitHub Issues can be created by anyone with read access to the repo.
- **Built-in features**: GitHub Issues provide notifications, search, cross-references, and a web UI for free
- **No merge conflicts**: Unlike committed files, Issues don't create merge conflicts when multiple reviewers comment simultaneously
- **Metadata in HTML comments**: Anchor metadata (selected text, prefix, suffix) is stored in an HTML comment block in the Issue body — invisible in the GitHub UI but parseable by mdcolab

Trade-offs vs. sidecar JSON:
- Comments are not inline with the file in the repo (they live in the Issues tab)
- Comments are not as easily consumed by AI tools that scan file trees
- Comment data is tied to the GitHub Issues API rather than being plain files

#### Manual Save vs. Auto-Save [Updated]

The original design specified auto-save with a 3-second debounce. This was changed to **manual save only** (Ctrl+S / Save button) because saving to a GitHub repository creates a commit — an intentional, versioned action. Auto-saving could produce noisy commit histories and accidental changes, especially for shared repositories.

#### Azure Container Apps vs. App Service [Updated]

Deployment uses **Azure Container Apps** (Consumption plan) instead of Azure App Service:

- Docker image stored in Azure Container Registry
- Managed Identity with AcrPull role for secure image pulls
- Consumption plan eliminates the need for VM quota
- Deployed via `azd up` for streamlined infrastructure provisioning

---

## 8. URL Routing

| Route | Page | Auth Required |
| --- | --- | --- |
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
| --- | --- | --- |
| Time to first comment | &lt; 30 seconds from opening a shared URL | Analytics event tracking |
| Markdown round-trip fidelity | 100% for standard GFM documents | Automated test suite |
| Editor responsiveness | &lt; 50ms input latency | Lighthouse / real-user monitoring |
| Comment anchor accuracy | &gt; 95% correct re-anchoring after external edits | Automated test + manual QA |
| User retention | &gt; 40% weekly return rate | Analytics |

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Markdown round-trip introduces formatting drift | High — data corruption | Medium | Comprehensive test suite with 50+ markdown documents. Diff on every save to detect drift. |
| GitHub API rate limits (5,000/hr) exceeded by heavy users | Medium — degraded experience | Medium | Aggressive caching (TanStack Query), conditional requests (ETags), debounced writes. Show rate limit to user. |
| Concurrent comment writes cause data loss | ~~High~~ Low — GitHub Issues handle concurrency natively | ~~Low~~ N/A | GitHub Issues have built-in concurrency; no SHA-based merging needed. Multiple reviewers can comment simultaneously without conflict. |
| Comment anchors break after large document restructuring | Medium — orphaned comments | Medium | Fuzzy re-anchoring with selectedText + context. Orphaned comments UI. "Re-anchor" manual action. |
| Tiptap markdown serializer doesn't handle edge cases | High — garbled output | Medium | Custom serializer overrides. Extensive test coverage. User can view raw markdown before saving. |
| Performance degrades on very large documents (&gt;100KB) | Medium — slow editor | Low | Virtual scrolling for long docs. Warn on large files. Lazy-load comment sidebar. |

---

## 11. Future Considerations (Out of Scope for v1) [Updated]

| Feature | Description |
| --- | --- |
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
| Sidecar JSON export | Optional export of comment threads to a sidecar `.comments.json` file for AI tooling and offline analysis. (Original v1 storage model — replaced by GitHub Issues for accessibility reasons.) |
| SVG connector lines | Visual SVG lines linking highlighted text in the document to the corresponding comment card in the sidebar. (Original v1 design — replaced by click-to-scroll anchor highlighting.) |
| Auto-save mode | Optional auto-save with configurable debounce for users who prefer automatic commits. (Original v1 design — replaced by manual save for intentional commit control.) |

---

## 12. Glossary [Updated]

| Term | Definition |
| --- | --- |
| **GitHub Issue (comment storage)** | Each comment thread is stored as a GitHub Issue on the repository, with metadata in an HTML comment block and thread replies as Issue comments |
| **Thread** | A comment and its replies, anchored to a specific text selection or the document as a whole, represented as a single GitHub Issue |
| **Anchor** | The text selection (or document reference) that a comment thread is attached to, stored as metadata in the GitHub Issue body |
| **Orphaned comment** | A comment whose anchored text can no longer be found in the document (e.g., the text was deleted) |
| **Bubble toolbar** | A floating toolbar that appears above selected text with formatting and commenting options |
| **Slash commands** | A menu triggered by typing `/` that allows inserting blocks (headings, lists, tables, etc.) |
| **Track changes** | A view mode that shows pending, accepted, and rejected suggested edits inline in the document |
| **Round-trip fidelity** | The property that converting markdown → editor state → markdown produces identical output |
| **Review mode** | A non-editable viewing mode where reviewers can read the document and add comments via a floating Comment button |
| **Onboarding wizard** | A 4-page introductory flow shown on first visit to guide users through the app's features and security guidance |


<!-- anonymous edit test -->