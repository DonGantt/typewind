# Typewind Session Memory

A dump of everything done in one long session, so it can be picked back up later. Written 2026-10-02. **Nothing described here has been committed or pushed** — it's all still local working-tree changes (per a standing "do not commit/push" instruction given mid-session). Check `git status` before assuming any of this is safe.

## Quick orientation if you're picking this up cold

- Repo: `DonGantt/typewind` (fork of the original `mokshit06/typewind`), package renamed to **`typewind-v4`**, rebuilt for Tailwind v4.
- Current branch: `main`. Live npm version: `typewind-v4@0.1.1`.
- Everything below is **uncommitted**. Run `git status --porcelain` first — there's a large diff waiting, plus two new untracked trees: `docs-site/` (new, unfinished) and `packages/typewind/dist/swc.wasm` (new, working).
- There's also a **stray, unexplained `pnpm-lock.yaml` at the repo root** (untracked). Nobody intentionally created it this session — origin unknown. Investigate before deleting (don't just rm it blind).

---

## Phase 1 — `aspect` arbitrary value support

- Added `'aspect'` to `ARBITRARY_FAMILIES` in `packages/typewind/src/cli.ts` so `tw.aspect_['7/5']` type-checks and compiles to `aspect-[7/5]`. The runtime/evaluate proxies already handled this generically; only the generated TS types needed the family added.
- Shipped via branch `feature/aspect_arbitrary_value_support` → PR #1 → merged.

## Phase 2 — Security/Dependabot pass

