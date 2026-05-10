# Development Plan - 2026-05-10

This plan resets the project around the audited baseline. Work should be done in order unless a task is explicitly blocked.

## P0 - Security And Scope Reset

- [x] `P0-01` Stop returning decrypted OCI private keys to the browser.
  - Change account detail responses to return only safe metadata.
  - Add explicit "replace private key" behavior for edits.
  - Preserve existing key server-side when no replacement is submitted.

- [x] `P0-02` Require `APP_ENCRYPTION_KEY` outside development.
  - Fail fast in production if missing.
  - Add `APP_ENCRYPTION_KEY` to `.env.example`.
  - Document key rotation expectations.

- [x] `P0-03` Remove SSH-based DD reinstall runtime.
  - Delete or disable `/api/instances/reinstall`.
  - Remove server-side SSH private-key handling and remote command execution.
  - Keep logs/history intact.

- [x] `P0-04` Simplify Instances advanced operation UI.
  - Replace "更多 / DD" with "OCI 托管能力" or hide it behind a disabled research affordance.
  - Remove password/custom-image fields until real OCI-native task submission exists.

- [x] `P0-05` Close dependency audit basics.
  - Run safe `npm audit fix`.
  - Evaluate Next.js and Prisma upgrades separately.
  - Record any remaining transitive/dev-only advisories.

- [x] `P0-06` Add CI gates for lint and audit.
  - Add `npm run lint` to GitHub Actions.
  - Add an audit step with a documented threshold or separate advisory review job.

## P1 - Core Product Hardening

- [x] `P1-01` Fix React hook lint warnings.
  - Dashboard refresh hooks.
  - Create resource loading hook.
  - Instance detail polling/open-detail hook.

- [x] `P1-02` Normalize API response envelopes.
  - Choose a consistent `{ success, data, message }` shape for new/changed APIs.
  - Update frontend fetch handling touched by P0/P1 work.

- [x] `P1-03` Remove `src/lib/mock-data.ts`.
  - Confirm no runtime imports.
  - Delete the file and update project docs.

- [x] `P1-04` Account status clarity.
  - Distinguish disabled, connection failed, and healthy states.
  - Avoid treating disabled accounts as candidates for default selection or OCI calls.

- [x] `P1-05` Improve operation logs.
  - Add clearer action/result taxonomy.
  - Ensure account edit/delete/test events are logged.
  - Keep user-scoped filtering intact.

- [x] `P1-06` Settings page decision.
  - Either hide it from navigation or make it useful for runtime/security status.

## P2 - Product Focus

- [x] `P2-01` Dashboard as command center.
  - Show account health, recent failures, capacity warnings, and primary next actions.

- [x] `P2-02` Create workflow polish.
  - Make capacity warnings more deterministic.
  - Add safer defaults for public IP, IPv6, and login mode.
  - Keep password initialization advanced-only.

- [x] `P2-03` Capacity page depth.
  - Highlight Compute A1/Flex-relevant limits.
  - Add account/region comparison only after single-account clarity is solid.

- [x] `P2-04` OCI-native advanced operations research.
  - Validate OS Management Hub managed instance matching.
  - Define the smallest real job submission path.
  - Add it only after P0 cleanup and real-account validation.

## Definition Of Done For The New Baseline

- `npm run build` passes.
- `npm run lint` has zero warnings.
- No runtime endpoint accepts user-provided SSH private keys for DD/reinstall.
- No account detail API returns decrypted private keys or passphrases.
- README, `PROJECT_INDEX.md`, and this plan agree on current scope.

## Checkpoint - 2026-05-10

- P0 security and scope reset is implemented.
- P1 stability cleanup is implemented, including the shared `{ success, data, message }` API envelope for touched routes.
- P2 product focus pass is implemented:
  - Dashboard now surfaces account health, capacity/action context, and command-center next steps.
  - Create defaults now bias toward private networking, with clearer capacity/runtime warnings.
  - Capacity page highlights A1/Flex/OCPU/Memory-relevant limits.
  - OCI-native advanced operations research is captured in `docs/OCI_NATIVE_OPERATIONS_RESEARCH_2026-05-10.md`.
- `npm run lint` passes with zero warnings.
- `npm run build` passes.
- `npm audit --audit-level=high` passes; low/moderate advisories remain in Prisma/next-auth/Next transitive dependencies and require separate breaking-change evaluation.
- Browser smoke on `http://127.0.0.1:3000` passed for app render, primary navigation, hidden settings navigation, and removed DD wording.

## Next Baseline Backlog

- Validate OS Management Hub managed instance matching against a real OCI account before adding any job submission endpoint.
- Add tests around account credential preservation and disabled-account filtering.
- Add a small internal fetch wrapper convention for future pages so new endpoints stay on the shared envelope.
- Decide public registration policy before any internet-facing deployment.
