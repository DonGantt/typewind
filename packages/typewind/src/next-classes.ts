#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'generated', '.vite', 'vendor']);
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

function writeClassesFile(srcDir: string, outFile: string): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const babel = require('@babel/core') as typeof import('@babel/core');
  const classSet = new Set<string>();

  for (const file of collectSourceFiles(srcDir)) {
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!code.includes('typewind-v4')) continue;

    const ext = file.split('.').pop() ?? 'ts';
    let result;
    try {
      result = babel.transformSync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        plugins: ['typewind-v4/babel'],
        parserOpts: {
          plugins: ext === 'ts' || ext === 'tsx' ? ['typescript', 'jsx'] : ['jsx'],
        },
      });
    } catch {
      continue;
    }
    if (!result?.code) continue;

    for (const match of result.code.matchAll(/"([^"\\]+)"/g)) {
      for (const cls of match[1].split(/\s+/)) {
        if (cls && cls.length <= 256 && !/^-?[0-9.]+$/.test(cls)) classSet.add(cls);
      }
    }
  }

  fs.writeFileSync(outFile, [...classSet].join(' '), 'utf8');
  return classSet.size;
}

interface CliArgs {
  watch: boolean;
  src: string;
  out: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { watch: false, src: 'src', out: '.typewind-classes.txt' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--watch' || arg === '-w') args.watch = true;
    else if (arg === '--src') args.src = argv[++i] ?? args.src;
    else if (arg === '--out') args.out = argv[++i] ?? args.out;
  }
  return args;
}

function main(): void {
  const { watch, src, out } = parseArgs(process.argv.slice(2));
  const srcDir = path.resolve(process.cwd(), src);
  const outFile = path.resolve(process.cwd(), out);

  if (!fs.existsSync(srcDir)) {
    console.error(`typewind: source directory not found: ${srcDir}`);
    process.exit(1);
  }

  const run = () => {
    const count = writeClassesFile(srcDir, outFile);
    console.log(`typewind: wrote ${count} classes to ${path.relative(process.cwd(), outFile)}`);
  };

  run();

  if (watch) {
    let pending: NodeJS.Timeout | null = null;
    const debouncedRun = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(run, 150);
    };
    // Recursive fs.watch requires Node 20+ on Linux; one-shot mode above works on any supported Node version.
    fs.watch(srcDir, { recursive: true }, (_event, filename) => {
      if (filename && SOURCE_EXTS.some((ext) => filename.endsWith(ext))) {
        debouncedRun();
      }
    });
    console.log(`typewind: watching ${path.relative(process.cwd(), srcDir)} for changes...`);
  }
}

main();
