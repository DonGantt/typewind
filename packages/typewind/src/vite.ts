import type { Plugin } from 'vite';
import type { SourceMapPayload } from 'node:module';

export function typewindVitePlugin(): Plugin {
  const cache = new Map<string, { code: string; map: SourceMapPayload | null }>();

  return {
    name: 'typewind',
    // Run before @tailwindcss/vite so Tailwind sees the actual class strings
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(tsx?|jsx?)$/.test(id)) return null;
      if (id.includes('node_modules')) return null;

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
        plugins: ['typewind/babel'],
        sourceMaps: true,
        parserOpts: {
          plugins: ext === 'ts' || ext === 'tsx' ? ['typescript', 'jsx'] : ['jsx'],
        },
      });

      if (!result?.code) return null;

      const out = { code: result.code, map: result.map as SourceMapPayload | null };
      cache.set(cacheKey, out);
      return out;
    },
  };
}
