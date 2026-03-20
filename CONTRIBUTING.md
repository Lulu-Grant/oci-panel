# Contributing

Thanks for your interest in OCI Panel.

## Before you start

Please read these first:

- `README.md`
- `PROJECT_INDEX.md`
- `LEGACY_CLEANUP.md` (if your work touches old JSON migration)

## Project direction

This project is an **OCI multi-account asset control console**.

Please avoid pushing it backward into a minimal "instance power toggle" tool.

Important direction constraints:

- Keep Prisma models as the runtime source of truth
- Do not revert to JSON runtime storage
- Keep the manual-refresh console strategy intact
- Do not reintroduce SSH-credential-based DD as the main advanced workflow
- Prefer OCI-native capability expansion where possible

## Development setup

```bash
npm install
cp .env.example .env
npm run dev -- --hostname 0.0.0.0
```

## Validation

Before submitting a PR, please run:

```bash
npm run build
```

If your change affects behavior, also do a manual smoke test in the browser.

## Pull requests

Good PRs are:

- focused
- documented
- tested
- aligned with current product direction

Please include:

- what changed
- why it changed
- screenshots when UI is affected
- any migration / compatibility notes

## Areas that benefit from contributions

- Dashboard polish
- OCI-native advanced operations
- UX refinement for create / instances / capacity
- Error handling and empty states
- Documentation and setup improvements

## Security / secrets

Do not commit:

- `.env`
- database files
- runtime logs
- private keys
- local JSON account/log data

See `.gitignore` and `SECURITY.md`.
