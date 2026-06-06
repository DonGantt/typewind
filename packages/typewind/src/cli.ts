#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { transform } from 'lightningcss';
import { createTypewindContext, loadConfig } from './utils';

function createDoc(css: string, showPixelEquivalents: boolean, rootFontSize: number): string {
  try {
    let formatted = transform({
      filename: 'doc.css',
      code: Buffer.from(css),
    }).code.toString()
      // Zero-width space prevents premature TSDoc comment close
      .replace(/\*\//g, '*​/');

    if (showPixelEquivalents) {
      formatted = formatted.replace(
        /(-?[0-9.]+)rem/g,
        (match, p1) => `${match} /* ${parseFloat(p1) * rootFontSize}px *​/`
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
  'z', 'order', 'grow', 'shrink', 'flex', 'columns',
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
  }

  return { standard, colorProps };
}

function buildTypeContent(
  standardClasses: { prop: string; isColor: boolean }[],
  variantNames: string[],
  opacityValues: string[],
  cssMap: Map<string, string>,
  showPixelEquivalents: boolean,
  rootFontSize: number
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
      const doc = css ? `/** ${createDoc(css, showPixelEquivalents, rootFontSize)} */\n  ` : '';
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

  // Batch-fetch CSS for all standard classes for hover tooltips
  const twClassNames = standardClasses.map(({ prop }) => fmtToTailwind(prop));
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
  );

  const typewindDistDir = path.dirname(require.resolve('typewind'));

  fs.writeFileSync(path.join(typewindDistDir, 'index.d.ts'), typeContent, 'utf8');

  // Named class set for smart arbitrary value lookup in evaluate.ts / runtime.ts.
  // Excludes actual arbitrary values ([...]) and opacity fractions (/), but
  // KEEPS decimal spacing classes like px-1.5, py-0.5 — these are valid named
  // Tailwind utilities that the type generator skips (can't be TS identifiers)
  // but the runtime must recognise as named, not arbitrary.
  const namedClassSet = classList
    .filter(([name]) => !/[\[\/()]/.test(name))
    .map(([name]) => name);

  const metadata = { variants, classSet: namedClassSet };
  fs.writeFileSync(
    path.join(typewindDistDir, '_metadata.json'),
    JSON.stringify(metadata),
    'utf8'
  );

  console.log(
    `✓ Generated ${standardClasses.length} type definitions with ${variants.length} variants`
  );
}

generateTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
