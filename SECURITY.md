# Security Policy

## Supported versions

This project is early-stage and currently maintained on the latest `main` branch.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for secrets exposure, auth bypass, credential handling flaws, or other sensitive vulnerabilities.

Instead, report privately to the maintainer first and include:

- affected area
- impact
- reproduction steps
- proof-of-concept if available
- suggested mitigation if known

## Sensitive areas in this project

Please pay extra attention to:

- authentication (`next-auth`, JWT/session handling)
- encrypted OCI credential storage
- account/user isolation (`user-scoped` boundaries)
- local environment handling
- any OCI-native advanced operation endpoints

## Disclosure expectations

Please allow reasonable time for triage and remediation before public disclosure.

## Hard rules for contributors

Do not commit:

- `.env` files
- database files
- runtime logs
- OCI private keys
- exported credential payloads
- legacy account/log JSON data used locally
