# Typewind v4 Migration Guide

This guide covers migrating a project from typewind v0.3.x (Tailwind v3) to typewind v1.0.x (Tailwind v4).

---

## Overview of changes

| Area | v3 | v4 |
|------|----|----|
| Tailwind config | `tailwind.config.cjs` (JS) | CSS file with `@theme {}` |
| Content scanning | `content.transform: typewindTransforms` | `typewind/vite` Vite plugin |
| Type generation | `tailwindcss` v3 internals | `__unstable__loadDesignSystem` v4 API |
| CSS processing | `postcss` + `tailwindcss` | `@tailwindcss/vite` |
| SWC plugin | `typewind/swc` | Removed (use Babel via `typewind/vite`) |
| Package version | `typewind: ^0.3.0` | `typewind: ^1.0.0` |

---

## Step-by-step migration

### 1. Update dependencies

```bash
# Remove old Tailwind-related packages
pnpm remove tailwindcss autoprefixer

# Install Tailwind v4
pnpm add -D tailwindcss @tailwindcss/vite

# Update typewind
pnpm add typewind@^1.0.0
```

**Also install Babel for the Vite plugin:**
```bash
pnpm add -D @babel/core @babel/preset-typescript
```

### 2. Create a CSS entry file

Tailwind v4 uses CSS-based configuration instead of `tailwind.config.js`.

Create or update your main CSS file (e.g., `src/index.css` or `app/app.css`):

```css
/* Before (Tailwind v3 style): */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After (Tailwind v4 style): */
@import "tailwindcss";

/* Custom theme values (replaces tailwind.config.cjs theme.extend) */
@theme {
  /* Colors: use --color-{name} format */
  --color-echelon-slate: #708090;
  --color-echelon-cloud-white: #F8F8F8;
  --color-echelon-page-background: #EFEFF8;
  --color-echelon-card-secondary: #FFFFFF;
  --color-echelon-sky-blue: #ACCFFF;
  --color-echelon-graphite: #3A3F41;
  --color-echelon-black: #0F0F0F;
  --color-echelon-navy: #1A3448;
  /* ... add all your custom colors */

  /* Custom breakpoints (if any) */
  --breakpoint-lg: 85.375rem; /* 1366px */
  --breakpoint-3xl: 110.125rem; /* 1762px */

  /* Custom background images */
  /* (use @plugin or custom CSS instead of backgroundImage theme) */
}

/* Additional utilities or overrides */
@source "../app/**/*.{tsx,ts,jsx,js}";
@source "../src/**/*.{tsx,ts,jsx,js}";
```

> **Note:** In Tailwind v4, color values use CSS variable names like `--color-echelon-slate` (with hyphens, NOT underscores). The class `bg-echelon-slate` is generated automatically from `--color-echelon-slate`.

### 3. Update `vite.config.ts`

Replace the PostCSS-based Tailwind setup with the Vite plugin:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'            // NEW
import { typewindVitePlugin } from 'typewind/vite'     // NEW (replaces typewindTransforms)
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    typewindVitePlugin(),  // MUST come before tailwindcss()
    tailwindcss(),
    reactRouter(),
    // ... other plugins
  ],
  // Remove: css: { transformer: 'postcss' }
})
```

> **Important:** `typewindVitePlugin()` must be listed BEFORE `tailwindcss()` so the Babel transform runs before Tailwind scans for class names.

### 4. Remove the old PostCSS config

Delete or empty `postcss.config.mjs` / `postcss.config.cjs`:

```bash
rm postcss.config.mjs
```

If you need PostCSS for other reasons, you can keep it but remove the `tailwindcss` plugin from it.

### 5. Remove `tailwind.config.cjs`

The old `tailwind.config.cjs` file is no longer needed. Your theme customization now lives in the CSS file from step 2.

```bash
rm tailwind.config.cjs
```

**Migration map for `tailwind.config.cjs` → CSS:**

| v3 (JS config) | v4 (CSS) |
|--------------|--------|
| `theme.extend.colors.echelon.slate: '#708090'` | `--color-echelon-slate: #708090;` in `@theme {}` |
| `theme.extend.screens.lg: '1366px'` | `--breakpoint-lg: 85.375rem;` in `@theme {}` |
| `theme.extend.backgroundImage.card-slate: "url(...)"` | `background-image: url(...)` directly in CSS or component |
| `plugins: [require('@tailwindcss/typography')]` | `@plugin '@tailwindcss/typography'` in CSS |

