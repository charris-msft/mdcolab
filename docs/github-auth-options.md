# mdcolab: GitHub Authentication Options — Analysis & Tradeoffs

**Date:** February 10, 2026  
**Author:** mdcolab team  
**Purpose:** Document authentication approaches we've tried, their tradeoffs, and open questions for the GitHub team.

---

## The Problem

mdcolab is a web app that lets users collaboratively review and edit markdown files stored in GitHub repos. To do this, we need:

1. **List repos** — Show users their repos so they can pick a file to view/edit
2. **Read file content** — Fetch markdown files from repos (public and private)
3. **Write file content** — Save edits back to repos
4. **Read/write issues** — We store comments as GitHub issues (comment threading)
5. **User identity** — Know who's logged in for attribution

The challenge: we want **minimal permissions** (users shouldn't see scary consent screens), but we need access to **both public and private repos**, and we need to list **all** repos the user can access.

---

## Approaches We've Tried

### Approach 1: OAuth App with `repo` scope

**Configuration:**
```typescript
GitHubProvider({
  clientId: "Ov23ctivrJzbqq2T3GRG",  // OAuth App client ID
  clientSecret: "...",
  authorization: {
    params: {
      scope: "repo read:user user:email",
    },
  },
})
```

**What worked:**
- ✅ `GET /user/repos` returns ALL repos the user has access to (owned, collaborator, org member)
- ✅ Read/write to any repo the user has push access to
- ✅ Issues API works for all repos
- ✅ Single sign-in, no additional installation step
- ✅ Permission check via `repos.get()` returns correct `permissions.push` flag

**What didn't work:**
- ❌ **Scary consent screen** — `repo` scope requests: "Full control of private repositories" including Settings, Webhooks, Deploy keys, Collaboration invites, etc. Users complained.
- ❌ No way to request a narrower subset — `repo` is all-or-nothing for private repos
- ❌ `public_repo` scope exists but is public-only — useless for private repos

**Why we moved away:** User complaints about the permission consent screen. The `repo` scope requests far more access than we actually use.

---

### Approach 2: GitHub App with fine-grained permissions (current)

**Configuration:**
```typescript
GitHubProvider({
  clientId: "Iv23ctc9KSI7srvH4eM7",  // GitHub App client ID
  clientSecret: "...",
  // No scope param — permissions configured on the App itself
})
```

**GitHub App permissions (configured on github.com):**
- Contents: Read & Write
- Issues: Read & Write
- Metadata: Read-only

**What works:**
- ✅ Clean consent screen — only shows Contents + Issues permissions
- ✅ Fine-grained: no access to settings, webhooks, deploy keys, etc.
- ✅ Works for both public and private repos (where installed)
- ✅ Read/write files and issues within installed repos
- ✅ `repos.get()` returns correct `permissions.push` for installed repos

**What doesn't work:**
- ❌ **Private repos are invisible without App installation** — The token has `scopes: "none"` and `installations: []`. Private repos owned by the user do NOT appear in `GET /user/repos`.
- ❌ **Public org repos clutter the list** — `GET /user/repos` returns all public repos where the user is a member/collaborator (e.g., primer/, octodemo/, githubtraining/), even with zero installations. These repos are noise for most users.
- ❌ **Users must install the App on their account** to see private repos. They must go to GitHub → Settings → Applications → mdcolab → Configure → select repos. This is a significant UX friction barrier.
- ❌ **New users see org repos but not their own private repos**, which is confusing and looks broken.
- ❌ Users may be unwilling to install an unknown GitHub App on their repos, especially private ones.

**Empirical findings (Feb 10, 2026):**
We built a debug endpoint (`/api/debug`) that revealed the actual token behavior:
```json
{
  "token_scopes": "none",
  "installations": [],
  "repos_from_listForAuthenticatedUser": [
    // 20 repos returned, ALL public, mostly org repos (primer/*, octodemo/*)
    // User's own public repo (charris-msft/squad) appeared at position 15
    // User's private repos (charris-msft/mdcolab, azure-plugin) NOT returned
    // Repos are sorted by updated_at, so active org repos push user's own repos down
  ]
}
```

Key finding: **The GitHub App user-to-server token behaves like a scopeless token for repo listing — it returns all public repos the user has access to (org membership, collaborator), but NOT private repos.** This contradicts some documentation that says only installed repos are returned. The reality is:
- Public repos: visible based on user's org membership/collaborator status (no installation needed)
- Private repos: require App installation on the user's account

**Why this is problematic:** The entire value prop of mdcolab is "share a link to a markdown file and collaborate." Requiring App installation adds friction that kills the lightweight sharing model. It's like needing to install a Word plugin before you can open a .docx link someone sent you.

**Empirical findings — Enterprise Managed User (EMU) accounts (Feb 10, 2026):**

We tested with an EMU account (`charris_microsoft`, managed by Microsoft EMU). The debug endpoint returned:
```json
{
  "user": "charris_microsoft",
  "token_scopes": "none",
  "installations": [],
  "repos_from_listForAuthenticatedUser": []
}
```

**Zero repos returned** — even public repos the user has access to. This is dramatically different from the personal account (`charris-msft`) which returned 20+ public repos with zero installations.

Key findings for EMU accounts:
- The "free public repo access" behavior seen on personal accounts does **not** work for EMU accounts
- The GitHub App install page doesn't show the EMU user's personal account — only enterprise organizations appear
- Enterprise orgs may have "Installations and requests are disabled" policies (e.g., `ms-copilot` in the Microsoft EMU)
- **The GitHub App token is completely inert on EMU accounts without enterprise admin approval**

**Critical implication for enterprise adoption:** The exact audience most likely to pay for mdcolab — enterprise teams using GitHub EMU for internal documentation — is the audience that **cannot use it** without enterprise admin intervention. This creates a chicken-and-egg problem: the app can't demonstrate value until it's approved, and it won't be approved until it demonstrates value.

---

## 🏢 Enterprise Managed Users (EMU) — Critical Blocker

> **This section is specifically for enterprise admin conversations.** The rest of the document covers personal GitHub accounts, which have different (less restrictive) behavior.

### The Problem for EMU Users

mdcolab **does not work at all** for Enterprise Managed User accounts without enterprise admin intervention. When an EMU user signs into mdcolab:

- **Zero repos are returned** — not even public repos
- **Zero installations are available** — the user can't install the app on their own account  
- **The token is completely inert** — every API call returns empty results

This is in stark contrast to personal GitHub accounts, where even without any app installation, users can see and access all public repos they're a member/collaborator of.

### What We Tested

| Test | Personal Account (`charris-msft`) | EMU Account (`charris_microsoft`) |
|---|---|---|
| `token_scopes` | `"none"` | `"none"` |
| `installations` | `[]` | `[]` |
| `listForAuthenticatedUser` | 20+ public repos | **0 repos** |
| Can install app on personal account? | ✅ Yes | ❌ Account not shown |
| Can install app on org? | N/A | ⚠️ Some orgs say "disabled" |
| App install page shows | Personal account + orgs | Only orgs (some disabled) |

### Why EMU Accounts Are Blocked

1. **Enterprise policy controls app installations.** EMU accounts are managed by the enterprise; individual users cannot install third-party GitHub Apps without enterprise admin approval.

2. **The app installation page doesn't show the user's personal EMU account.** Only enterprise organizations appear, and many of those show "Installations and requests are disabled for this account."

3. **The GitHub App token returns zero repos.** Unlike personal accounts (which return public repos based on org membership), EMU tokens appear to be fully sandboxed — they return nothing without an explicit installation.

### What the Enterprise Admin Needs to Do

To enable mdcolab for EMU users, the enterprise admin needs to:

#### Step 1: Allow the GitHub App in the Enterprise

1. Go to **GitHub Enterprise Settings** → **Policies** → **GitHub Apps**
2. Find or add `mdcolab1-ai` to the list of allowed third-party applications
3. Set the policy to allow this app for the enterprise (or specific organizations)

> **Note:** The app's permissions are minimal — Contents (R/W), Issues (R/W), and Metadata (R). No admin, webhook, deploy key, actions, secrets, or org-level permissions are requested.

#### Step 2: Install the App on Relevant Organizations (or User Accounts)

Option A — **Organization-level install:**
1. Go to the organization's Settings → GitHub Apps → Install `mdcolab1-ai`
2. Choose "All repositories" or select specific repos
3. All org members can now use mdcolab for those repos

Option B — **Allow user-level installations:**
1. In enterprise policies, enable user-level app installations for `mdcolab1-ai`
2. Individual EMU users can then install the app on their own account at: `https://github.com/apps/mdcolab1-ai/installations/new`
3. Users choose which of their repos to grant access to (per-repo model)

#### Step 3: Verify It Works

After installation, the EMU user should:
1. Sign out and sign back into mdcolab
2. Visit the `/api/debug` endpoint to confirm repos are now returned
3. Check that their repos appear on the Dashboard and Repos pages

### Why This App Is Safe to Approve

| Concern | mdcolab's Answer |
|---|---|
| **What permissions does it need?** | Contents (R/W) to read/render/edit markdown files. Issues (R/W) to store inline comments. Metadata (R) for repo listing. **That's it.** |
| **What does it NOT access?** | No admin settings, no webhooks, no deploy keys, no actions/workflows, no secrets, no packages, no pages, no org management |
| **Does it store repo data?** | No. All content is fetched on-demand from GitHub and rendered in the browser. Comments are stored as GitHub Issues in the repo itself. |
| **Can it modify code?** | Only if the user has push access AND is in edit mode. It uses the same permission model as GitHub itself. |
| **What's the use case?** | Collaborative markdown review — like Google Docs or Word Online, but backed by GitHub repos. Users can view rendered markdown, add inline comments, and edit documents in a WYSIWYG editor. |
| **Who built it?** | Internal project for improving documentation collaboration workflows. |
| **Is there an audit trail?** | Yes — all edits are GitHub commits, all comments are GitHub Issues. Full git history is preserved. |

### Per-Repo Access Model (Recommended for Enterprises)

Rather than granting blanket access to all repos, we recommend the **per-repo model**:

1. **Install the app with "Only select repositories"** — the admin (or user, if allowed) chooses exactly which repos mdcolab can access
2. **Users can request additional repos** — when a user navigates to a repo that hasn't been connected, mdcolab shows a "Grant access" prompt
3. **Repos can be removed at any time** — the admin or user can revoke access to specific repos from the GitHub App installation settings

This respects the principle of least privilege and gives the enterprise full control over which repos are exposed to the application.

### Enterprise Admin FAQ

**Q: Can we restrict mdcolab to specific teams or users?**
A: Yes. Install the app on specific organizations or repos. Only users with existing GitHub access to those repos will be able to use mdcolab with them.

**Q: What happens if we uninstall the app?**
A: mdcolab immediately loses access. Comments stored as GitHub Issues remain in the repo (they're standard GitHub Issues). No data is retained by the app.

**Q: Does the app need webhook access?**
A: No. Webhooks are disabled. The app operates on-demand — it fetches content when users request it.

**Q: Can the app act on behalf of users without their knowledge?**
A: No. The app uses user-to-server tokens (OAuth flow). Every action is authenticated as the signed-in user and requires their active session.

**Q: Is the app hosted internally or externally?**
A: Currently hosted on Azure Container Apps. Can be deployed to any internal infrastructure if required by security policy.

---

## Comparison Matrix

| Capability | OAuth App (`repo` scope) | GitHub App (fine-grained) | GitHub App on EMU |
|---|---|---|---|
| List all user's repos | ✅ All repos | ⚠️ Public only (private needs installation) | ❌ Nothing without admin approval |
| Read public repos | ✅ | ✅ (visible via org membership) | ❌ Blocked |
| Read private repos | ✅ | ❌ Requires App installation | ❌ Blocked |
| Write to repos | ✅ (if user has push) | ⚠️ Public: yes if user has push; Private: needs installation | ❌ Blocked |
| Issues API | ✅ | ⚠️ Public: yes; Private: needs installation | ❌ Blocked |
| Consent screen | ❌ Scary ("Full control") | ✅ Clean (Contents + Issues only) | N/A — can't get there |
| Requires per-repo setup | ✅ No | ⚠️ Only for private repos | ❌ Requires enterprise admin |
| Zero-friction sharing | ✅ | ⚠️ Public repos only | ❌ No |
| Security posture | ⚠️ Overly broad | ✅ Minimal permissions | ✅ Minimal permissions (if enabled) |
| First-time user experience | ✅ Sign in → see all repos | ⚠️ Sign in → see public org repos, own private repos missing | ❌ Sign in → see nothing |

---

## What We Actually Need (minimum viable permissions)

| Permission | Used For | Read/Write |
|---|---|---|
| Repository contents | View/edit markdown files | Read & Write |
| Issues | Store/retrieve inline comments | Read & Write |
| User identity | Attribution (who commented/edited) | Read |
| List repositories | Show user's repos in the app | Read |

We do **not** need: admin, webhooks, deploy keys, actions, packages, secrets, environments, pages, or any org-level permissions.

---

## The Gap

There is no GitHub auth option that gives us both:
1. **Clean permissions** (only contents + issues, not full repo admin)
2. **Broad repo visibility** (see all repos without per-repo App installation)

This is the fundamental tension:

| | Narrow permissions | Broad permissions |
|---|---|---|
| **Broad repo access** | ❓ Doesn't exist | OAuth App + `repo` scope |
| **Narrow repo access** | GitHub App | N/A |

---

## UX Gap: No Standardized Capability Disclosure

**Source:** Security team feedback (Feb 10, 2026)

When a user is asked to install a GitHub App, the installation page shows the App's description (developer-written, unverified) and the requested permissions (e.g., "Contents: Read & Write"). But there is **no standardized UX that explains what the app will actually do** with those permissions.

**The problem:** A user seeing "Contents: Read & Write" doesn't know whether the app will:
- Just read their markdown files for rendering (our use case), or
- Silently rewrite all their code, or
- Exfiltrate their proprietary source code to a third party

The permission labels describe *capability*, not *intent*. There's no equivalent of an app store's "privacy nutrition label" or a mobile app's "this app uses your camera to scan QR codes" disclosure.

**What's missing from the GitHub App installation experience:**

| What exists | What's missing |
|---|---|
| App name and description (developer-written) | Standardized "what this app does" disclosure |
| Permission labels ("Contents: Read & Write") | Plain-English explanation of how permissions are used |
| Developer/org identity | Trust signals (verified publisher, security audit, user reviews) |
| "Install" button | Informed consent — user can't assess risk vs. benefit |

**Why this matters for adoption:** Security-conscious users (exactly the people whose organizations need tools like mdcolab) will refuse to install an unknown GitHub App when they can't make an informed decision about what it will do with their data. The current UX puts the burden entirely on the user to trust the developer's description.

**Recommendation for GitHub team:** Consider a standardized capability disclosure framework for GitHub Apps, similar to:
- **iOS App Privacy labels** — structured, mandatory disclosure of data usage
- **Chrome Web Store permissions justification** — developers must explain why each permission is needed
- **OAuth consent screen details** — Google requires apps to justify each scope requested

This would benefit the entire GitHub App ecosystem, not just mdcolab.

---

## Possible Solutions (for discussion with GitHub team)

### Option A: Hybrid approach — GitHub App + OAuth scope for repo listing

Use the GitHub App for the clean consent screen, but request an additional OAuth scope (e.g., `read:user`) that would allow listing repos without requiring installation. The App's fine-grained permissions would still gate what we can actually *do* with each repo.

**Status:** Not possible today. GitHub App user-to-server tokens don't support adding OAuth scopes that expand repo visibility beyond installations.

### Option B: New OAuth scope — `contents:read` / `contents:write`

A more granular alternative to `repo` that provides:
- Read/write access to repository contents only
- No access to settings, webhooks, deploy keys, admin functions
- Works across all user-accessible repos (like `repo` does) without per-repo installation

**Status:** Does not exist. This is the most impactful improvement GitHub could make. Fine-grained PATs support this granularity — but OAuth Apps and GitHub Apps don't have an equivalent flow.

### Option C: GitHub App with "Account-level" installation

Allow a GitHub App to be installed at the user/account level with access to **all** repos (current and future), with the permissions still being fine-grained (Contents + Issues only). This is partially possible today ("All repositories" option during install), but it requires the user to:
1. Know the App exists
2. Navigate to the App installation page
3. Choose "All repositories"

**Improvement needed:** Make this seamless. When a user authorizes a GitHub App via OAuth, automatically prompt them to install it on their account with suggested repo access. Or allow the OAuth flow to include a "request installation" step.

### Option D: "Reader mode" without installation, "Editor mode" with installation

Use the GitHub public API (no auth needed) for reading public repos, and only require App installation for write operations and private repos. This would let anyone open an mdcolab link to a public repo doc without any setup.

**Limitation:** Doesn't solve the private repo listing problem. Also, reading via public API has rate limits (60 req/hour unauthenticated vs 5000 authenticated).

### Option E: Per-Repo Collaborator Model for Private Repos

**Source:** Security team feedback (Feb 10, 2026)

**Insight:** Instead of asking for blanket access to all private repos (OAuth `repo` scope) or requiring account-wide App installation, let users explicitly grant access to individual private repos — similar to how private repo collaboration already works on GitHub.

**How it would work:**

1. **Public repos:** No installation needed — the GitHub App user-to-server token already provides access to public repos where the user is a member/collaborator (empirically verified).
2. **Private repos:** The user adds the mdcolab GitHub App to **only the specific repos** they want to share. This is done via the App's installation page, where GitHub already provides a "Only select repositories" option.
3. **UX flow:** When a user tries to open a private repo in mdcolab and we can't access it, we show a prompt: "This is a private repo. To use mdcolab with it, [grant access to this repo] →" with a link to the App installation settings.

**Why this is compelling:**

| Aspect | Account-wide access | Per-repo collaborator model |
|---|---|---|
| User comfort | 😬 "Access all my repos" | 😊 "Access only repos I choose" |
| Security | Over-privileged | Least-privilege |
| Boss can see your side project? | Yes | No — only repos you explicitly share |
| Adoption friction | High (scary consent) | Low (familiar collaborator pattern) |
| Works today? | Yes | ✅ Yes — no platform changes needed |

**Advantages:**
- ✅ **Already works** with the current GitHub App model — users can select specific repos during installation
- ✅ **Least-privilege by design** — the app only sees repos the user explicitly granted
- ✅ **Familiar pattern** — same mental model as adding a collaborator to a private repo
- ✅ **No scary permissions** — consent is per-repo, not account-wide
- ✅ **Incremental adoption** — start with public repos (zero friction), add private repos one at a time as needed

**Limitations:**
- ⚠️ Users must visit GitHub's App installation settings to add repos (not in-app yet)
- ⚠️ Can't list repos the user hasn't granted access to (but we can prompt when they navigate via direct URL)
- ⚠️ Requires the user to understand they need to "install" the app on repos — could be improved with a better in-app onboarding flow

**Implementation plan:**
1. For repo listing: Show installed (accessible) repos, plus offer a "Connect more repos" link to the GitHub App settings
2. For direct URL access (`/d/{owner}/{repo}/...`): If we get a 404/403, show a friendly "Grant access" prompt
3. Future: Use the GitHub API to show the user which of their repos have the app installed vs. not, with one-click install buttons

**This is our recommended near-term approach.** It works today, requires no GitHub platform changes, and respects the principle of least privilege. Combined with the zero-friction public repo access we already have, this covers the vast majority of use cases.

---

### Option F: Fine-grained OAuth scopes for OAuth Apps

Bring the fine-grained permission model from GitHub Apps to OAuth Apps. Instead of the blunt `repo` scope, allow OAuth Apps to request:
- `repo:contents:read`
- `repo:contents:write`
- `repo:issues:read`
- `repo:issues:write`

This would give us the best of both worlds: broad repo access (OAuth flow, no installation) with narrow permissions (no admin/webhook/deploy key access).

**Status:** Does not exist. Fine-grained PATs have this model but it's not available for OAuth App authorization flows.

---

## Document Sharing Model (Planned)

> **Status:** Planned. This section describes the architecture for sharing private repo documents with reviewers who don't have direct GitHub access to the repo.

### The Problem with User-to-Server Tokens

The current implementation uses **user-to-server tokens** for all API calls. This means every request to GitHub is made *as the signed-in user*. When an author shares a private repo document URL with a reviewer:

1. The reviewer signs into mdcolab
2. mdcolab calls GitHub API using the **reviewer's** token
3. GitHub checks the **reviewer's** access to the repo → **403 Forbidden**
4. The reviewer sees "Grant repo access" — but installing the app on their own account doesn't help, because the repo belongs to the **author**

**Result:** Sharing private repo documents with external reviewers is impossible under the current model. The reviewer would need to be a GitHub collaborator on the repo, which defeats the purpose of mdcolab.

### Solution: Installation Access Tokens

GitHub Apps have two types of tokens:

| Token Type | Acts As | Access Scope |
|---|---|---|
| **User-to-server** (current) | The signed-in user | Repos the *user* can access |
| **Installation access** (planned) | The app itself | Repos where the *app is installed* |

When the **author** installs the GitHub App on their repo, the app gets an **installation access token** that can read/write that repo — regardless of who is using the app. This is the same mechanism that CI bots, code review tools, and Dependabot use to access repos.

**Key insight:** The author installing the app is the authorization. mdcolab uses the app's token (not the reviewer's token) to fetch content, and controls access at the application level.

### How It Works (Personal GitHub Accounts)

```
┌─────────────────────────────────────────────────────┐
│ SETUP (one-time)                                    │
│                                                     │
│ Author installs GitHub App on their repo             │
│   → App now has installation access token for repo  │
│   → Author can manage sharing from mdcolab          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ SHARING                                             │
│                                                     │
│ 1. Author opens document in mdcolab                 │
│ 2. Clicks "Share" → Share dialog opens              │
│ 3. Chooses sharing mode:                            │
│    • "Specific people" → enters GitHub usernames    │
│    • "Anyone with the link" → truly anyone, no      │
│       sign-in required                              │
│ 4. mdcolab saves config to .mdcolab/sharing.json    │
│    in the repo (via installation token)             │
│ 5. Author copies URL and sends to reviewer          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ REVIEWING                                           │
│                                                     │
│ 1. Reviewer clicks shared URL                       │
│ 2. "specific_people" → must sign in with GitHub     │
│    "anyone_with_link" → no sign-in needed           │
│ 3. mdcolab reads .mdcolab/sharing.json              │
│    (using installation token, not reviewer's token) │
│ 4. Checks: is this reviewer authorized?             │
│    • "specific_people" → is username in the list?   │
│    • "anyone_with_link" → yes, anonymous access OK  │
│ 5. If authorized: fetches content via installation  │
│    token and serves to reviewer                     │
│ 6. If not authorized: shows "Request access from    │
│    @author" UI                                      │
│                                                     │
│ Anonymous users can view and comment with a display │
│ name but edits still require GitHub authentication. │
└─────────────────────────────────────────────────────┘
```

### Sharing Modes

| Mode | Who can access | Use case | Available on |
|---|---|---|---|
| **Specific people** | Only listed GitHub usernames | Confidential docs, controlled review | All accounts |
| **Anyone with the link** | Anyone with the URL — no sign-in required. Anonymous users can view and comment with a display name; edits require GitHub auth. | Broad sharing, maximum accessibility | Personal accounts only |

### Sharing Configuration

Sharing settings are stored in `.mdcolab/sharing.json` in the repo itself:

```json
{
  "version": 1,
  "defaultMode": "specific_people",
  "documents": {
    "docs/proposal.md": {
      "mode": "specific_people",
      "users": ["reviewer1", "reviewer2"],
      "sharedBy": "charris-msft",
      "sharedAt": "2026-02-11T01:00:00Z"
    },
    "docs/public-spec.md": {
      "mode": "anyone_with_link",
      "sharedBy": "charris-msft",
      "sharedAt": "2026-02-11T01:00:00Z"
    }
  }
}
```

**Why store in the repo?**
- Transparent — the repo owner can see and audit who has access
- Version-controlled — changes to sharing are tracked in git history
- No external database — sharing config lives with the content
- Portable — if the repo moves, sharing config moves with it

### Token Flow Change

```
CURRENT (user-to-server only):
  Reviewer signs in → reviewer's token → GitHub API → 403 (no access)

PLANNED (installation token for shared docs):
  Reviewer signs in → mdcolab checks sharing.json (installation token)
    → authorized? → fetch content (installation token) → serve to reviewer
    → not authorized? → "Request access" UI
```

### What This Requires

| Requirement | Details |
|---|---|
| GitHub App private key | PEM file generated from App settings, stored in Azure Key Vault |
| `@octokit/auth-app` package | Generates installation access tokens from App ID + private key |
| `GITHUB_APP_PRIVATE_KEY` env var | References Key Vault secret |
| Application-level access control | Check `.mdcolab/sharing.json` before serving content |

### Security Considerations

| Risk | Mitigation |
|---|---|
| **Leaked URLs** expose private docs | "Specific people" mode limits access to listed usernames; "anyone_with_link" grants anonymous access so authors should use it only for non-sensitive content |
| **Installation token is overpowered** | Token scoped to repos where app is installed; sharing config limits which docs are served |
| **Author could share too broadly** | "Anyone with the link" is opt-in per document; defaults to "specific people" |
| **Sharing config could be tampered with** | Only users with repo push access can modify `.mdcolab/sharing.json`; changes tracked in git |

### EMU / Enterprise Considerations

For enterprise-managed (EMU) accounts, the sharing model is **more restrictive**:

- **"Anyone with the link" mode is disabled** — EMU users can only use "Specific people" mode, since "anyone_with_link" allows truly anonymous public access
- **Leaked link = limited blast radius** — even if a URL is forwarded, the recipient must be on the explicit share list AND signed in with GitHub
- **Enterprise admin controls the app installation** — so they control which repos can be shared at all
- **Future:** Could restrict sharing to users within the same enterprise/org

This addresses the concern that a leaked URL to an internal doc could expose sensitive content. With "specific people" mode on EMU accounts, a forwarded link is useless unless the recipient was explicitly added to the share list.

---

## Recommendation for GitHub Team

**The core ask:** We need a way for a third-party app to access repository contents and issues across all of a user's repos, with the user's informed consent, **without** requiring:
1. The scary `repo` scope (which grants far more than needed), OR
2. Per-repo App installation (which kills the lightweight sharing UX)

**Option E (per-repo collaborator model)** is our **recommended near-term approach**. It:
- Works today with zero GitHub platform changes
- Respects least-privilege: app only sees repos the user explicitly grants
- Eliminates the "access all my private repos" fear factor
- Combines with the existing zero-friction public repo access
- Mirrors the familiar "add a collaborator" mental model

**Option F (fine-grained OAuth scopes)** would be the most impactful long-term platform improvement. It would:
- Keep the simple OAuth flow (sign in → see all repos)
- Show users exactly what permissions they're granting (contents + issues only)
- Not require per-repo App installation
- Apply to the entire ecosystem of GitHub-integrated apps, not just ours

**Option C (streamlined account-level installation)** is a good mid-term improvement. If the GitHub App OAuth flow could include an "install on all repos" prompt during first sign-in, the UX would be almost as smooth as the OAuth App flow.

---

## Current Implementation & Roadmap

**Current (live):** GitHub App with user-to-server tokens + per-repo collaborator model (Option E).
- ✅ Public repos — any signed-in user can view/comment
- ✅ Private repos — accessible if the user has direct GitHub access AND app is installed
- ❌ Private repo sharing with external reviewers — not yet supported (reviewer needs GitHub collaborator access)

**Next (planned):** Installation token sharing model (see "Document Sharing Model" section above).
- Will enable sharing private repo documents with any GitHub user, without requiring them to be a repo collaborator
- Author controls access via `.mdcolab/sharing.json` stored in the repo
- Two modes: "specific people" (all accounts) and "anyone with the link" (personal accounts only; grants anonymous access — no GitHub sign-in needed to view/comment)
- EMU accounts restricted to "specific people" mode for security

---

## Appendix: Token Types Reference

| Token Type | Issued By | Repo Visibility | Permission Model | Installation Required | Used In mdcolab |
|---|---|---|---|---|---|
| OAuth App token (`repo` scope) | OAuth App | All user repos | Coarse (full `repo`) | No | ❌ Retired |
| OAuth App token (`public_repo`) | OAuth App | Public repos only | Coarse | No | ❌ Not used |
| GitHub App user-to-server token | GitHub App | Installed repos only | Fine-grained | Yes | ✅ Current — user actions |
| GitHub App installation token | GitHub App | Installed repos only | Fine-grained | Yes | 🔜 Planned — serving shared docs |
| Fine-grained PAT | User | Selected repos | Fine-grained | N/A (user-managed) | ❌ Not used |
| Classic PAT (`repo` scope) | User | All user repos | Coarse | N/A | ❌ Not used |

---

## Appendix: Our GitHub App Configuration

- **App name:** mdcolab1-ai
- **App ID:** 2833539
- **Client ID:** Iv23ctc9KSI7srvH4eM7
- **Public link:** https://github.com/apps/mdcolab1-ai
- **Repository permissions:** Contents (R/W), Issues (R/W), Metadata (R)
- **Account permissions:** None
- **Organization permissions:** None
- **Webhook:** Inactive (not needed)