- Pulled all Dependabot alerts (223 at the time): almost entirely in `site/` (old Nextra docs, dev-only), `examples/*`, and root — **not** in `packages/typewind`'s actual runtime deps.
- Bumped `next` in `examples/next-example` and `site/` from v13/v14 → `^16.3.5` (removed the unused, dead `@next/font` dependency that was blocking the bump via peer conflict).
- Ran `npm audit fix --force` at root — **this went wrong once**: it added `esbuild` and even `release-it` as bogus direct runtime `dependencies` to `packages/typewind` and both Vite examples (npm's hoisting algorithm being overly aggressive). Had to manually revert those specific additions while keeping the legitimate `vite`/`@vitejs/plugin-react` bumps. **Lesson: always diff `npm audit fix --force`'s output file-by-file before trusting it, especially on the published package.**
- Fixed a real latent bug this surfaced: `packages/typewind`'s `vite.ts` needs `vite`'s types to build its own `.d.ts`, but `vite` was never declared as a dependency anywhere in `packages/typewind` — it only ever worked by accident via npm workspace hoisting from the examples. Added `vite` as an explicit devDependency, which required bumping `tsconfig.json`'s `moduleResolution` from `"node"` to `"bundler"` (vite's own package exports map needs it), which in turn surfaced one unrelated TS strictness error in `utils.ts` (tailwindcss's internal type being "non-portable") — fixed by adding an explicit `TypewindDesignSystem` interface instead of relying on inferred return types from `createTypewindContext()`/`createTypewindContextFromCss()`.
- `site/` (old Nextra docs) still depends on the pre-rename `typewind@^0.1.0` package (not `typewind-v4`) and still uses Tailwind v3 syntax. **Decided not to patch it in place** — see Phase 4, it's being replaced wholesale instead.
- Remaining accepted/deferred risk: `site/`'s `next-mdx-remote` RCE advisory needs a 2-major jump (4.3.0→6.x) that `nextra@2.2.16` wasn't built against; low real-world risk since the site never renders untrusted user MDX, and the site is being replaced anyway.

## Phase 3 — CI / release pipeline (the big saga)

Built from scratch (repo had **no CI or release automation at all** before this):

- **`.github/workflows/ci.yml`**: build + jest test on push/PR to `development`/`main`.
- **`.github/workflows/release-pr.yml`**: manual-dispatch, opens a `release: ...` PR from `development`→`main` listing new commits.
- **`.github/workflows/release-finalize.yml`**: fires when that PR merges (or via `workflow_dispatch`, added later for testing). Two jobs:
  - `release`: bumps version/tags/GitHub-releases via `release-it` (npm publish disabled in its own config — see below).
  - `publish`: environment-gated (`npm-publish`), publishes via **npm OIDC Trusted Publishing** (no `NPM_TOKEN` secret at all).

### The npm Trusted Publishing debugging saga (long, now resolved)

Went through, in order: `E404` (bogus placeholder auth token from `actions/setup-node`'s `registry-url` + an empty `NODE_AUTH_TOKEN` env var — neither config-delete nor empty-string-env actually fixed this), `ENEEDAUTH` (removing `registry-url` entirely made it worse — npm needs it present to even attempt OIDC), `E401` ("token seems invalid" — OIDC *was* being attempted, server-side rejected it). Root cause turned out to be **npm's "Allowed actions" setting on the Trusted Publisher**: direct `npm publish` was left unchecked (deliberately, for security — a compromised CI run can't silently go live), so only `npm stage publish` works. Final fix: switched the publish step to `npm stage publish` (always allowed, no 2FA needed) — CI stages the release, a human runs `npm stage approve <id>` with real 2FA to actually make it live. This is why `release-finalize.yml`'s publish step is `npm stage publish`, not `npm publish`.

- Burned several patch versions (`0.1.1` through `0.1.6`) testing this live via `workflow_dispatch`. User gave a standing rule mid-debug: **every failed test must be reset back to `0.1.0`/cleaned up (delete the stray git tag + GitHub release) before the next test**, so it always lands cleanly on `0.1.1`. Current real published version: `0.1.1`.
- Also fixed along the way: root `npm ci` was failing because `package-lock.json` was stale (package got renamed `typewind`→`typewind-v4` without regenerating the lock), and because a clean install reruns `examples/*`'s `postinstall` (`typewind generate`), which fails without a local Tailwind CSS entry — fixed with `--ignore-scripts` on the explicit `npm ci` steps, plus `npm_config_ignore_scripts: "true"` as a job-level env var (needed because `release-it`'s internal `npm version` call re-syncs the whole workspace lockfile and reruns every workspace's lifecycle scripts, which the CLI-flag-only fix doesn't reach).
- Also enabled, as prerequisites discovered along the way:
  - GitHub Actions "Allow GitHub Actions to create and approve pull requests" (`can_approve_pull_request_reviews`) — was off, blocked `release-pr.yml` from opening PRs via `GITHUB_TOKEN`.
  - npm account 2FA setting: "Require two-factor and disallow bypass 2FA tokens" (the strict option) — chosen deliberately since Trusted Publishing needs no token at all, so there's nothing to lose by disallowing bypass tokens.

## Phase 4 — New docs site (`docs-site/`), replacing `site/`

**Status: scaffolded, builds green, NOT content-complete, NOT deployed, NOT linked up to replace `site/` yet.**

### Why

`site/` (old Nextra/Next.js docs) depends on the dead pre-rename `typewind` package, uses Tailwind v3, and drags in a large vulnerable dependency tree (`nextra`, `next-mdx-remote`, old `next`) that isn't worth patching for a site that may not even be actively deployed. Decided to rebuild it as a static site on the user's own React Router 7 template stack instead of patching Nextra in place.

### SEO requirement (explicit ask: "must match and improve" on the old site)

Settled on **React Router 7's static prerendering** (`ssr: false` + an explicit `prerender()` returning every route) rather than full SSR — gets complete, crawlable HTML per route at build time with zero server runtime needed. The old site had **no `sitemap.xml`, no `robots.txt`, no canonical tags, generic (non-unique) meta descriptions on every page** — all of these are now real and working in `docs-site/`, a genuine improvement, not just parity.

### Where it landed, structurally

Initially copied `~/projects/templates/react-templates/react-ssr-template-app-v2-2026` wholesale, then **threw that away** — it's a full SaaS-app scaffold (auth flows, protected routes, TanStack Query, Sentry, generic CRUD hooks) with nothing to do with a docs site. Rebuilt minimal, but was corrected **three times** by the user for not actually matching the template's real conventions closely enough. Final, confirmed-correct conventions (study `react-ssr-template-app-v2-2026` again if anything here is ambiguous):

- `.prettierrc`: `"semi": false, "trailingComma": "none", "singleQuote": true` — **no semicolons, no trailing commas**, anywhere.
- Path aliases are **bare, per-top-level-folder** (`shared/*`, `utils/*`, `pages/*`, `content/*`), not a `~/` prefix.
- **`app/` vs `src/` split**: `app/` holds *only* routing glue — `root.tsx`, `routes.ts`, and thin per-route wrapper files. All real implementation lives in `src/`.
- **Folder-per-component**, not flat files: `src/shared/components/Header/index.tsx`, not `Header.tsx`. Each component is a **default export** plus a separately-exported `XProps` type. Each directory has a barrel `index.tsx` re-exporting `{ default as X, type XProps }`.
- **Thin route-file pattern**: a route file (`app/routes/docs/installation.tsx`) imports the real page component from `pages/docs` and re-exports it as `default`, plus exports `meta`/`loader` as needed — mirrors the template's `_home.tsx` → `HomePage` pattern exactly.
- `classNames` utility (`src/utils/index.ts`): `(...classes: unknown[]) => classes.filter(Boolean).join(' ')` — copied verbatim from the template, used to combine `tw.` chains with conditionals.
- `vite.config.ts`: reused the template's `optimizeDeps.exclude: ['lightningcss']` (a real fix the template already had for a Vite pre-bundling issue with typewind's `lightningcss` dependency) and its `server.watch.usePolling`/host/port block.
- **`scripts/generate-sitemap.ts`** is adapted almost verbatim from the template's own `src/utils/seo/index.ts` — same `flattenRoutes` recursive logic, same `sitemap` npm package, same `VITE_SITE_URL`-via-`loadEnv` pattern, derives paths straight from `app/routes.ts` (single source of truth, can't drift). `package.json` scripts: `generate:sitemap` is a separate script wired via a `prebuild` hook (matches the template's Dockerfile, which runs `generate:sitemap` as an explicit step *before* `build`, not after — got this backwards once, fixed).
- One **deliberate deviation**: the template hand-rolls its own `typewindBabelPlugin()` inline (against the old pre-rename `typewind` package). Used the official `typewindVitePlugin` from `typewind-v4/vite` instead — more complete (handles Tailwind v4's class-scanning file), and it's literally the package this whole repo publishes.

### Domain / config decisions

- Domain not yet decided (this is a fork of the original `typewind.dev`, needs its own). Everything is driven by a single `VITE_SITE_URL` env var (`.env.example` has `http://localhost:5173` as the dev default) — canonical URLs, `og:image`, sitemap, robots.txt `Sitemap:` line all read from it. Swapping the real domain in later is a one-line change.
- Hosting target and `site/`'s eventual fate (delete vs. keep as fallback) — **still undecided, not blocking**.

### Content migrated

All 18 routes from the old `site/pages/docs/**` + home page, ported into `src/content/docs/**` (mdx) + `src/pages/docs/<Name>Page/index.tsx` (one folder per page) + `app/routes/docs/*.tsx` (thin wrappers). Fixed along the way:
- Every `typewind` import → `typewind-v4` (including inside example code blocks shown to readers, e.g. `installation.mdx`'s `npm install typewind` command, and `transpilers/babel.mdx`'s `"typewind/babel"` plugin reference).
- Stale GitHub links (`mokshit06/typewind` → `DonGantt/typewind`) and one stale absolute `typewind.dev` URL → relative.
- Dropped the `Tweet` embed from `docs/index.mdx` (was already hidden via a `hidden` CSS class in the original — dead content).
- Added real, unique, per-page `description` frontmatter to all 17 doc pages (the old site had zero per-page descriptions, just one generic tagline everywhere) — flows through into `<meta name="description">`, `og:description`, `twitter:description` via `buildMeta()`.
- Built lightweight replacements for Nextra's `Tab`/`Tabs`/`Callout`/`Cards`/`Card`/`Steps` components (grouped in `src/shared/components/Mdx/index.tsx`, named exports, no default — the one place that doesn't fit the folder-per-component convention, justified since they're a tightly-coupled compound-component kit).

### Build status

`npm run build` in `docs-site/` is **green** — all 18 routes prerender to real static HTML with correct per-page titles/canonical/descriptions, `sitemap.xml` + `robots.txt` generate correctly into `build/client/`. Real content confirmed present in the static HTML (not an empty JS shell).

Non-obvious fixes required to get there, worth knowing if the build ever breaks again:
- `@react-router/node` must be in `dependencies`, not `devDependencies` — a known CLI quirk, the build tooling needs to resolve a server-runtime package for an internal check even with `ssr: false`.
- `vite-tsconfig-paths` doesn't resolve aliases for imports *from* `.mdx` files (only recognizes standard JS/TS extensions) — had to add an explicit `resolve.alias` block in `vite.config.ts` as a universal fallback, duplicating the tsconfig paths.
- `react-router build` auto-added `isbot@5` to `package.json` and triggered a broken partial reinstall once (dropped 275 packages) — if that happens again, just `rm -rf node_modules && npm install`.

### Explicitly NOT done yet in docs-site

- `.eslintrc.js`, `Dockerfile`/`docker-compose.yml`, `.husky/`, `.editorconfig`, `.gitattributes`, `.vscode/settings.json` — template has all of these, docs-site doesn't yet.
- Not wired up to actually replace `site/` in the repo (no routing/deploy changes made to retire `site/`).
- Domain/hosting decision pending (see above).

## Phase 5 — SWC plugin restoration

User's ask: `transpilers/swc.mdx` (both old and new docs) documented an SWC plugin (`typewind/swc` → `typewind-v4/swc`) that **had no corresponding export in the package at all** — a real feature gap, not just a naming issue. Asked to make it actually work, "unless there's a reason not to."

**Found a real reason to pause first**: no Rust toolchain was installed in the environment at all. Confirmed with the user before installing anything.

- Installed `rustup`, pinned toolchain `1.87.0` (matching `packages/typewind/rust-toolchain`), target `wasm32-wasip1`.
- The Rust source (`packages/typewind/swc/lib.rs`) turned out to be a **genuinely complete implementation**, not a stub — full recursive expression analyzer, handles member chains/arbitrary values/`raw()`/`variant()`/`important()`, has its own passing test. It was just never wired into the npm package's build/exports, and was pinned to a badly outdated `swc_core = "27.0.1"` (predates this repo's v4 rework).
- Compiled fine at `27.0.1`, but **failed real-world verification**: tested via `@swc/core`'s Node API directly (bypassing Next.js, since `examples/next-example` has an unrelated pre-existing Tailwind v3 issue that would've muddied the test) — got an ABI/protocol mismatch error. Root cause: SWC's plugin ABI is tightly version-locked to the `swc_core` crate version. Looked up the actual fix (not guessed): bump `swc_core` to `>=47` (we used latest, `80.0.0`) and add `--cfg=swc_ast_unknown` as a `wasm32` target rustflag in `.cargo/config.toml`.
- The version jump (27→80) caused exactly 3 compile errors, all the same root cause: `Lit::Str.value`'s type changed from plain `Atom` to `Wtf8Atom` (an upstream WTF-8/spec-correctness improvement for string literals). Fixed by calling `.to_atom_lossy().to_string()` at each of the 3 call sites instead of `.to_string()`/`.as_ref()` directly.
- **Verified working for real**: `tw.flex.items_center.hover(tw.bg_black).important(tw.text_red_500)` correctly compiles to `"items-center flex hover:bg-black !text-red-500"` via the actual `@swc/core` transform pipeline (class order differs from source order but that's cosmetically irrelevant — CSS class order in an attribute has no effect on styling).
- Wired into the package for real: `dist/swc.wasm` built via a new `build:swc` npm script (`cargo build-wasi --release ... && cp ... dist/swc.wasm`), chained into the main `build` script. Added `"./swc": "./dist/swc.wasm"` to `package.json`'s `exports`. Added it to the README's integrations table.
- Fixed the stale references: `typewind/swc` → `typewind-v4/swc` in both the docs page and `examples/next-example/next.config.js`; `typewind/babel` → `typewind-v4/babel` in `transpilers/babel.mdx` (found while in there).
- **Also fixed CI**, since it would've silently broken on the next push: added a `dtolnay/rust-toolchain@1.87.0` (+ `wasm32-wasip1` target + Cargo registry caching) step to both `ci.yml` and `release-finalize.yml` (both jobs that build `packages/typewind`), since that build now includes compiling the SWC plugin.

---

## Standing rules this session (given by the user, apply going forward)

- **Never commit, push, or publish anything without an explicit ask in that exact turn** — this was stated early and never rescinded; everything above is sitting uncommitted for a reason.
- **No code comments by default**, in any file, any language — stated twice, treat as a hard default, not a style preference. Put reasoning in commit messages/PR descriptions/chat instead.
- Never push anything referencing "Claude" (hook files, commit messages, etc.) without explicit in-the-moment permission — once pushed, traces can't be fully scrubbed (force-push removes the commit but GitHub's PR timeline still logs the force-push event forever).
- When matching an existing codebase's conventions, **go look at the actual files** (prettier/eslint config, a real component, the actual folder tree) rather than inferring style from a README description — got corrected three times for exactly this in the docs-site work.

## Immediate next steps, if resuming

1. Investigate and resolve the stray `pnpm-lock.yaml` at repo root.
2. Decide `docs-site/`'s remaining gaps: domain, hosting target, tooling parity (eslint/docker/husky), and actually cut over from `site/` (or decide to delete `site/` vs. keep it).
3. Decide whether/when to commit all of this — it's a lot of uncommitted work across many files; probably wants splitting into logical PRs rather than one giant commit (e.g.: security fixes / CI+release pipeline / docs-site / SWC restoration as separate PRs).
4. Consider testing the SWC plugin against the *real* `examples/next-example` once its unrelated Tailwind v3 issue is sorted, not just the isolated `@swc/core` harness.
5. `Cargo.lock` changed with the `swc_core` bump — make sure it's committed alongside `Cargo.toml` whenever this does get committed.
