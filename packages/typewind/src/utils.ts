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
    showPixelEquivalents: false,
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
