# Phase 2-4 legacy cleanup notes

## Current status

Legacy JSON runtime fallback has been removed.

Removed runtime dependencies on:
- `data/oracle-accounts.json`
- `data/operation-logs.json`

Current source of truth:
- OCI accounts: Prisma `OciAccount`
- Operation logs: Prisma `OperationLog`

## Migration policy

Do **not** silently import legacy JSON on request anymore.

Use the explicit one-off migration script instead:

```bash
npm run migrate:legacy-json -- --email you@example.com
npm run migrate:legacy-json -- --user-id <platform-user-id>
npm run migrate:legacy-json -- --email you@example.com --archive
```

Options:
- `--email <email>`: migrate into the specified platform user
- `--user-id <id>`: migrate into the specified platform user by id
- `--archive`: after migration, move legacy JSON files into `data/archive/`

Behavior:
1. resolve target platform user
2. import old accounts once if target user has no `OciAccount`
3. import old logs once if target user has no `OperationLog`
4. optionally archive old JSON files

## Why

Keeping request-time legacy auto-import causes:
- hidden side effects on normal page/API reads
- long-term dual-track maintenance
- harder PostgreSQL migration later
- confusing ownership/user binding semantics

## Script location

- `scripts/migrate-legacy-json-to-prisma.mjs`
