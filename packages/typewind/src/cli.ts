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

          if (/var\(|calc\(/.test(value)) {
            const resolved = resolveCssValue(value.trim(), themeMap);
            const remMatch = resolved.match(/^(-?[0-9.]+)rem$/);
            if (remMatch) {
              return `${indent}${prop}: ${value}; /* ${parseFloat(remMatch[1]) * rootFontSize}px *​/`;
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
];

const fmtToTypewind = (s: string) =>
  s.replace(/-/g, '_').replace(/^\@/, '$');

const fmtToTailwind = (s: string) =>
  s.replace(/_/g, '-').replace(/^\$/, '@').replace(/\$/, '/');

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
    // Skip classes with special characters (arbitrary/fractional/dot-decimal)
    if (/[.\[\/()]/.test(name)) continue;

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
  themeMap: Map<string, string>
): string {
  const opacityType =
    opacityValues.length > 0
      ? opacityValues.map((v) => JSON.stringify(v)).join(' | ')
      : 'string';

  const colorModifierMap = `{ [K in ${opacityType}]: Property } & Record<string, Property>`;

  // Build Standard type: all specific classes
  const standardProps = standardClasses
    .map(({ prop, isColor }) => {
      const css = cssMap.get(prop);
      const doc = css ? `/** ${createDoc(css, showPixelEquivalents, rootFontSize, themeMap)} */\n  ` : '';
      const baseType = `${doc}"${prop}": Property`;
      if (isColor) {
        return `${baseType}; "${prop}$": ${colorModifierMap}`;
      }
      return baseType;
    })
    .join(';\n  ');

  // Build Arbitrary type: utility families that support arbitrary values
  const arbitraryProps = ARBITRARY_FAMILIES.map((family) => {
    const prop = fmtToTypewind(family) + '_';
    return `"${prop}": Record<string, Property>`;
  }).join(';\n  ');

  // Build modifier methods
  const modifierMethods = variantNames
    .filter((name) => !['*', '**'].includes(name))
    .map((name) => {
      let prop = fmtToTypewind(name);
      // Prefix digit-starting names with _
      prop = /^\d/.test(prop) ? `_${prop}` : prop;
      if (!isValidIdentifier(prop)) return null;
      return `${prop}(style: Property): Property`;
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

  const classList = ctx.getClassList() as ClassEntry[];
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

  // Expand peer-* and group-* compound variants from their values lists
  const peerValues = rawVariants.find((v) => v.name === 'peer')?.values ?? [];
  const groupValues = rawVariants.find((v) => v.name === 'group')?.values ?? [];
  const peerGroupVariants = [
    ...peerValues.map((v) => `peer-${v}`),
    ...groupValues.map((v) => `group-${v}`),
  ];

  const variants = [...new Set([...variantNames, ...containerVariants, ...peerGroupVariants])];

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

  const typeContent = buildTypeContent(
    standardClasses,
    variants,
    opacityValues,
    cssMap,
    config.showPixelEquivalents,
    config.rootFontSize,
    themeMap,
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
  const classOrder = standardClasses
    .map(({ prop }, i) => ({ prop, order: kebabToOrder.get(twClassNames[i]) }))
    .sort((a, b) => {
      if (a.order === undefined && b.order === undefined) return 0;
      if (a.order === undefined) return 1;
      if (b.order === undefined) return -1;
      return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
    })
    .map(({ prop }) => prop);
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
