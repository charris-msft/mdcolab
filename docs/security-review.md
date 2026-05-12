# Security Review Summary — mdcolab1-ai GitHub App

**App name:** mdcolab1-ai  
**App ID:** 2833539  
**Public page:** <https://github.com/apps/mdcolab1-ai>  
**Owner:** `@charris-msft`  
**Hosted at:** Azure Container Apps (East US 2)  
**Review date:** April 24, 2026  

---

## 1. GitHub App Permissions & Webhook Events

### Where permissions are defined

Permissions are configured **in the GitHub App settings UI** at `github.com/settings/apps/mdcolab1-ai`. There is no in-repo `app.yml` manifest. The authoritative reference in the codebase is `docs/github-auth-options.md`, Appendix section.

### Requested permissions

| Scope | Permission | Level |
|---|---|---|
| **Repository — Contents** | Read & Write | Allows reading/writing file contents, commits |
| **Repository — Issues** | Read & Write | Allows creating/reading/updating issues and comments |
| **Repository — Metadata** | Read-only | Allows listing repos, branches, collaborators (always implicit) |
| **Account permissions** | None | — |
| **Organization permissions** | None | — |

### Webhook events

**Webhook is inactive** — the app does not subscribe to any webhook events. All operations are initiated by user-driven HTTP requests to the Next.js API.

### How to verify

1. Go to <https://github.com/settings/apps/mdcolab1-ai> → **Permissions & events**
2. Confirm the three repository permissions above
3. Confirm "Subscribe to events" section is empty / webhook URL is blank

---

## 2. Data Access & Data Egress Map

### GitHub data read/written

| Data Type | Operation | API Route | Auth Token Used |
|---|---|---|---|
| File contents (markdown) | **Read** | `GET /api/file/[owner]/[repo]/[branch]/[...path]` | User OAuth or App installation |
| File contents (markdown) | **Write** (commit) | `PUT /api/save/[owner]/[repo]/[branch]/[...path]` | User OAuth or App installation |
| Repository list | **Read** | `GET /api/repos` | User OAuth only |
| Directory tree | **Read** | `GET /api/repos/[owner]/[repo]/tree` | User OAuth or App installation |
| Repository permissions | **Read** | `GET /api/repos/[owner]/[repo]/permission` | User OAuth |
| Issues + comments (for inline comments) | **Read / Write** | `GET/POST /api/comments/[owner]/[repo]/[branch]/[...path]` | User OAuth or App installation |
| Issue labels | **Read / Write** | (inside comments route) | User OAuth or App installation |
| Sharing config (`.mdcolab/sharing.json`) | **Read / Write** | `GET/PUT/DELETE /api/sharing/[owner]/[repo]` | User OAuth + App installation fallback |
| User search / collaborators | **Read** | `GET /api/users/search` | User OAuth |
| Rate limit | **Read** | `GET /api/rate-limit` | User OAuth |
| Debug info (installations, scopes) | **Read** | `GET /api/debug` | User OAuth |

### Outbound network calls

| Destination | Protocol | What is sent | Could contain secrets? |
|---|---|---|---|
| `api.github.com` | HTTPS | Octokit REST API calls (file contents, issues, repo metadata, user info) | **No** — uses OAuth/installation tokens for auth; file contents could theoretically contain user-embedded secrets in markdown files |
| **GitHub Copilot API** (via `@github/copilot-sdk` → Copilot CLI subprocess) | HTTPS | Document content, user prompt, selected text, conversation history | **Potentially** — the full document markdown is sent as LLM context. If a user's markdown file contains secrets (e.g., pasted API keys), those would be included in the prompt. |
| `Azure Application Insights` | HTTPS | `console.log/error` output, HTTP request telemetry (via `APPLICATIONINSIGHTS_CONNECTION_STRING`) | See §4 — no secrets are logged, but file paths, issue counts, and error messages appear in logs |

### What is NOT called

- No external databases, vector DBs, or blob storage
- No third-party LLM providers (OpenAI, Anthropic) — only GitHub Copilot SDK
- No external analytics (no Google Analytics, Segment, etc.)
- No outbound calls to any domain other than `api.github.com` and Azure telemetry

---

## 3. Secrets & Auth Handling

### Authentication model

| Component | Method | Details |
|---|---|---|
| **User sign-in** | NextAuth.js + GitHub OAuth | GitHub App acts as OAuth provider; scope `repo read:user`; JWT session strategy (no server-side sessions) |
| **User API calls** | OAuth access token | Stored in JWT token, passed to Octokit per-request |
| **App-level API calls** | GitHub App installation token | Generated from App ID + private key via `@octokit/auth-app`; used as fallback for anonymous/shared-link access |
| **Copilot AI** | User's OAuth token | Passed to `@github/copilot-sdk` as `githubToken` — Copilot auths via user's own token/subscription |

