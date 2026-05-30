// Common Tailwind v4 variants used as fallback when _metadata.json is absent
const DEFAULT_VARIANTS = new Set([
  // Pseudo-classes
  'hover', 'focus', 'active', 'visited', 'target',
  'focus-within', 'focus-visible', 'disabled', 'enabled',
  'checked', 'indeterminate', 'default', 'required', 'optional',
  'valid', 'invalid', 'user-valid', 'user-invalid',
  'in-range', 'out-of-range', 'placeholder-shown', 'autofill',
  'read-only', 'empty', 'open', 'inert',
  // Pseudo-elements
  'before', 'after', 'placeholder', 'file', 'marker',
  'selection', 'first-line', 'first-letter', 'backdrop',
  'details-content',
  // Positional
  'first', 'last', 'only', 'odd', 'even',
  'first-of-type', 'last-of-type', 'only-of-type',
  'nth', 'nth-last', 'nth-of-type', 'nth-last-of-type',
  'not', 'has', 'in',
  // Group / Peer
  'group', 'group-hover', 'group-focus', 'group-active',
  'group-visited', 'group-checked', 'group-disabled',
  'group-focus-within', 'group-focus-visible',
  'peer', 'peer-hover', 'peer-focus', 'peer-active',
  'peer-checked', 'peer-disabled',
  // ARIA
  'aria', 'aria-busy', 'aria-checked', 'aria-disabled',
  'aria-expanded', 'aria-hidden', 'aria-pressed',
  'aria-readonly', 'aria-required', 'aria-selected',
  // Data
  'data',
  // Responsive breakpoints
  'sm', 'md', 'lg', 'xl', '2xl',
  'max-sm', 'max-md', 'max-lg', 'max-xl', 'max-2xl',
  'min-sm', 'min-md', 'min-lg', 'min-xl', 'min-2xl',
  'min', 'max',
  // Container queries (v4)
  '@', '@xs', '@sm', '@md', '@lg', '@xl', '@2xl', '@3xl',
  '@max', '@max-xs', '@max-sm', '@max-md', '@max-lg', '@max-xl', '@max-2xl',
  '@min', '@min-xs', '@min-sm', '@min-md', '@min-lg', '@min-xl', '@min-2xl',
  // Dark mode / Media features
  'dark', 'print', 'portrait', 'landscape',
  'motion-safe', 'motion-reduce',
  'contrast-more', 'contrast-less',
  'forced-colors', 'inverted-colors',
  'pointer-none', 'pointer-coarse', 'pointer-fine',
  'any-pointer-none', 'any-pointer-coarse', 'any-pointer-fine',
  'noscript',
  // Misc
  'ltr', 'rtl', 'starting', 'supports',
]);

let variants = DEFAULT_VARIANTS;

try {
  const fs = require('fs');
  const path = require('path');
  const metaPath = path.join(__dirname, '_metadata.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.variants && Array.isArray(meta.variants)) {
      variants = new Set(meta.variants);
    }
  }
} catch {
  // Use DEFAULT_VARIANTS
}

const fmtToTailwind = (s: string) =>
  s.replace(/_/g, '-').replace(/^\$/, '@').replace(/\$/, '/');

export const createTw: any = () => {
  const twUsed = (classes = new Set<string>()) => {
    const target = {
      classes,
      prevProp: undefined as string | undefined,
      toString() {
        return [...target.classes].join(' ');
      },
    };

    const thisTw: any = new Proxy(target, {
      get(t, p, recv) {
        // @ts-ignore
        if (p === 'toString') return Reflect.get(...arguments);
        if (typeof p !== 'string') return null;

        const name = fmtToTailwind(p);

        if (t.prevProp?.endsWith('-')) {
          // Arbitrary value mode: always wrap in []
          const base = t.prevProp.slice(0, -1);
          t.classes.add(`${base}-[${p}]`);
        } else if (t.prevProp?.endsWith('/')) {
          // Opacity modifier mode
          t.classes.add(`${t.prevProp}${name}`);
        } else if (!name.endsWith('-') && !name.endsWith('/')) {
          function spreadModifier(prefix: string, chunks: any) {
            for (const chunk of chunks.toString().split(' ')) {
              t.classes.add(`${prefix}${chunk}`);
            }
            return thisTw;
          }

          if (name === 'raw') {
            return (style: string) => spreadModifier('', style);
          }

          if (name === 'variant') {
            return (modifier: string, classes: any) =>
              spreadModifier(`[${modifier}]:`, classes);
          }

          if (variants.has(name) || name === 'important') {
            const prefix = name === 'important' ? '!' : `${name}:`;
            return (arg: any) => spreadModifier(prefix, arg);
          }

          t.classes.add(name);
        }

        t.prevProp = name;
        return thisTw;
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
};