### 6. Update `package.json` typewind configuration

Replace `configPath` with `cssEntry`:

```json
{
  "typewind": {
    "cssEntry": "./src/index.css"
  }
}
```

> The `cssEntry` should point to the CSS file that has `@import "tailwindcss"`.

### 7. Update `package.json` scripts

Update the generate scripts:

```json
{
  "scripts": {
    "predev": "pnpm exec typewind generate",
    "typewind:generate": "pnpm exec typewind generate",
    "postinstall": "pnpm exec typewind generate"
  }
}
```

The `typewind generate` command now reads the CSS entry file instead of `tailwind.config.cjs`.

### 8. Run type generation

```bash
pnpm exec typewind generate
```

This reads your CSS entry file (with `@import "tailwindcss"` and `@theme {}` blocks), generates comprehensive TypeScript types (21k+ class definitions) including all your custom colors.

### 9. Verify your `tw` usage

The typewind DSL syntax is unchanged between v3 and v4:

```typescript
// These all work the same in v4:
tw.flex.items_center.justify_between
tw.bg_echelon_slate.text_white
tw.hover(tw.bg_echelon_navy)
tw.dark(tw.bg_gray_900)
tw.text_xl.font_semibold
tw.bg_echelon_slate$['50']  // opacity modifier → bg-echelon-slate/50
```

**What changed:**

- Negative margin/padding: `tw._mt_4` → `-mt-4` (same syntax, same behavior)
- Container queries: `tw.$lg(tw.underline)` → `@lg:underline` (same syntax, same behavior)
- `tw.raw('class-name')` still works for arbitrary class strings

**What was removed:**

- `typewind/transform` — no longer needed, removed (use `typewind/vite`)
- `typewind/swc` — removed (Vite plugin covers this use case)

### 10. Update class name references

Tailwind v4 changed some class names. Common ones to watch for:

| v3 class | v4 class | Notes |
|----------|----------|-------|
| `shadow` | `shadow-sm` | Default shadow is now smaller |
| `shadow-sm` | `shadow-xs` | Scale shifted |
| `blur` | `blur-sm` | Same shift |
| `rounded` | `rounded-sm` | |
| `border-opacity-*` | Use `border-color/opacity` modifier | e.g., `border-slate-500/50` |
| `text-opacity-*` | Use `text-color/opacity` modifier | |

---

## echelon-pulse/echelon-frontend specific steps

Your project's current state and what to change:

### Current files to update:

**`package.json`** — change `tailwindcss: "^3.4.19"` → `"tailwindcss": "^4.0.0"` and add `"@tailwindcss/vite": "^4.0.0"`. Change `typewind: "^0.3.0"` → `"^1.0.0"`.

