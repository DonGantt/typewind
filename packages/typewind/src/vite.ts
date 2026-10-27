import type { Plugin, ViteDevServer } from 'vite';
import type { SourceMapPayload } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.vite', 'vendor']);
const SOURCE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) results.push(...collectSourceFiles(full));
      } else if (entry.isFile() && SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch { /* ignore permission/access errors */ }
  return results;
}

// A regex scanning compiled source text for `"..."` pairs can't tell a
// string's own quote character from a plain literal double-quote sitting
// inside a DIFFERENTLY-quoted string (e.g. `'"'`) — one stray `"` desyncs
// every pairing after it for the rest of the file, silently dropping every
// real class string that follows. Reading `StringLiteral` nodes straight off
// the already-parsed AST sidesteps the ambiguity entirely: Babel has already
// resolved exactly where each string starts and ends.
function collectStringLiterals(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectStringLiterals(item, out);
    return;
  }
  const n = node as { type?: unknown; value?: unknown; [key: string]: unknown };
  if (typeof n.type !== 'string') return;
  if (n.type === 'StringLiteral' && typeof n.value === 'string') out.push(n.value);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
    collectStringLiterals(n[key], out);
  }
}

// Cheap enough to run on every transform, and avoids keeping a second full
// copy of every file's source text around just to check staleness later.
function hashSource(code: string): string {
  return crypto.createHash('sha1').update(code).digest('hex');
}

export function typewindVitePlugin(): Plugin {
  // Keyed by file id ALONE, one entry per file, overwritten on change — not
  // by `id + content`, which made every edit add a new, never-evicted entry
  // (confirmed leak: ~78MB retained per 300 edits to one file in a synthetic
  // repro, never reclaimed even after a forced GC). The `hash` lets a cache
  // hit skip re-parsing without keeping a second copy of the source string.
  const cache = new Map<
    string,
    { hash: string; code: string; map: SourceMapPayload | null; ast: unknown }
  >();
  let projectRoot = '';

  function babel(code: string, id: string) {
    const hash = hashSource(code);
    const cached = cache.get(id);
    if (cached && cached.hash === hash) return cached;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const babelCore = require('@babel/core') as typeof import('@babel/core');
    if (!babelCore) return null;

    const ext = id.split('.').pop() ?? 'ts';

    const result = babelCore.transformSync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      plugins: ['typewind-v4/babel'],
      sourceMaps: true,
      parserOpts: {
        plugins: ext === 'ts' || ext === 'tsx' ? ['typescript', 'jsx'] : ['jsx'],
      },
      ast: true,
    });

    if (!result?.code) return null;

    const out = {
      hash,
      code: result.code,
      map: result.map as SourceMapPayload | null,
      ast: result.ast,
    };
    cache.set(id, out);
    return out;
  }

  function writeClassesFile() {
    const classSet = new Set<string>();
    for (const file of collectSourceFiles(projectRoot)) {
      try {
        const code = fs.readFileSync(file, 'utf8');
        const result = babel(code, file);
        if (result?.ast) {
          // Collect space-separated class strings produced by the Babel
          // transform. Tailwind v4 candidates can contain almost any
          // character once variants (hover:, dark:, sm:, group-has-[...]:,
          // **:), arbitrary values ([#fff], [calc(100%-2rem)]) and modifiers
          // (!, @, /, .) are involved — a shape-based allowlist would reject
          // exactly the resolved strings (e.g. "hover:bg-cyan-900",
          // "text-[200px]") that only ever exist here, never as literal text
          // in the source files Tailwind scans from disk. So we keep any
          // non-empty, reasonably-sized, non-numeric token and let
          // Tailwind's own oxide scanner decide what's a real utility
          // candidate.
          const strings: string[] = [];
          collectStringLiterals(result.ast, strings);
          for (const value of strings) {
            for (const cls of value.split(/\s+/)) {
              if (cls && cls.length <= 256 && !/^-?[0-9.]+$/.test(cls)) {
                classSet.add(cls);
              }
            }
          }
        }
      } catch { /* skip files that fail to transform */ }
    }

    fs.writeFileSync(
      path.join(projectRoot, '.typewind-classes.txt'),
      [...classSet].join(' '),
      'utf8'
    );
  }

  return {
    name: 'typewind',
    // Run before @tailwindcss/vite so Tailwind sees the actual class strings
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root;
    },

    // Production / SSR builds: write the classes file before any transforms run.
    buildStart() {
      if (projectRoot) writeClassesFile();
    },

    // Dev server: buildStart is not called, so we write here instead.
    // configureServer fires before the server starts serving requests, so the
    // file exists by the time @tailwindcss/vite processes index.css.
    configureServer(_server: ViteDevServer) {
      if (projectRoot) writeClassesFile();
    },

    // A deleted (or renamed-away-from) file's cache entry would otherwise
    // never leave the cache for the life of the dev server.
    watchChange(id, { event }) {
      if (event === 'delete') cache.delete(id);
    },

    // Regenerate on file changes in dev mode so new classes are picked up.
    handleHotUpdate({ file }) {
      if (
        projectRoot &&
        /\.(tsx?|jsx?)$/.test(file) &&
        !file.includes('node_modules')
      ) {
        writeClassesFile();
      }
    },

    transform(code, id) {
      if (!/\.(tsx?|jsx?)$/.test(id)) return null;
      if (id.includes('node_modules')) return null;
      const result = babel(code, id);
      return result && { code: result.code, map: result.map };
    },
  };
}
