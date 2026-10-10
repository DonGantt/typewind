#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { transform } from 'lightningcss';
import { createTypewindContext, loadConfig } from './utils';

function evalSimpleCalc(expr: string): string | null {
  const m = expr.trim().match(/^(-?[0-9.]+)(px|rem|em|%)?\s*([*/+-])\s*(-?[0-9.]+)(px|rem|em|%)?$/);
  if (!m) return null;
  const [, aNum, aUnit, op, bNum, bUnit] = m;
  const a = parseFloat(aNum);
  const b = parseFloat(bNum);

  let unit: string | undefined;
  if (op === '*' || op === '/') {
    unit = aUnit || bUnit;
  } else {
    if (aUnit && bUnit && aUnit !== bUnit) return null;
    unit = aUnit || bUnit;
  }

  let result: number;
  switch (op) {
    case '*': result = a * b; break;
    case '/': result = a / b; break;
    case '+': result = a + b; break;
    case '-': result = a - b; break;
    default: return null;
  }

  return `${result}${unit ?? ''}`;
}

function resolveCssValue(value: string, themeMap: Map<string, string>, depth = 0): string {
  if (depth > 10) return value;

  let resolved = value.replace(
    /calc\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    (match, inner) => {
      const resolvedInner = resolveCssValue(inner, themeMap, depth + 1);
      return evalSimpleCalc(resolvedInner) ?? match;
    }
  );

  resolved = resolved.replace(
    /var\((--[\w-]+)(?:\s*,\s*((?:[^()]|\([^()]*\))*))?\)/g,
    (match, name, fallback) => {
      const themeValue = themeMap.get(name);
      if (themeValue !== undefined) return resolveCssValue(themeValue, themeMap, depth + 1);
      if (fallback !== undefined) return resolveCssValue(fallback, themeMap, depth + 1);
      return match;
    }
  );

  return resolved;
}

function oklchToHex(lPercent: number, c: number, h: number): string {
  const L = lPercent / 100;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (channel: number) => {
    const clamped = Math.max(0, Math.min(1, channel));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  const toByte = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(gamma(channel) * 255)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');

  return `#${toHex(toByte(rLin))}${toHex(toByte(gLin))}${toHex(toByte(bLin))}`;
}

function resolveColorToHex(value: string): string | null {
  const match = value.match(
    /oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*[^)]+)?\s*\)/
  );
  if (!match) return null;
  return oklchToHex(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
}

