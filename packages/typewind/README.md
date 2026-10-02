<h1 align="center">typewind-v4</h1>

<p align="center">
  The <em>safety</em> of TypeScript with the <em>magic</em> of Tailwind CSS v4.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/typewind-v4"><img src="https://img.shields.io/npm/v/typewind-v4" alt="npm version"></a>
  <a href="https://github.com/DonGantt/typewind/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/typewind-v4" alt="license"></a>
</p>

---

## Introduction

Typewind brings the safety, productivity, and intellisense of TypeScript to Tailwind CSS. It compiles away entirely at build time, leaving zero runtime code.

```tsx
import { tw } from 'typewind-v4';

const styles = tw.border.hover(tw.border_black);

// ↓ ↓ ↓ compiles to ↓ ↓ ↓

const styles = 'border hover:border-black';
```

## Installation

```sh
npm install typewind-v4
```

Typewind needs a Tailwind v4 CSS entry point to read your theme from:

```css
/* src/app.css */
@import "tailwindcss";
```

If that file isn't at a default location, point Typewind at it in `package.json`:

```json
{
  "typewind": { "cssEntry": "./src/app.css" }
}
```

Generate the `tw` types for your project (re-run this whenever your Tailwind config/theme changes):

```sh
npx typewind generate
```

Then wire up the compiler for your build tool — see [Integrations](#integrations) below.

## How it works

Typewind's compiler statically analyzes your code and rewrites every `tw` expression into its corresponding Tailwind class string, so nothing from the `tw` API ships to the browser.

```tsx
import { tw } from 'typewind-v4';

const styles = tw.border.hover(tw.border_black);

// ↓ ↓ ↓ ↓ ↓ ↓

const styles = 'border hover:border-black';
```

Types for `tw` are generated directly from your Tailwind config/theme, so autocomplete and type errors always match your actual design system — including custom colors, spacing, and plugins.

```tsx
import { tw } from 'typewind-v4';

const styles = tw.border_blackk; // ❌ Property 'border_blackk' does not exist on type 'Typewind'. Did you mean 'border_black'?
```

## Features

**Zero bundle size** — Typewind compiles away completely; only the resulting Tailwind class strings ship.

**Apply variants to multiple styles at once**

```tsx
const mediaStyles = tw.sm(tw.w_4.mt_3).lg(tw.w_8.mt_6);
const nested = tw.text_sm.sm(tw.bg_black.hover(tw.bg_white.w_10));
```

**Arbitrary values** for utility families that support them (spacing, colors, sizing, positioning, typography, transforms, effects, grid, and more):

```tsx
tw.bg_['#1da1f2'];
tw.w_['calc(100%-2rem)'];
tw.aspect_['7/5'];
```

**Arbitrary variants and container queries**

```tsx
tw.variant('&:nth-child(3)', tw.bg_red_500);
tw['@md'](tw.grid_cols_2);
```

**Negative values**

```tsx
tw._mt_4; // -mt-4
```

**Opacity shorthand** on color utilities:

```tsx
tw.bg_black$['50']; // bg-black/50
```

**`raw`, `variant`, and `important` escape hatches** for anything outside the typed surface:

```tsx
tw.raw('custom-class');
tw.important(tw.text_red_500);
```

**Gray/grey alias** — both spellings resolve to the same Tailwind color scale.

## Integrations

| Entry point | Use case |
| --- | --- |
| `typewind-v4/babel` | Babel plugin (works with any Babel-based toolchain, including Next.js/Webpack) |
| `typewind-v4/vite` | Vite plugin |
| `typewind-v4/swc` | SWC plugin (Next.js `experimental.swcPlugins`, or standalone via `.swcrc`) — compiled to WASM, can't read your Tailwind config, so arbitrary values only work for predefined Tailwind values |
| `typewind-v4/transform` | Programmatic access to the underlying source transform |
| `typewind-v4/cn` | `clsx` + `tailwind-merge` helper for conditional/merged class strings |

See the [docs](https://github.com/DonGantt/typewind) for full setup guides per integration.
