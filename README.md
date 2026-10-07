# CRS & FATCA filing workspace

The current product lives in [`platform/`](platform/): a TypeScript workspace for preparing CRS and FATCA returns, validating XML and maintaining filing metadata and correction history.

Built by [Evologics Ltd](mailto:contacts@evologics.ai).

## Start here

- [Platform documentation](platform/README.md): architecture, filing flows and release gates.
- [Design philosophy](platform/DESIGN.md): interface principles and operator safeguards.
- [Deployment guide](platform/DEPLOY.md) and [production runbook](platform/PRODUCTION_RUNBOOK.md).
- [Legacy application](LEGACY.md): the root React/Firebase application, retained with its existing configuration and workflows.

## Develop and verify the platform

Use Node.js 22 and pnpm 10.33.0, as pinned in `platform/package.json` and CI.

```bash
cd platform
pnpm install --frozen-lockfile
pnpm --filter @crs/web dev

pnpm typecheck
pnpm test
pnpm --filter @crs/web build
pnpm audit --prod --audit-level high
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests build their own production preview. Unit tests include filing-domain, strict import and workspace-state regressions. Failed browser runs retain traces in `platform/test-results/`.

## Repository boundaries

`platform/` has its own package manifest, lockfile and CI. The root application uses npm and Firebase; its commands and hosting instructions remain in [LEGACY.md](LEGACY.md). Run each tool from the corresponding application directory. Keep generated builds, browser traces and local environment files out of Git.

For the legacy app, copy `.env.example` to `.env` and configure the required values locally or in the hosting environment. Production credentials must be supplied through the hosting provider or GitHub secrets. Previously committed environment values remain in Git history; removing the file does not revoke them.

## Release status

Automated checks validate software behaviour and schema structure. Controlled MRA acceptance of representative CRS and FATCA output, accepted regression fixtures and a documented backup restore remain external release gates. Do not describe the product as MRA-approved or regulator-certified before those gates are met.

## Support

<contacts@evologics.ai>