function normalizeToPx(value: string, rootFontSize: number): number | null {
  const remMatch = value.match(/^(-?[0-9.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * rootFontSize;

  const pxMatch = value.match(/^(-?[0-9.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);

  return null;
}

function extractFirstRuleBody(css: string): string {
  const start = css.indexOf('{');
  if (start === -1) return css;
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return css.slice(start + 1);
}

function buildValueIndex(
  cssMap: Map<string, string>,
  themeMap: Map<string, string>,
  rootFontSize: number,
  families: string[]
): Record<string, Record<string, string>> {
  const sortedFamilies = [...families].sort((a, b) => b.length - a.length);
  const index: Record<string, Record<string, string>> = {};

  for (const [prop, css] of cssMap) {
    const stripped = prop.startsWith('_') ? prop.slice(1) : prop;
    const family = sortedFamilies.find(
      (fam) => stripped === fam || stripped.startsWith(fam + '_')
    );
    if (!family) continue;

    const declMatch = extractFirstRuleBody(css).match(/:\s*([^;]+);?/);
    if (!declMatch) continue;

    const resolved = resolveCssValue(declMatch[1].trim(), themeMap);
    const px = normalizeToPx(resolved, rootFontSize);
    if (px === null) continue;

    const key = String(px);
    index[family] ??= {};
    const existing = index[family][key];
    if (existing === undefined || (existing.startsWith('_') && !prop.startsWith('_'))) {
      index[family][key] = prop;
    }
  }

  return index;
}

function extractCssProperties(css: string): string[] {
  const props = new Set<string>();
  const declRegex = /([a-zA-Z-]+)\s*:\s*[^;{}]+;/g;
  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(css))) {
    const prop = match[1];
    if (prop.startsWith('-')) continue;
    props.add(prop);
  }
  return [...props];
}

function buildCssPropertyIndex(cssMap: Map<string, string>): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const [prop, css] of cssMap) {
    const properties = extractCssProperties(extractFirstRuleBody(css));
    if (properties.length > 0) index[prop] = properties;
  }
  return index;
}

function createDoc(
  css: string,
  showPixelEquivalents: boolean,
  rootFontSize: number,
  themeMap: Map<string, string>
): string {
  try {
    let formatted = transform({
      filename: 'doc.css',
      code: Buffer.from(css),
    }).code.toString()
      // Zero-width space prevents premature TSDoc comment close
      .replace(/\*\//g, '*​/');

    if (showPixelEquivalents) {
      formatted = formatted.replace(
        /^(\s*)([\w-]+):\s*([^;]+);/gm,
        (match, indent, prop, value) => {
          const annotated = value.replace(
            /(-?[0-9.]+)rem/g,
            (m: string, p1: string) => `${m} /* ${parseFloat(p1) * rootFontSize}px *​/`
          );
          if (annotated !== value) {
            return `${indent}${prop}: ${annotated};`;
          }

          const directHex = resolveColorToHex(value);
          if (directHex) {
            return `${indent}${prop}: ${value}; /* ${directHex} *​/`;
          }

          if (/var\(|calc\(/.test(value)) {
            const resolved = resolveCssValue(value.trim(), themeMap);

            const remMatch = resolved.match(/^(-?[0-9.]+)rem$/);
            if (remMatch) {
              return `${indent}${prop}: ${value}; /* ${parseFloat(remMatch[1]) * rootFontSize}px *​/`;
            }

            const resolvedHex = resolveColorToHex(resolved);
            if (resolvedHex) {
              return `${indent}${prop}: ${value}; /* ${resolvedHex} *​/`;
            }
          }

          return match;
        }
      );
    }

    return `
    * \`\`\`css
    * ${formatted.replace(/\n/g, '\n    * ')}
    * \`\`\`
  `;
  } catch {
    return '';
  }
}

// Utility families that support arbitrary values (tw.bg_.['#123'] → bg-[#123])
// These populate the Arbitrary type's _-suffixed properties.
const ARBITRARY_FAMILIES = [
  // Colors
  'bg', 'text', 'border', 'border-t', 'border-r', 'border-b', 'border-l',
  'border-x', 'border-y', 'border-s', 'border-e',
  'ring', 'ring-offset', 'fill', 'stroke', 'outline', 'caret', 'accent',
  'decoration', 'from', 'via', 'to', 'divide', 'placeholder',
  // Spacing
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  // Sizing
  'w', 'h', 'size', 'min-w', 'max-w', 'min-h', 'max-h', 'basis',
  // Positioning
  'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end',
  // Typography
  'font', 'tracking', 'leading', 'indent',
  'text-shadow',
  // Transforms
  'translate-x', 'translate-y', 'translate-z',
  'rotate', 'rotate-x', 'rotate-y', 'rotate-z',
  'scale', 'scale-x', 'scale-y', 'scale-z',
  'skew-x', 'skew-y',
  // Effects
  'opacity', 'shadow', 'shadow-color', 'drop-shadow',
  'blur', 'brightness', 'contrast', 'grayscale', 'hue-rotate',
  'invert', 'saturate', 'sepia',
  'backdrop-blur', 'backdrop-brightness', 'backdrop-contrast',
  'backdrop-grayscale', 'backdrop-hue-rotate', 'backdrop-invert',
  'backdrop-opacity', 'backdrop-saturate', 'backdrop-sepia',
  // Border radius
  'rounded', 'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l',
  'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl',
  'rounded-ss', 'rounded-se', 'rounded-ee', 'rounded-es',
  // Flex/Grid
  'z', 'order', 'grow', 'shrink', 'flex', 'columns', 'aspect',
  'grid-cols', 'grid-rows',
  'col-start', 'col-end', 'col-span', 'row-start', 'row-end', 'row-span',
  // Scroll
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mr',
  'scroll-mb', 'scroll-ml', 'scroll-ms', 'scroll-me',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pr',
  'scroll-pb', 'scroll-pl', 'scroll-ps', 'scroll-pe',
  // Animation
  'animate', 'duration', 'delay', 'ease',
  // Outline
  'outline-offset',
  // Perspective
  'perspective',
  // Transitions / filters / misc
  'transition', 'content', 'mask', 'will-change', 'cursor', 'line-clamp',
  'backdrop-filter', 'filter', 'origin',
];

// Decimal spacing steps (0.5, 1.5, 2.5, 3.5) can't appear in a JS identifier
// as a literal dot, and "_"/"$" are already claimed for "-"/"@"/"/" below, so
// "." round-trips through "__" (a sequence that never otherwise occurs, since
// it would require two adjacent hyphens or an empty class-name segment).
// Fractions (w-1/3) reuse the existing "/" <-> "$" encoding fmtToTailwind
// already decodes, so e.g. "w-1/3" <-> "w_1$3".
const fmtToTypewind = (s: string) =>
  s.replace(/\./g, '__').replace(/-/g, '_').replace(/^\@/, '$').replace(/\//g, '$');

const fmtToTailwind = (s: string) =>
  s.replace(/__/g, '.').replace(/_/g, '-').replace(/^\$/, '@').replace(/\$/, '/');

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

type ClassEntry = [string, { modifiers?: string[] }];

// Tailwind's color scale only ships under the "gray" spelling. Typewind
// accepts "grey" as an interchangeable alias, so every "*_gray_*" / "*_gray"
// / "gray_*" prop gets a same-shaped "grey" twin (mirrored at runtime in
// evaluate.ts / runtime.ts, which normalize "grey" back to "gray" before it
// ever reaches an actual Tailwind class name).
const greyAlias = (prop: string): string | null => {
  if (!/(^|_)gray(_|$)/.test(prop)) return null;
  return prop.replace(/(^|_)gray(?=_|$)/, '$1grey');
};

function processClassList(classList: ClassEntry[]): {
  standard: { prop: string; isColor: boolean }[];
  colorProps: Set<string>;
} {
  const standard: { prop: string; isColor: boolean }[] = [];
  const colorProps = new Set<string>();
  const seen = new Set<string>();

  for (const [name, meta] of classList) {
    // Skip classes with special characters (arbitrary values). Decimal
    // spacing steps (the dot in "mt-0.5") and fractions (the slash in
    // "w-1/3") are handled by fmtToTypewind's "." <-> "__" and "/" <-> "$"
    // encodings, so dots and slashes are allowed through.
    if (/[\[()]/.test(name)) continue;

    let prop: string;
    if (name.startsWith('-')) {
      // Negative values: -mx-4 → _mx_4
      prop = fmtToTypewind(name);
    } else {
      prop = fmtToTypewind(name);
    }

    // Skip if not a valid TS identifier
    if (!isValidIdentifier(prop) || seen.has(prop)) continue;
    seen.add(prop);

    const hasNumericModifiers =
      meta.modifiers &&
      meta.modifiers.length > 0 &&
      meta.modifiers.some((m) => /^\d+$/.test(m));

    if (hasNumericModifiers) {
      colorProps.add(prop);
    }

    standard.push({ prop, isColor: !!hasNumericModifiers });

    const grey = greyAlias(prop);
    if (grey && !seen.has(grey)) {
      seen.add(grey);
      if (hasNumericModifiers) colorProps.add(grey);
      standard.push({ prop: grey, isColor: !!hasNumericModifiers });
    }
  }

  return { standard, colorProps };
}

function buildTypeContent(
  standardClasses: { prop: string; isColor: boolean }[],
  variantNames: string[],
  opacityValues: string[],
  cssMap: Map<string, string>,
  showPixelEquivalents: boolean,
  rootFontSize: number,
  themeMap: Map<string, string>,
  negativeArbitraryFamilies: string[],
  noDocProps: Set<string>
): string {
  const opacityType =
    opacityValues.length > 0
      ? opacityValues.map((v) => JSON.stringify(v)).join(' | ')
      : 'string';

  const colorModifierMap = `{ [K in ${opacityType}]: Property } & Record<string, Property>`;

  // Build Standard type: all specific classes
  const standardProps = standardClasses
    .map(({ prop, isColor }) => {
      const css = noDocProps.has(prop) ? undefined : cssMap.get(prop);
      const doc = css ? `/** ${createDoc(css, showPixelEquivalents, rootFontSize, themeMap)} */\n  ` : '';
      const baseType = `${doc}"${prop}": Property`;
      if (isColor) {
        return `${baseType}; "${prop}$": ${colorModifierMap}`;
      }
      return baseType;
    })
    .concat([
      // `group`/`peer` are marker classes with no generated CSS (Tailwind
      // doesn't list them in getClassList, so they can't be discovered the
      // way other utilities are) and the bare names are already taken by the
      // group(style)/peer(style) variant functions below, so the marker
      // itself gets its own typed property.
      '/** The `group` marker class — gives descendants a target for `group-*` variants. */\n  "is_group": Property',
      '/** The `peer` marker class — gives following siblings a target for `peer-*` variants. */\n  "is_peer": Property',
    ])
    .join(';\n  ');

  // Build Arbitrary type: utility families that support arbitrary values.
  // Families that also have a negative class form (e.g. -mt-4) accept a
  // negative arbitrary form too (-mt-[0.2px]) — already compiles correctly
  // via the same generic "_"-prefixed trailing-hyphen mechanism as the
  // positive form, this just needed the matching typed property.
  const arbitraryProps = ARBITRARY_FAMILIES.flatMap((family) => {
    const prop = fmtToTypewind(family) + '_';
    const entries = [`"${prop}": Record<string, Property>`];
    if (negativeArbitraryFamilies.includes(family)) {
      entries.push(`"_${prop}": Record<string, Property>`);
    }
    return entries;
  }).join(';\n  ');

  // Build modifier methods.
  // "*" (direct children) and "**" (all descendants) aren't valid JS
  // identifiers, so they get readable names instead; evaluate.ts/runtime.ts
  // map them back to the literal Tailwind variant.
  const STAR_VARIANT_PROPS: Record<string, string> = { '*': 'children', '**': 'descendants' };
  const modifierMethods = variantNames
    .map((name) => {
      let prop = STAR_VARIANT_PROPS[name] ?? fmtToTypewind(name);
      // Prefix digit-starting names with _
      prop = /^\d/.test(prop) ? `_${prop}` : prop;
      if (!isValidIdentifier(prop)) return null;
      const base = `${prop}(style: Property): Property`;
      // group-*/peer-* variants (group-hover, peer-focus, ...) also accept a
      // named form (group-hover/sidebar:...) for scoping to a specific named
      // group/peer marker rather than the nearest ancestor.
      if (/^(group|peer)-/.test(name)) {
        return `${base};\n  ${prop}_named(name: string, style: Property): Property`;
      }
      return base;
    })
    .filter(Boolean)
    .join(';\n  ');

  return `type Property = Typewind & string;

type Standard = {
  ${standardProps}
};

type Arbitrary = {
  ${arbitraryProps}
};

type Typewind = Standard & Arbitrary & {
  ${modifierMethods};
  important(style: Property): Property;
  variant<T extends \`&\${string}\` | \`@\${string}\`>(variant: T, style: Property | string): Property;
  raw(style: string): Property;
  /** The named \`group/name\` marker class — scopes \`group-*_named(name, ...)\` variants to this specific group. */
  is_group_named(name: string): Property;
  /** The named \`peer/name\` marker class — scopes \`peer-*_named(name, ...)\` variants to this specific peer. */
  is_peer_named(name: string): Property;
}

declare const tw: Typewind;

export { tw };
`;
}

export async function generateTypes() {
  const config = loadConfig();
  const ctx = await createTypewindContext();

  const themeMap = new Map<string, string>();
  for (const [key, { value }] of ctx.theme.entries()) {
    themeMap.set(key, value);
  }

  const rawClassList = ctx.getClassList() as ClassEntry[];
  const existingNames = new Set(rawClassList.map(([name]) => name));

  const prefixCandidates = new Set<string>();
  for (const [name] of rawClassList) {
    if (name.startsWith('-') || /[.\[\/()]/.test(name)) continue;
    const parts = name.split('-');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('-');
      if (!existingNames.has(prefix)) prefixCandidates.add(prefix);
    }
  }
  const prefixList = [...prefixCandidates];
  const prefixCss = ctx.candidatesToCss(prefixList) as (string | null)[];
  const bareDefaultEntries: ClassEntry[] = prefixList
    .filter((_, i) => prefixCss[i])
    .map((name) => [name, {}]);

  // Self-extending numeric support: rather than pre-generating every bare
  // number/decimal/fraction Tailwind could theoretically accept (tried this —
  // it produced a 72,900-definition, 24MB d.ts that measurably slowed real
  // tsc/eslint runs, since the cost scales with definition count, not file
  // bytes), scan the project's own source for tw.<identifier> accesses that
  // don't already exist, decode each candidate back to a real Tailwind class
  // name via fmtToTailwind, and only type the ones actually used AND valid.
  // This keeps the type surface at "what this project uses" instead of
  // "everything Tailwind could ever accept" — near-zero added cost either way.
  const IGNORE_SCAN_DIRS = new Set([
    'node_modules', 'dist', 'build', '.git', '.next', '.vite', 'vendor',
    '.turbo', '.cache', 'coverage', 'out',
  ]);
  const SCAN_EXTS = ['.tsx', '.ts', '.jsx', '.js'];
  function collectScanFiles(dir: string, out: string[] = []): string[] {
    let entries: import('fs').Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_SCAN_DIRS.has(entry.name)) collectScanFiles(full, out);
      } else if (SCAN_EXTS.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
    return out;
  }

  const usedIdentifiers = new Set<string>();
  for (const file of collectScanFiles(process.cwd())) {
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter before the regex below: skip files that can't
    // possibly reference tw.* at all. Checking for a literal "tw." (rather
    // than requiring the typewind-v4 import itself) also covers projects
    // that re-export `tw` from a shared wrapper module, where the consuming
    // file never mentions "typewind-v4" directly.
    if (!code.includes('typewind-v4') && !code.includes("from 'typewind'") && !code.includes('tw.')) continue;
    // Only identifiers containing a digit can possibly be a numeric
    // extension (min_w_440, z_10000, w_1$9, _left_10__75); this skips
    // probing every ordinary method/property access in the file.
    for (const match of code.matchAll(/\.([a-zA-Z_$][a-zA-Z0-9_$]*\d[a-zA-Z0-9_$]*)/g)) {
      usedIdentifiers.add(match[1]);
    }
  }

  const numericCandidates = [...usedIdentifiers]
    .map((ident) => fmtToTailwind(ident))
    .filter((name) => !existingNames.has(name));
  const numericCss = numericCandidates.length
    ? (ctx.candidatesToCss(numericCandidates) as (string | null)[])
    : [];
  const numericEntries: ClassEntry[] = numericCandidates
    .filter((_, i) => numericCss[i])
    .map((name) => [name, {}]);
  // Bulk-generated numeric entries skip JSDoc generation (see buildTypeContent)
  // to keep per-entry cost minimal even though the set itself is now small.
  const noDocProps = new Set(numericEntries.map(([name]) => fmtToTypewind(name)));

  const classList = [...rawClassList, ...bareDefaultEntries, ...numericEntries];
  const { standard: standardClasses } = processClassList(classList);

  const rawVariants = ctx.getVariants() as {
    name: string;
    values: string[];
    isArbitrary: boolean;
  }[];
  const variantNames = rawVariants.map((v) => v.name);

  // Expand the container-query `@` variant with common breakpoint sizes
  const containerSizes = rawVariants
    .find((v) => v.name === '@')
    ?.values?.filter((v) => /^(xs|sm|md|lg|xl|2xl|3xs|2xs|3xl)$/.test(v)) ?? [
    'xs', 'sm', 'md', 'lg', 'xl', '2xl',
  ];
  const containerVariants = containerSizes.flatMap((size) => [
    `@${size}`,
    `@max-${size}`,
    `@min-${size}`,
  ]);

  // Every other parameterized variant (peer-hover, group-focus, max-xl,
  // min-sm, not-hover, in-focus, has-checked, aria-busy, ...) compounds the
  // same way: `${name}-${value}`. The "@" container-query family is excluded
  // since it's handled above with its own breakpoint-filtering and 3-form
  // (@size/@max-size/@min-size) expansion.
  const compoundVariants = rawVariants
    .filter((v) => v.values?.length > 0 && v.name !== '@' && v.name !== '@max' && v.name !== '@min')
    .flatMap((v) => v.values.map((value) => `${v.name}-${value}`));

  const variants = [...new Set([...variantNames, ...containerVariants, ...compoundVariants])];

  // Extract opacity scale from modifier values on color classes
  const opacityValues: string[] = [];
  {
    const opacitySet = new Set<string>();
    for (const [, meta] of classList) {
      if (!meta.modifiers) continue;
      for (const m of meta.modifiers) {
        if (/^\d+$/.test(m)) opacitySet.add(m);
      }
    }
    opacityValues.push(...[...opacitySet].sort((a, b) => Number(a) - Number(b)));
  }

  // Batch-fetch CSS for all standard classes for hover tooltips. "grey"
  // aliases have no real Tailwind candidate, so query Tailwind with the
  // "gray" spelling but key the resulting doc under the "grey" prop.
  const twClassNames = standardClasses.map(({ prop }) =>
    fmtToTailwind(prop).replace(/(^|-)grey(?=-|$)/, '$1gray')
  );
  const cssResults = ctx.candidatesToCss(twClassNames) as (string | null)[];
  const cssMap = new Map<string, string>();
  for (let i = 0; i < standardClasses.length; i++) {
    const css = cssResults[i];
    if (css) cssMap.set(standardClasses[i].prop, css);
  }

  const negativeArbitraryProbes = ARBITRARY_FAMILIES.map((family) => `-${family}-[0.2px]`);
  const negativeArbitraryCss = ctx.candidatesToCss(negativeArbitraryProbes) as (string | null)[];
  const negativeArbitraryFamilies = ARBITRARY_FAMILIES.filter((_, i) => negativeArbitraryCss[i]);

  const typeContent = buildTypeContent(
    standardClasses,
    variants,
    opacityValues,
    cssMap,
    config.showPixelEquivalents,
    config.rootFontSize,
    themeMap,
    negativeArbitraryFamilies,
    noDocProps,
  );

  const typewindDistDir = path.dirname(require.resolve('typewind-v4'));

  fs.writeFileSync(path.join(typewindDistDir, 'index.d.ts'), typeContent, 'utf8');

  // Named class set for smart arbitrary value lookup in evaluate.ts / runtime.ts.
  // Excludes actual arbitrary values ([...]) and opacity fractions (/), but
  // KEEPS decimal spacing classes like px-1.5, py-0.5 — these are valid named
  // Tailwind utilities that the type generator skips (can't be TS identifiers)
  // but the runtime must recognise as named, not arbitrary.
  const namedClassSet = classList
    .filter(([name]) => !/[\[\/()]/.test(name))
    .map(([name]) => name);

  const valueIndex = buildValueIndex(
    cssMap,
    themeMap,
    config.rootFontSize,
    ARBITRARY_FAMILIES.map(fmtToTypewind)
  );

  const classOrderPairs = ctx.getClassOrder(twClassNames) as [string, bigint | null][];
  const kebabToOrder = new Map<string, bigint>();
  for (const [kebab, pos] of classOrderPairs) {
    if (pos !== null) kebabToOrder.set(kebab, pos);
  }
  const classOrder = [
    // `group`/`peer` have no generated CSS, so Tailwind's own getClassOrder
    // has no opinion on where they sort — conventionally written first.
    'is_group',
    'is_peer',
    ...standardClasses
      .map(({ prop }, i) => ({ prop, order: kebabToOrder.get(twClassNames[i]) }))
      .sort((a, b) => {
        if (a.order === undefined && b.order === undefined) return 0;
        if (a.order === undefined) return 1;
        if (b.order === undefined) return -1;
        return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
      })
      .map(({ prop }) => prop),
  ];
  const cssProperties = buildCssPropertyIndex(cssMap);

  const metadata = {
    variants,
    classSet: namedClassSet,
    valueIndex,
    rootFontSize: config.rootFontSize,
    classOrder,
    cssProperties,
  };
  fs.writeFileSync(
    path.join(typewindDistDir, '_metadata.json'),
    JSON.stringify(metadata),
    'utf8'
  );

  // Generate a CSS file with @source inline() containing every named class.
  // This is imported by the project's index.css and is more reliable than
  // @source file scanning because it doesn't depend on the oxide scanner
  // recognising a .json file as a valid source.
  const sourceInlineCss = `@source inline("${namedClassSet.join(' ')}");`;
  fs.writeFileSync(
    path.join(typewindDistDir, '_typewind-source.css'),
    sourceInlineCss,
    'utf8'
  );

  // Create .typewind-classes.txt in the project root if it doesn't exist.
  // This file is the @source target for opacity modifiers and other classes
  // that only appear after the Babel transform.  The Vite plugin regenerates
  // it on every build/serve startup; we just ensure the file exists so that
  // @source never references a missing path (which would break CSS generation).
  const classesFilePath = path.join(process.cwd(), '.typewind-classes.txt');
  if (!fs.existsSync(classesFilePath)) {
    fs.writeFileSync(classesFilePath, '', 'utf8');
  }

  console.log(
    `✓ Generated ${standardClasses.length} type definitions with ${variants.length} variants`
  );
}

generateTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
