import { __unstable__loadDesignSystem } from 'tailwindcss';
import fs from 'fs';
import path from 'path';

export function loadConfig(): {
  cssEntry: string;
  showPixelEquivalents: boolean;
  rootFontSize: number;
} {
  let pkg: any = {};
  try {
    pkg = require(path.join(process.cwd(), 'package.json'));
  } catch {}
  return {
    cssEntry: '',
    showPixelEquivalents: true,
    rootFontSize: 16,
    ...pkg?.typewind,
  };
}

const CSS_ENTRY_CANDIDATES = [
  'src/index.css',
  'src/app.css',
  'src/globals.css',
  'src/main.css',
  'app/index.css',
  'app/app.css',
  'app/globals.css',
  'index.css',
  'globals.css',
  'app.css',
];

const TW_IMPORT_PATTERNS = [
  '@import "tailwindcss"',
  "@import 'tailwindcss'",
  '@import "tailwindcss/',
  "@import 'tailwindcss/",
];

export function findCssEntryPath(): string {
  const config = loadConfig();

  const searchPaths = config.cssEntry
    ? [config.cssEntry, ...CSS_ENTRY_CANDIDATES]
    : CSS_ENTRY_CANDIDATES;

  for (const candidate of searchPaths) {
    const fullPath = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (TW_IMPORT_PATTERNS.some((p) => content.includes(p))) {
        return fullPath;
      }
    }
  }

  throw new Error(
    [
      'Typewind: No Tailwind v4 CSS entry point found.',
      '',
      'Create a CSS file that imports tailwindcss:',
      '  @import "tailwindcss";',
      '',
      'Then specify its path in package.json:',
      '  "typewind": { "cssEntry": "./src/app.css" }',
      '',
      'See: https://tailwindcss.com/docs/installation',
    ].join('\n')
  );
}

function findTailwindPkgDir(): string {
  return path.dirname(require.resolve('tailwindcss/package.json'));
}

async function loadModule(id: string, base: string) {
  try {
    const resolved = require.resolve(id, { paths: [base, process.cwd()] });
    const mod = require(resolved);
    return { module: mod, base: path.dirname(resolved) };
  } catch {
    throw new Error(
      `Typewind: Could not resolve @plugin '${id}'. Is it installed in your project?`
    );
  }
}

function splitBareSpecifier(id: string): { pkgName: string; subpath: string } {
  const parts = id.split('/');
  if (id.startsWith('@')) {
    return { pkgName: parts.slice(0, 2).join('/'), subpath: parts.slice(2).join('/') };
  }
  return { pkgName: parts[0], subpath: parts.slice(1).join('/') };
}

// `require.resolve('<pkg>/package.json')` throws for a package whose
// "exports" map doesn't explicitly list "./package.json" (common — it's an
// opt-in convention, not a requirement), even though the package itself
// resolves fine. Walk node_modules directories by hand instead, the way a
// CSS bundler locates package metadata without being subject to the
// "exports" map's subpath restrictions (which only govern what code outside
// the package may *import*, not whether its own manifest can be read).
function findPackageDir(pkgName: string, base: string): string | null {
  for (const start of [base, process.cwd()]) {
    let dir = start;
    for (;;) {
      const candidate = path.join(dir, 'node_modules', pkgName);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

// A bare specifier in `@import` (e.g. `@import "tw-animate-css"`) isn't a
// relative path or the tailwindcss package itself, but a real installed
// package whose stylesheet Tailwind's own bundler resolves via Node's
// package resolution — prefer the "style" export condition (the CSS-import
// convention LightningCSS/PostCSS resolvers use), then fall back to a plain
// "style"/"main" field, matching how these packages are actually consumed.
function resolveBarePackageStylesheet(
  id: string,
  base: string
): { content: string; base: string } | null {
  try {
    const { pkgName, subpath } = splitBareSpecifier(id);
    const pkgDir = findPackageDir(pkgName, base);
    if (!pkgDir) return null;
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    const exportEntry = pkg.exports?.[subpath ? `./${subpath}` : '.'];
    const candidates: string[] = [];
    if (typeof exportEntry === 'string') {
      candidates.push(exportEntry);
    } else if (exportEntry && typeof exportEntry === 'object') {
      if (typeof exportEntry.style === 'string') candidates.push(exportEntry.style);
      if (typeof exportEntry.default === 'string') candidates.push(exportEntry.default);
    }
    if (subpath) {
      candidates.push(subpath, subpath + '.css');
    } else {
      if (typeof pkg.style === 'string') candidates.push(pkg.style);
      if (typeof pkg.main === 'string') candidates.push(pkg.main);
    }

    for (const rel of candidates) {
      const full = path.resolve(pkgDir, rel);
      if (fs.existsSync(full)) {
        return { content: fs.readFileSync(full, 'utf8'), base: path.dirname(full) };
      }
    }
  } catch {
    // Not a resolvable package — fall through to empty content, same as
    // today, rather than throwing (a stylesheet loader has no good way to
    // surface "this @import couldn't be resolved" short of silently
    // producing no rules from it).
  }
  return null;
}

function makeStylesheetLoader(tailwindPkgDir: string) {
  return async function loadStylesheet(id: string, base: string) {
    // Resolve tailwindcss package imports (e.g. @import "tailwindcss")
    if (id === 'tailwindcss') {
      const indexCss = path.join(tailwindPkgDir, 'index.css');
      return {
        content: fs.readFileSync(indexCss, 'utf8'),
        base: tailwindPkgDir,
      };
    }

    if (id.startsWith('tailwindcss/')) {
      const rel = id.replace('tailwindcss/', '');
      for (const candidate of [
        path.join(tailwindPkgDir, rel),
        path.join(tailwindPkgDir, rel + '.css'),
      ]) {
        if (fs.existsSync(candidate)) {
          return {
            content: fs.readFileSync(candidate, 'utf8'),
            base: tailwindPkgDir,
          };
        }
      }
      return { content: '', base: tailwindPkgDir };
    }

    // Resolve relative imports
    for (const candidate of [
      path.resolve(base, id),
      path.resolve(base, id + '.css'),
    ]) {
      if (fs.existsSync(candidate)) {
        return {
          content: fs.readFileSync(candidate, 'utf8'),
          base: path.dirname(candidate),
        };
      }
    }

    // A bare package specifier (e.g. `@import "tw-animate-css"`) — resolve
    // it the way Tailwind's own bundler does, not as a relative path.
    if (!id.startsWith('.') && !path.isAbsolute(id)) {
      const resolved = resolveBarePackageStylesheet(id, base);
      if (resolved) return resolved;
    }

    return { content: '', base };
  };
}

export async function createTypewindContext() {
  const cssEntryPath = findCssEntryPath();
  const base = path.dirname(cssEntryPath);
  const cssContent = fs.readFileSync(cssEntryPath, 'utf8');
  const tailwindPkgDir = findTailwindPkgDir();

  return await __unstable__loadDesignSystem(cssContent, {
    base,
    loadStylesheet: makeStylesheetLoader(tailwindPkgDir),
    loadModule,
  });
}

export async function createTypewindContextFromCss(css: string, base: string) {
  const tailwindPkgDir = findTailwindPkgDir();
  return await __unstable__loadDesignSystem(css, {
    base,
    loadStylesheet: makeStylesheetLoader(tailwindPkgDir),
    loadModule,
  });
}