**`vite.config.ts`** — Remove the custom `typewindBabelPlugin` function (it's now built into `typewind/vite`). Add `tailwindcss` from `@tailwindcss/vite` and `typewindVitePlugin` from `typewind/vite`.

**`tailwind.config.cjs`** — Delete this file. Convert all the custom colors to `@theme {}` in your CSS entry.

**`postcss.config.mjs`** — Remove the `tailwindcss` plugin. Keep `autoprefixer` if still needed (v4 handles most prefixing automatically).

**`src/index.css`** — Currently just has `.rdg-sort-arrow` and `.modal-open` styles. Convert to import tailwindcss and add theme:

```css
@import "tailwindcss";

@theme {
  /* Breakpoints */
  --breakpoint-lg: 85.375rem;
  --breakpoint-3xl: 110.125rem;

  /* Echelon colors */
  --color-echelon-slate: #708090;
  --color-echelon-cloud-white: #F8F8F8;
  --color-echelon-page-background: #EFEFF8;
  --color-echelon-card-secondary: #FFFFFF;
  --color-echelon-nav-glass: #FCFCFC4D;
  --color-echelon-border-neutral: #D5D5D5;
  --color-echelon-border-light: #ECECEC;
  --color-echelon-sky-blue: #ACCFFF;
  --color-echelon-glass-bg: #FCFCFC;
  --color-echelon-graphite: #3A3F41;
  --color-echelon-black: #0F0F0F;
  --color-echelon-white: #FFFFFF;
  --color-echelon-mist: #DEECF0;
  --color-echelon-regent-gray: #859EA4;
  --color-echelon-mineral-gray: #455E66;
  --color-echelon-navy: #1A3448;
  --color-echelon-tab-active: #E1F0FD;
  --color-echelon-text-navy-medium: #446F91;
  --color-echelon-control-background: #F9FAFB;
  --color-echelon-control-text: #171717;
  --color-echelon-control-border: #D4D4D8;
  --color-echelon-control-hover-border: #A1A1AA;
  --color-echelon-control-icon: #52525B;
  --color-echelon-new-pink-blob: #45cf76;
  --color-echelon-success-bg: #D6F8E2;
  --color-echelon-success-border: #A4EDC1;
  --color-echelon-success-text: #21774D;
  --color-echelon-text-primary: #2B2B2B;
  --color-echelon-text-muted: #5F5F5F;
  --color-echelon-text-strong: #1F1F1F;
  --color-echelon-divider: #DDDDDD;
  --color-echelon-text-subtle: #676767;
  --color-echelon-tin-bg: #E3F0F4;
  --color-echelon-tin-border: #C5DDE4;
  --color-echelon-tin-text: #496C75;
  --color-echelon-info-text: #5B8494;
  --color-echelon-violet-bg: #EAEEFE;
  --color-echelon-violet-border: #CDD6FF;
  --color-echelon-violet-text: #433FE6;
  --color-echelon-violet-accent: #4447DA;
  --color-echelon-violet-soft-bg: #EEF2FF;
  --color-echelon-violet-soft-text: #6366F1;
  --color-echelon-violet-card-border: #CDD9FF;
  --color-echelon-danger-bg: #FBE7E6;
  --color-echelon-danger-border: #FFC9C6;
  --color-echelon-warning-bg: #FFE6CF;
  --color-echelon-warning-border: #FFC898;
  --color-echelon-danger-text: #A95051;
  --color-echelon-warning-text: #A86633;
  --color-echelon-soft-danger-bg: #FDF4F3;
  --color-echelon-soft-danger-border: #F8E7E4;
}

@source "../app/**/*.{tsx,ts,jsx,js}";

/* Existing utility styles */
.rdg-sort-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-left: 4px;
}

.modal-open {
  overflow: hidden;
  position: fixed;
  width: 100%;
  height: 100%;
}

.modal-open html {
  overflow: hidden;
}
```

> **Note on color naming:** In v4, the CSS variable `--color-echelon-cloud-white` generates `bg-echelon-cloud-white`, `text-echelon-cloud-white`, etc. In typewind this becomes `tw.bg_echelon_cloud_white` (all dashes → underscores).

### Updated vite.config.ts for echelon-frontend:

```typescript
import { reactRouter } from '@react-router/dev/vite'
import { tailwindcss } from '@tailwindcss/vite'
import { typewindVitePlugin } from 'typewind/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { reactRouterDevTools } from 'react-router-devtools'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const config = defineConfig(({ command }) => ({
  plugins: [
    tsconfigPaths(),
    reactRouterDevTools({ /* ... your existing config */ }),
    typewindVitePlugin(),   // ← replaces typewindBabelPlugin()
    tailwindcss(),          // ← replaces postcss tailwindcss
    reactRouter(),
    command === 'build' && sentryVitePlugin({ /* ... */ }),
  ],
  // Remove: css: { transformer: 'postcss' }
  build: { /* ... keep as-is */ },
  // ... rest of your config unchanged
}))

export default config
```

---

## xl-tech/xl-media-dashboard-fe specific steps

Same steps as above. Your custom colors from `tailwind.config.cjs` go into `@theme {}` in your CSS file.

---

## Troubleshooting

### `typewind generate` fails with "No Tailwind v4 CSS entry point found"

Add to `package.json`:
```json
{ "typewind": { "cssEntry": "./src/index.css" } }
```

### Custom classes not showing up in types after generate

Ensure your CSS file has `@import "tailwindcss"` (not the old `@tailwind base` directives) and that `--color-*` variables follow the exact format with hyphens.

### `tw.someClass` is not typed (shows as error)

Run `pnpm exec typewind generate` — the generated types may be stale. Add it to your `predev` script so it runs automatically.

### TypeScript shows error on `tw` import

The package ships `dist/index.d.ts` which is a placeholder until types are generated. Run `typewind generate` to populate it.

### Vite HMR not working after changes to CSS theme

Vite should pick up CSS file changes automatically. If not, restart the dev server after updating `@theme {}` blocks.

### Class not found in v4 that worked in v3

Some class names changed between Tailwind v3 and v4. Check the [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide) for the full list of renamed utilities.
