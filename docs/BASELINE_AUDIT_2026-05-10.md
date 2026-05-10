# OCI Panel Baseline Audit - 2026-05-10

## Baseline

- Repository: `https://github.com/Lulu-Grant/oci-panel`
- Local path: `/Users/apple/Documents/oci_panel`
- Branch: `main`
- HEAD: `9c89e22 更新 README.md`
- Tag seen in history: `v0.1.0`
- Code size: 55 TypeScript/TSX files, about 5.8k source lines in `src`.
- Stack: Next.js 16, React 19, Prisma 7, SQLite, next-auth, OCI SDK.

## Initial Verified State

- `npm install`: passed, Prisma client generated.
- `npm run build`: passed.
- `npm run lint`: passed with 7 warnings.
- `npm audit --audit-level=low`: failed with 19 vulnerabilities, including 10 high.

## Current Checkpoint State

- `npm run lint`: passes with zero warnings.
- `npm run build`: passes.
- `npm audit --audit-level=high`: passes.
- Remaining dependency advisories: 8 total, all low/moderate, requiring breaking-change or downgrade evaluation.
- Touched API routes now use a shared `{ success, data, message }` response envelope.
- Dashboard/Create/Capacity have been refocused around the audited product baseline.
- OCI-native advanced operations research is documented in `docs/OCI_NATIVE_OPERATIONS_RESEARCH_2026-05-10.md`.
- `npm test` is available and covers account credential preservation, disabled-account default behavior, account route safe-detail boundaries, API envelope helpers, and registration policy.

## Product Baseline

The project has already moved beyond a simple instance power-control tool. The current baseline is a multi-account OCI asset console with these working or partially working areas:

- Platform auth: register, login, next-auth middleware, user-scoped APIs.
- OCI account management: add, edit, delete, enable/disable, set default, test connection.
- Instance management: list, lifecycle actions, detail drawer, standalone detail page.
- Create workflow: account-aware options, AD/shape/image/network loading, Flex config, capacity hinting, SSH key or password initialization.
- Capacity page: region subscriptions, ADs, services, Compute limit values.
- Logs: user-scoped operation log list.
- Manual refresh strategy: page-local browser cache, explicit refresh actions.

## Main Pain Points

### P0 Security Baseline Gaps

1. Decrypted OCI private keys are returned to the browser. **Fixed in current checkpoint.**
   - Evidence: `src/app/api/accounts/route.ts` returns the full account object for `GET ?accountId=...`.
   - Evidence: `src/components/accounts/edit-account-form.tsx` stores `data.privateKey` in client state.
   - Impact: browser, extensions, logs, or XSS can expose cloud API private keys.

2. Encryption has a hardcoded fallback key. **Fixed for production runtime in current checkpoint.**
   - Evidence: `src/lib/crypto.ts` falls back to `dev-only-openclaw-oci-panel-key-32b`.
   - Impact: production data may be encrypted with a known secret if `APP_ENCRYPTION_KEY` is missing.

3. Public registration is open by default. **Fixed for production in current checkpoint.**
   - Evidence: `middleware.ts` explicitly allows `/api/register` and `/register`.
   - Impact: if deployed openly, anyone can create a platform user unless external access is restricted.
   - Current policy: development/test defaults enabled; production defaults disabled unless `AUTH_REGISTRATION_ENABLED=true`.

4. Dependency audit is not clean. **High severity baseline fixed; low/moderate advisories remain for separate evaluation.**
   - Evidence: `npm audit` reports 19 vulnerabilities, including high severity advisories in Next.js, Prisma toolchain dependencies, Hono, lodash, cookie, and related transitive packages.

### P0 Direction Conflict

1. Legacy SSH-based DD reinstall still exists on the server. **Fixed in current checkpoint.**
   - Evidence: `src/app/api/instances/reinstall/route.ts` accepts host, username, private key, password, then shells out to `ssh`.
   - Conflict: README and PR checklist say not to reintroduce SSH-credential-based DD.
   - Impact: high-risk, hard-to-support feature path that distracts from OCI-native operations.

2. The Instances UI still exposes a "更多 / DD" path with reinstall-oriented parameters. **Fixed in current checkpoint.**
   - Evidence: `src/components/instances/instances-table.tsx` opens an "高级操作 / DD 重装" modal.
   - Impact: the UI advertises a feature that is not complete and carries unclear user expectations.

### P1 Reliability And UX Gaps

1. Lint warnings point to brittle React hook dependencies. **Fixed in current checkpoint.**
   - Current count: 0 warnings.
   - Risk: stale closures in refresh and polling flows.

2. `settings` is a placeholder page. **Hidden from navigation in current checkpoint.**
   - Evidence: `src/app/settings/page.tsx`.
   - Risk: navigation surface suggests capabilities that do not exist yet.

3. `mock-data.ts` remains in `src/lib`. **Fixed in current checkpoint.**
   - Evidence: `src/lib/mock-data.ts`.
   - Risk: future work may accidentally reconnect mock data to runtime.

4. Manual refresh is useful, but repeated pages each own similar cache and refresh patterns.
   - Risk: inconsistent stale states and repeated bugs.

5. API responses are inconsistent. **Fixed for touched API surface in current checkpoint.**
   - Some endpoints return arrays directly, others return `{ success, ... }`.
   - Risk: frontend error handling stays ad hoc as features grow.

## Cut / Freeze List

Cut now:

- Remove or hard-disable `/api/instances/reinstall` SSH execution.
- Remove "DD 重装" wording from primary UI until OCI-native task submission is real.
- Remove password/custom-image inputs from the DD modal; keep only OCI-native capability detection if needed.
- Remove `src/lib/mock-data.ts` once imports are confirmed absent.

Freeze for now:

- Google OAuth polish. Keep optional provider support, but do not invest in it before core security and OCI workflows.
- Settings page expansion. Either hide it or make it only hold essential security/runtime settings.
- Password-based instance initialization as a default path. Keep it as advanced only, or defer it behind a feature flag.
- OS Management Hub job submission until capability detection is validated against real managed instances.

Current cut result:

- `/api/instances/reinstall` has been deleted.
- Instances page now exposes only OCI managed capability detection.
- Runtime no longer accepts SSH private keys, host passwords, or custom DD images for reinstall.
- `src/lib/mock-data.ts` has been deleted.

Keep and prioritize:

- OCI account CRUD and connection testing.
- Instance inventory, detail, lifecycle actions.
- Create workflow with capacity hints.
- Capacity visibility.
- Logs/audit trail.
- Manual refresh strategy.

## Recommended New Baseline

The next baseline should be:

1. Secure credential boundary: OCI private keys never leave the server after initial submission.
2. No SSH-based DD execution path in runtime.
3. Build, lint, and dependency audit are part of CI expectations.
4. Core pages focus on account, instance, create, capacity, and logs.
5. Placeholder or speculative features are hidden, removed, or explicitly marked as inactive research.
