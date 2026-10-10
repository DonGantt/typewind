const fmtToTailwind = (s: string) =>
  s.replace(/__/g, '.').replace(/_/g, '-').replace(/^\$/, '@').replace(/\$/, '/');

// Tailwind's color scale only ships under the "gray" spelling. Users who
// write "grey" (either via the typed `tw.bg_grey_500` alias generated in
// cli.ts, or a raw/variant string) get the same utility as "gray" — normalize
// here, once, so every downstream lookup/output only ever sees "gray".
const greyToGray = (s: string) => s.replace(/(^|-)grey(?=-|$)/g, '$1gray');

type ToStringable = { toString(): string };

// Named Tailwind class set for smart arbitrary-value lookup, and the variant
// name set used to validate `*_named` base names (mirrors evaluate.ts).
// Both loaded from _metadata.json in Node/SSR; stay empty in the browser.
let knownClasses = new Set<string>();
let variants = new Set<string>();
try {
  if (typeof require !== 'undefined' && typeof __dirname !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _path = require('path') as typeof import('path');
    const metaPath = _path.join(__dirname, '_metadata.json');
    if (_fs.existsSync(metaPath)) {
      const meta = JSON.parse(_fs.readFileSync(metaPath, 'utf8'));
      if (Array.isArray(meta.classSet)) knownClasses = new Set(meta.classSet);
      if (Array.isArray(meta.variants)) variants = new Set(meta.variants);
    }
  }
} catch {
  // browser environment or missing metadata — always-bracket fallback
}

export const typewind_id = Symbol.for('typewind_style');

export function createRuntimeTw() {
  const twUsed = (classes = new Set<string>()) => {
    // needs to be a function so it's callable
    const target = Object.assign(() => {}, {
      classes,
      prevProp: undefined as string | undefined,
      maybeVariant: undefined as string | undefined,
      // proxy can't be used as string so convert it
      [Symbol.toPrimitive]() {
        if (target.maybeVariant) {
          target.classes.add(target.maybeVariant);
          target.maybeVariant = undefined;
        }

        return [...target.classes].join(' ');
      },
    });

    function spreadModifier(prefix: string, chunks: ToStringable) {
      for (const chunk of chunks.toString().split(' ')) {
        target.classes.add(`${prefix}${greyToGray(chunk)}`);
      }
    }

    const thisTw: any = new Proxy(target, {
      get(target, p, _recv) {
        if (p === typewind_id) {
          return true;
        }

        if (p === 'toString' || p === 'valueOf' || p === Symbol.toPrimitive) {
          return target[Symbol.toPrimitive];
        }

        const isStrProp = ''[p as any] !== undefined;
        if (isStrProp) {
          const prim = target[Symbol.toPrimitive]();
          const value = prim[p as Exclude<keyof string, number>];
          return typeof value === 'function' ? value.bind(prim) : value;
        }

        if (typeof p !== 'string') return null;

        const name = greyToGray(fmtToTailwind(p));

        if (target.prevProp?.endsWith('-')) {
          const base = target.prevProp.slice(0, -1);
          const namedClass = greyToGray(`${base}-${p}`);
          target.classes.add(knownClasses.has(namedClass) ? namedClass : `${base}-[${p}]`);
        } else if (target.prevProp?.endsWith('/')) {
          target.classes.add(`${target.prevProp}${name}`);
        } else if (!name.endsWith('-') && !name.endsWith('/')) {
          if (target.maybeVariant) {
            target.classes.add(target.maybeVariant);
            target.maybeVariant = undefined;
          }

          if (p === 'is_group' || p === 'is_peer') {
            target.classes.add(p === 'is_group' ? 'group' : 'peer');
            target.prevProp = name;
            return thisTw;
          }

          if (p === 'is_group_named' || p === 'is_peer_named') {
            const base = p === 'is_group_named' ? 'group' : 'peer';
            return (groupName: string) => {
              target.classes.add(`${base}/${groupName}`);
              return thisTw;
            };
          }

          if (name === 'raw') {
            return (style: ToStringable) => {
              spreadModifier('', style);
              return thisTw;
            };
          }

          if (name === 'variant') {
            return (modifier: string, classes: ToStringable) => {
              spreadModifier(`[${modifier}]:`, classes);
              return thisTw;
            };
          }

          if (name === 'important') {
            return (style: ToStringable) => {
              spreadModifier('!', style);
              return thisTw;
            };
          }

          // "*"/"**" (direct children / all descendants) aren't valid JS
          // identifiers, so cli.ts generates them as children(...)/descendants(...).
          if (p === 'children' || p === 'descendants') {
            target.maybeVariant = p === 'children' ? '*' : '**';
            return thisTw;
          }

          // group-*/peer-* compound variants also accept a named form:
          // group_hover_named('sidebar', style) -> "group-hover/sidebar:style".
          if (p.endsWith('_named')) {
            const baseName = fmtToTailwind(p.slice(0, -'_named'.length));
            if (variants.has(baseName)) {
              return (groupName: string, style: ToStringable) => {
                spreadModifier(`${baseName}/${groupName}:`, style);
                return thisTw;
              };
            }
          }

          target.maybeVariant = name;
        }

        target.prevProp = name;

        return thisTw;
      },
      apply(target, _thisArg, [style]) {
        const prefix = target.maybeVariant;

        if (!prefix) {
          throw new Error(
            'Typewind Error: unreachable code path, `maybeVariant` is undefined'
          );
        }

        target.maybeVariant = undefined;

        if (!style) {
          throw new Error(
            `Typewind Error: Passing a class to \`${prefix}\` is required`
          );
        }

        spreadModifier(`${prefix}:`, style);

        return thisTw;
      },
      getPrototypeOf() {
        return String.prototype;
      },
    });

    return thisTw;
  };

  const tw = new Proxy(
    {},
    {
      get(_target, p) {
        // @ts-ignore
        if (typeof p !== 'string') return Reflect.get(...arguments);

        return twUsed()[p];
      },
    }
  );

  return tw;
}