### Secrets inventory

| Secret | Storage location | Runtime exposure |
|---|---|---|
| `GITHUB_CLIENT_ID` | Azure Container Apps secret (via Bicep `@secure()` param) | Env var in container |
| `GITHUB_CLIENT_SECRET` | Azure Container Apps secret (via Bicep `@secure()` param) | Env var in container |
| `NEXTAUTH_SECRET` | Azure Container Apps secret (via Bicep `@secure()` param) | Env var in container — JWT signing key |
| `GITHUB_APP_ID` | Env var (not in Bicep — must be added) | Env var in container |
| `GITHUB_APP_PRIVATE_KEY` | Env var (not in Bicep — must be added) | Env var in container — PEM private key |
| User OAuth tokens | In-memory JWT only | Never persisted; included in Copilot SDK calls |

### ⚠️ FINDING: `.env.local.example` contains real credentials

**File:** `.env.local.example` line 1–2  
```
GITHUB_CLIENT_ID=Ov23ctivrJzbqq2T3GRG
GITHUB_CLIENT_SECRET=<set-in-container-app-secret>
```
These appear to be **real OAuth App credentials** (the `Ov23...` prefix is a GitHub OAuth App Client ID). The Client ID is also referenced in `docs/github-auth-options.md` line 29.

**Recommendation:** Rotate this OAuth App's client secret immediately. Replace `.env.local.example` values with clearly-placeholder text (e.g., `your-client-id-here`). These may be from an old OAuth App (not the current GitHub App `Iv23ctc9KSI7srvH4eM7`), but should still be rotated.

### Are secrets logged?

- **No** — `console.log` statements log operational messages (`[AI] Starting Copilot CLI...`, `[comments GET] Attempt 1: found N issues`), error messages, and status codes.
- **Access tokens and private keys are never logged.**
- **Request/response payloads are not logged** — document content is sent to Copilot but not written to `console.log`.

---

## 4. Storage, Retention & Logging

### Data at rest

| Store | What | Retention |
|---|---|---|
| **None (no database)** | The app does not use any database, blob storage, or cache at rest | N/A |
| **GitHub repos** | All user data (files, comments-as-issues, sharing config) is stored in the user's own GitHub repos | Governed by GitHub retention / user control |
| **In-memory cache** | GitHub App installation IDs are cached for 5 min (`installationCache` in `github-app.ts`) | TTL: 5 minutes, per-process only |
| **JWT session** | User session data (access token, login, EMU flag) stored in signed JWT cookie | Expires per NextAuth defaults (typically 30 days) |

**Key point:** The app is stateless. No repo content, PR diffs, issue text, or user data is persisted by the application.

### Logging & telemetry

| Sink | What is logged | Retention |
|---|---|---|
| **Azure Application Insights** + **Log Analytics** | Container stdout/stderr (console.log output), HTTP request telemetry, performance metrics | **30 days** (configured in `infra/modules/monitoring.bicep`) |
| **Container Apps system logs** | Container lifecycle events, scaling events | Governed by Azure Container Apps defaults |

### Fields that appear in logs

- `[AI]` prefixed messages: lifecycle events (start, session created, idle, errors), event types, timeout messages
- `[comments GET]` prefixed: issue counts per attempt, file paths (not file contents)
- `[Slides]` prefixed: error messages
- Error stack traces on failures
- **NOT logged:** file contents, document text, user prompts, access tokens, API response bodies

---

## 5. Deployment & Runtime Security

### Hosting architecture

| Layer | Technology | Configuration |
|---|---|---|
| **Compute** | Azure Container Apps | Single active revision, 0–3 replicas, 0.5 CPU / 1 GiB RAM |
| **Container** | Docker (node:22-slim) | Non-root user (`nextjs`, UID 1001), multi-stage build |
| **Registry** | Azure Container Registry | Managed identity auth (ACR Pull), ⚠️ admin user enabled |
| **Ingress** | Azure Container Apps ingress | External, HTTPS-only (`allowInsecure: false`), no IP allowlists |
| **Identity** | User-assigned managed identity | Used for ACR pull only |
| **IaC** | Bicep (`infra/`) | Deployed via `azd` (Azure Developer CLI) |

### Security controls

