import type { Plugin, ViteDevServer } from 'vite';
import type { SourceMapPayload } from 'node:module';
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

export function typewindVitePlugin(): Plugin {
  const cache = new Map<string, { code: string; map: SourceMapPayload | null }>();
  let projectRoot = '';

  function babel(code: string, id: string) {
    const cacheKey = id + ':' + code;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

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
    });

    if (!result?.code) return null;

    const out = { code: result.code, map: result.map as SourceMapPayload | null };
    cache.set(cacheKey, out);
    return out;
  }

  function writeClassesFile() {
    const classSet = new Set<string>();
    for (const file of collectSourceFiles(projectRoot)) {
      try {
        const code = fs.readFileSync(file, 'utf8');
        const result = babel(code, file);
        if (result?.code) {
          // Extract space-separated class strings produced by the Babel transform.
          // Tailwind v4 candidates can contain almost any character once variants
          // (hover:, dark:, sm:, group-has-[...]:, **:), arbitrary values
          // ([#fff], [calc(100%-2rem)]) and modifiers (!, @, /, .) are involved —
          // a shape-based allowlist would reject exactly the resolved strings
          // (e.g. "hover:bg-cyan-900", "text-[200px]") that only ever exist here,
          // never as literal text in the source files Tailwind scans from disk.
          // So we keep any non-empty, reasonably-sized, non-numeric token and let
          // Tailwind's own oxide scanner decide what's a real utility candidate.
          for (const match of result.code.matchAll(/"([^"\\]+)"/g)) {
            for (const cls of match[1].split(/\s+/)) {
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
      return babel(code, id);
    },
  };
}
