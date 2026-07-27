# Deploying the web app

The platform deploys as its **own Vercel project**, separate from the legacy
app at the repository root. Both live in this repo and neither affects the
other: Vercel reads the `vercel.json` at each project's configured Root
Directory, so the legacy project reads `/vercel.json` and this one reads
`/platform/vercel.json`.

## One-time setup

Create a new project in the Vercel dashboard pointing at this repository, then
set **Root Directory to `platform`**. That single setting is what makes
everything else work — the rest is already declared in `platform/vercel.json`
and should be detected automatically:

| Setting | Value |
|---|---|
| Root Directory | `platform` |
| Framework Preset | Other |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm --filter @crs/web build` |
| Output Directory | `apps/web/dist` |
| Node.js Version | 22.x |

There are **no environment variables**. The application has no backend, no
API keys and no analytics — which is the point: it makes no network requests
at all after loading.

> Leave "Include files outside the Root Directory" enabled (the default).
> The web app imports the workspace packages at `platform/packages/*`, which
> sit inside the root directory, but pnpm workspace resolution needs the whole
> `platform` tree.

## Why a separate project rather than a path on the existing one

The legacy app is a Create React App build at the repository root; this is a
pnpm workspace built with Vite. They need different install commands, build
commands and output directories, and a single Vercel project has only one of
each. Keeping them separate also means a failure here cannot take down the
existing deployment.

## What the config does

`platform/vercel.json` sets the build and a security header block. Two of
those headers matter more than the rest:

- **`Content-Security-Policy` with `connect-src 'self'`** — this is the
  enforcement behind the claim that account data never leaves the browser.
  The application makes no outbound requests, and this makes that a rule the
  browser applies rather than a promise the vendor makes.
- **`frame-ancestors 'none'`** — browsers *ignore* `frame-ancestors` when it
  arrives in a `<meta>` tag, so it can only be set here. The `<meta>` CSP in
  `apps/web/index.html` deliberately omits it rather than appearing to protect
  against clickjacking while doing nothing.

`script-src` includes `'wasm-unsafe-eval'` because schema validation runs
libxml2 compiled to WebAssembly, in the browser, so that documents can be
validated without being uploaded.

## Verifying a deployment

After the first deploy, confirm the two things that distinguish this product:

1. Open the network panel, upload a file and generate a return. There should
   be **no requests to any host other than the deployment's own origin**. This
   is asserted by an end-to-end test (`apps/web/e2e/filing.spec.ts`) and should
   hold in production too.
2. Check the response headers include the CSP above. `curl -sI <url> | grep -i
   content-security-policy`.

## Browser support

Schema validation initialises a WebAssembly module using top-level await, so
the build targets ES2022: **Chrome/Edge 89+, Firefox 89+, Safari 15+**. Older
browsers will not load the app.

## Caveat worth stating to users

The OECD XSDs are not vendored into this repository, so deployed builds report
documents as *"not schema-validated"* rather than claiming a validation they
have not performed. See the "Before production" section of `README.md`.