| Control | Status | Notes |
|---|---|---|
| HTTPS-only | ✅ | `allowInsecure: false` in container-app.bicep |
| TLS 1.2+ | ✅ | Enforced by Azure Container Apps |
| Non-root container | ✅ | `USER nextjs` (UID 1001) in Dockerfile |
| No secrets in code | ⚠️ | `.env.local.example` has real creds (see §3) |
| Secrets in Azure | ✅ | `@secure()` Bicep params → Container Apps secrets |
| ACR admin disabled | ⚠️ | Admin user is **enabled** in `container-registry.bicep` — should be disabled for production |
| Network restrictions | ❌ | No VNet integration, no IP allowlists, no private endpoints |
| WAF / DDoS protection | ❌ | No Azure Front Door or Application Gateway |
| Dependency scanning | ❌ | No Dependabot, CodeQL, or npm audit in CI |

### CI/CD pipeline (`ci.yml`)

- Triggers on `push` to `main` and PRs to `main`
- Runs: checkout → npm ci → tsc (type-check) → `npm test` → `npm run build`
- **Does not deploy** — no production deployment in CI (deployment is manual via `azd`)
- ⚠️ Linting is disabled (commented out due to 174 existing lint errors)

### Configuration files that can change production

| File | Risk | Notes |
|---|---|---|
| `infra/main.bicep` + modules | **High** | Defines all Azure resources; changes could expose secrets or open network |
| `azure.yaml` | **Medium** | Controls `azd` deployment target |
| `Dockerfile` | **Medium** | Changes to base image, packages, or user could introduce vulnerabilities |
| `.github/workflows/ci.yml` | **Low** | Currently build-only; no deployment step |

---

## 6. Least-Privilege Recommendation

### Current vs. Required permissions

| Permission | Current | Actually Required | Justification |
|---|---|---|---|
| **Contents: Read** | ✅ | ✅ **Yes** | Read markdown files for rendering/editing |
| **Contents: Write** | ✅ | ✅ **Yes** | Save edited files as commits; write `.mdcolab/sharing.json` |
| **Issues: Read** | ✅ | ✅ **Yes** | Read inline comments stored as GitHub Issues |
| **Issues: Write** | ✅ | ✅ **Yes** | Create/update/resolve comment threads; manage labels |
| **Metadata: Read** | ✅ (implicit) | ✅ **Yes** | List repos, branches, directory trees |
| Webhooks | ❌ Not requested | ❌ Not needed | App is purely request-driven |
| Administration | ❌ Not requested | ❌ Not needed | — |
| Actions/Workflows | ❌ Not requested | ❌ Not needed | — |
| Pull Requests | ❌ Not requested | ❌ Not needed | — |

### Assessment

**The current permission set is already minimal.** The app requests exactly the three permissions it needs and nothing more. No high-risk permissions (Administration, Actions, Workflows, Secrets, Deployments) are requested.

### Risk analysis of current permissions

| Permission | Risk Level | Mitigation |
|---|---|---|
| **Contents: Write** | ⚠️ Medium | Can create commits in installed repos. Mitigated by: (1) writes are user-initiated save actions, (2) only writes to specific file paths, (3) full audit trail via git history |
| **Issues: Write** | 🟢 Low | Creates issues with `mdcolab` label. Low-risk — issues are metadata, not code |
| **Metadata: Read** | 🟢 Low | Read-only, standard for any GitHub App |

---

## 7. Rollout Plan & Approvers

### Phase 1: Private pilot (you only)

**Goal:** Validate in a controlled environment before any external installation.

