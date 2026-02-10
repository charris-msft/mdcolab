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
- ❌ **`GET /user/repos` only returns repos where the App is installed** — This is the fundamental problem. Even with a user-to-server (OAuth) token, the GitHub App can only see repos it's been explicitly granted access to.
- ❌ **Users must install the App on each repo** they want to use with mdcolab. They must go to GitHub → Settings → Applications → mdcolab → Configure → select repos. This is a significant UX friction barrier.
- ❌ **New users see zero repos** until they install the App, which is confusing and looks broken.
- ❌ Users may be unwilling to install an unknown GitHub App on their repos, especially private ones.

**Why this is problematic:** The entire value prop of mdcolab is "share a link to a markdown file and collaborate." Requiring App installation adds friction that kills the lightweight sharing model. It's like needing to install a Word plugin before you can open a .docx link someone sent you.

---

## Comparison Matrix

| Capability | OAuth App (`repo` scope) | GitHub App (fine-grained) |
|---|---|---|
| List all user's repos | ✅ All repos | ❌ Only installed repos |
| Read public repos | ✅ | ✅ (if installed) |
| Read private repos | ✅ | ✅ (if installed) |
| Write to repos | ✅ (if user has push) | ✅ (if installed + user has push) |
| Issues API | ✅ | ✅ (if installed) |
| Consent screen | ❌ Scary ("Full control") | ✅ Clean (Contents + Issues only) |
| Requires per-repo setup | ✅ No | ❌ Yes (App installation) |
| Zero-friction sharing | ✅ | ❌ |
| Security posture | ⚠️ Overly broad | ✅ Minimal permissions |
| First-time user experience | ✅ Sign in → see repos | ❌ Sign in → empty → install App → see repos |

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

### Option E: Fine-grained OAuth scopes for OAuth Apps

Bring the fine-grained permission model from GitHub Apps to OAuth Apps. Instead of the blunt `repo` scope, allow OAuth Apps to request:
- `repo:contents:read`
- `repo:contents:write`
- `repo:issues:read`
- `repo:issues:write`

This would give us the best of both worlds: broad repo access (OAuth flow, no installation) with narrow permissions (no admin/webhook/deploy key access).

**Status:** Does not exist. Fine-grained PATs have this model but it's not available for OAuth App authorization flows.

---

## Recommendation for GitHub Team

**The core ask:** We need a way for a third-party app to access repository contents and issues across all of a user's repos, with the user's informed consent, **without** requiring:
1. The scary `repo` scope (which grants far more than needed), OR
2. Per-repo App installation (which kills the lightweight sharing UX)

**Option E (fine-grained OAuth scopes)** would be the most impactful solution. It would:
- Keep the simple OAuth flow (sign in → see all repos)
- Show users exactly what permissions they're granting (contents + issues only)
- Not require per-repo App installation
- Apply to the entire ecosystem of GitHub-integrated apps, not just ours

**Option C (streamlined account-level installation)** is a good near-term improvement. If the GitHub App OAuth flow could include an "install on all repos" prompt during first sign-in, the UX would be almost as smooth as the OAuth App flow.

---

## Current Workaround

For now, we're using the **GitHub App** approach and accepting the limitations. Possible mitigations:

1. **"Connect repos" onboarding flow** — After first sign-in, redirect to the GitHub App installation page (`https://github.com/apps/mdcolab1-ai/installations/new`) so users can grant access to their repos.
2. **Direct URL access** — Users can still access any repo via direct URL (`/d/{owner}/{repo}/{branch}/{path}`) if they have a GitHub token with access. The repos list is just a convenience feature.
3. **Dual-token approach** — Investigate whether we can use two auth flows: GitHub App for clean permissions on installed repos, plus a minimal OAuth scope (e.g., `public_repo`) just for listing repos.

---

## Appendix: Token Types Reference

| Token Type | Issued By | Repo Visibility | Permission Model | Installation Required |
|---|---|---|---|---|
| OAuth App token (`repo` scope) | OAuth App | All user repos | Coarse (full `repo`) | No |
| OAuth App token (`public_repo`) | OAuth App | Public repos only | Coarse | No |
| GitHub App user-to-server token | GitHub App | Installed repos only | Fine-grained | Yes |
| GitHub App installation token | GitHub App | Installed repos only | Fine-grained | Yes |
| Fine-grained PAT | User | Selected repos | Fine-grained | N/A (user-managed) |
| Classic PAT (`repo` scope) | User | All user repos | Coarse | N/A |

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