1. **Install `mdcolab1-ai` on 1–2 of your own repos** (`charris-msft/mdcolab` and one test repo)
2. **Remediate the findings below** before expanding:
   - [ ] Rotate the OAuth App secret exposed in `.env.local.example`
   - [ ] Replace `.env.local.example` values with placeholder text
   - [ ] Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` to Bicep secrets (currently only in env vars, not in IaC)
   - [ ] Disable ACR admin user in `container-registry.bicep`
   - [ ] Enable Dependabot or CodeQL scanning on the repo
   - [ ] Re-enable ESLint in CI (or create a tracked issue)
3. **Test all flows:** sign-in, file read/write, comments, sharing (anonymous + specific users), AI chat
4. **Review Application Insights logs** — confirm no sensitive data appears

### Phase 2: EMU account pilot

**Goal:** Validate with Enterprise Managed Users in your `charris_microsoft` EMU account.

1. Install `mdcolab1-ai` on **2–3 selected repos** in the EMU org
2. Test EMU-specific flows (the app has EMU detection logic in `auth-utils.ts`)
3. Confirm sharing works across personal ↔ EMU boundaries
4. Document any EMU-specific limitations

### Phase 3: Security review completion

**Goal:** Produce artifacts required for org-level approval.

**Artifacts to prepare:**
- [ ] This security review document (this file)
- [ ] Data flow diagram (see §2 — can be drawn from the table above)
- [ ] Threat model (STRIDE or similar) focused on Contents: Write risk
- [ ] Confirmation that all Phase 1 findings are resolved
- [ ] Screenshot of GitHub App permission page showing exact permissions
- [ ] Privacy impact: confirm no PII/repo data is stored at rest

### Phase 4: Approach `gim-home` org for limited pilot

**Who to contact:**
- **Org owners** of `gim-home` (check via `github.com/orgs/gim-home/people` → filter by "Owner")
- **Security reviewer** (if the org has a designated AppSec or security engineering team)

**What to provide them:**
1. **This security review document** — covers permissions, data flow, secrets, deployment
2. **GitHub App public page link:** <https://github.com/apps/mdcolab1-ai>
3. **Request:** Install on **2–3 selected repos** only (not org-wide)
4. **Ask for:**
   - Written approval from at least one org owner
   - Security team review (if required by org policy)
   - Identification of test repos for the pilot
   - Success criteria for expanding (e.g., "2 weeks with no incidents")
5. **Reassurances to offer:**
   - No data stored at rest — app is stateless
   - No webhook subscriptions — no background processing
   - All changes are git commits (full audit trail)
   - Can be uninstalled instantly, no data retention
   - Permissions are minimal: Contents + Issues only, no admin/workflows/secrets

### Phase 5: Expand within `gim-home`

**Criteria to proceed:**
- Phase 4 pilot ran for ≥2 weeks with no security incidents
- Org owner + security reviewer sign-off
- Any Phase 4 feedback has been addressed

**Steps:**
1. Request org-wide installation (or expand to additional repos)
2. Communicate to org members: what the app does, how to use it, how to report issues
3. Set up a feedback channel (GitHub issue in your repo or Teams channel)

---

## Data Access → Sent/Stored → Retention Table

| Data type | Where sent | Where stored | Retention |
|---|---|---|---|
| Markdown file contents | GitHub API (read/write), Copilot SDK (AI prompts) | User's GitHub repo (as commits) | Git history (permanent) |
| Issue comments / threads | GitHub API (read/write) | User's GitHub repo (as Issues) | Until user deletes |
| Sharing configuration | GitHub API (read/write) | `.mdcolab/sharing.json` in repo | Until user deletes |
| User OAuth access token | In-memory (JWT cookie) | Not persisted at rest | JWT expiry (~30d) |
| GitHub App private key | Process env var | Azure Container Apps secret | Until rotated |
| AI prompts (document + user query) | GitHub Copilot SDK (→ Copilot API) | Not stored by mdcolab | Per GitHub Copilot data retention policy |
| Console logs (paths, error msgs) | Azure Application Insights | Log Analytics workspace | **30 days** |
| HTTP request telemetry | Azure Application Insights | Log Analytics workspace | **30 days** |

---

## Open Questions / TODOs

| # | Item | Status |
|---|---|---|
| 1 | **Rotate leaked OAuth App secret** in `.env.local.example` (`face8aa0...`) | 🔴 Action required |
| 2 | **Add App secrets to Bicep IaC** — `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are not in `main.bicep`; they must be injected separately (risk of drift) | 🟡 Should fix |
| 3 | **Disable ACR admin user** in `container-registry.bicep` for production | 🟡 Should fix |
| 4 | **Enable dependency scanning** — no Dependabot, CodeQL, or `npm audit` in CI | 🟡 Should add |
| 5 | **Network hardening** — no VNet, IP allowlists, or WAF; container is internet-exposed | 🟡 Consider for production |
| 6 | **OAuth scope breadth** — the user OAuth flow currently requests `repo` scope (per `auth.ts` line 11), which is broader than needed. The GitHub App permissions are fine-grained, but the OAuth token itself has full `repo` access. Investigate whether the App's OAuth flow narrows this automatically. | 🟡 Investigate |
| 7 | **Copilot data retention** — confirm GitHub Copilot's data handling policy applies to content sent via `@github/copilot-sdk`. Document any org-level Copilot policy in `gim-home`. | 🟡 Investigate |
| 8 | **Debug endpoint** (`/api/debug`) exposes installation details, token scopes, and repo lists. Should be disabled or auth-gated for production. | 🟡 Should fix |
| 9 | **Re-enable ESLint** — currently disabled due to 174 errors. Create a tracked issue. | 🟢 Nice to have |
| 10 | **`docs/github-auth-options.md`** contains Client IDs. While Client IDs are not secrets, review whether this doc should be in a private location. | 🟢 Low risk |
