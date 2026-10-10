#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/cli.ts
import fs2 from "fs";
import path2 from "path";
import { transform } from "lightningcss";

// src/utils.ts
import { __unstable__loadDesignSystem } from "tailwindcss";
import fs from "fs";
import path from "path";
function loadConfig() {
  let pkg = {};
  try {
    pkg = __require(path.join(process.cwd(), "package.json"));
  } catch {
  }
  return {
    cssEntry: "",
    showPixelEquivalents: true,
    rootFontSize: 16,
    ...pkg?.typewind
  };
}
var CSS_ENTRY_CANDIDATES = [
  "src/index.css",
  "src/app.css",
  "src/globals.css",
  "src/main.css",
  "app/index.css",
  "app/app.css",
  "app/globals.css",
  "index.css",
  "globals.css",
  "app.css"
];
var TW_IMPORT_PATTERNS = [
  '@import "tailwindcss"',
  "@import 'tailwindcss'",
  '@import "tailwindcss/',
  "@import 'tailwindcss/"
];
function findCssEntryPath() {
  const config = loadConfig();
  const searchPaths = config.cssEntry ? [config.cssEntry, ...CSS_ENTRY_CANDIDATES] : CSS_ENTRY_CANDIDATES;
  for (const candidate of searchPaths) {
    const fullPath = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (TW_IMPORT_PATTERNS.some((p) => content.includes(p))) {
        return fullPath;
      }
    }
  }
  throw new Error(
    [
      "Typewind: No Tailwind v4 CSS entry point found.",
      "",
      "Create a CSS file that imports tailwindcss:",
      '  @import "tailwindcss";',
      "",
      "Then specify its path in package.json:",
      '  "typewind": { "cssEntry": "./src/app.css" }',
      "",
      "See: https://tailwindcss.com/docs/installation"
    ].join("\n")
  );
}
function findTailwindPkgDir() {
  return path.dirname(__require.resolve("tailwindcss/package.json"));
}
async function loadModule(id, base) {
  try {
    const resolved = __require.resolve(id, { paths: [base, process.cwd()] });
    const mod = __require(resolved);
    return { module: mod, base: path.dirname(resolved) };
  } catch {
    throw new Error(
      `Typewind: Could not resolve @plugin '${id}'. Is it installed in your project?`
    );
  }
}
function makeStylesheetLoader(tailwindPkgDir) {
  return async function loadStylesheet(id, base) {
    if (id === "tailwindcss") {
      const indexCss = path.join(tailwindPkgDir, "index.css");
      return {
        content: fs.readFileSync(indexCss, "utf8"),
        base: tailwindPkgDir
      };
    }
    if (id.startsWith("tailwindcss/")) {
      const rel = id.replace("tailwindcss/", "");
      for (const candidate of [
        path.join(tailwindPkgDir, rel),
        path.join(tailwindPkgDir, rel + ".css")
      ]) {
        if (fs.existsSync(candidate)) {
          return {
            content: fs.readFileSync(candidate, "utf8"),
            base: tailwindPkgDir
          };
        }
      }
      return { content: "", base: tailwindPkgDir };
    }
    for (const candidate of [
      path.resolve(base, id),
      path.resolve(base, id + ".css")
    ]) {
      if (fs.existsSync(candidate)) {
        return {
          content: fs.readFileSync(candidate, "utf8"),
          base: path.dirname(candidate)
        };
      }
    }
    return { content: "", base };
  };
}
async function createTypewindContext() {
  const cssEntryPath = findCssEntryPath();
  const base = path.dirname(cssEntryPath);
  const cssContent = fs.readFileSync(cssEntryPath, "utf8");
  const tailwindPkgDir = findTailwindPkgDir();
  return await __unstable__loadDesignSystem(cssContent, {
    base,
    loadStylesheet: makeStylesheetLoader(tailwindPkgDir),
    loadModule
  });
}

// src/cli.ts
function evalSimpleCalc(expr) {
  const m = expr.trim().match(/^(-?[0-9.]+)(px|rem|em|%)?\s*([*/+-])\s*(-?[0-9.]+)(px|rem|em|%)?$/);
  if (!m) return null;
  const [, aNum, aUnit, op, bNum, bUnit] = m;
  const a = parseFloat(aNum);
  const b = parseFloat(bNum);
  let unit;
  if (op === "*" || op === "/") {
    unit = aUnit || bUnit;
  } else {
    if (aUnit && bUnit && aUnit !== bUnit) return null;
    unit = aUnit || bUnit;
  }
  let result;
  switch (op) {
    case "*":
      result = a * b;
      break;
    case "/":
      result = a / b;
      break;
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    default:
      return null;
  }
  return `${result}${unit ?? ""}`;
}
function resolveCssValue(value, themeMap, depth = 0) {
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
      if (themeValue !== void 0) return resolveCssValue(themeValue, themeMap, depth + 1);
      if (fallback !== void 0) return resolveCssValue(fallback, themeMap, depth + 1);
      return match;
    }
  );
  return resolved;
}
function oklchToHex(lPercent, c, h) {
  const L = lPercent / 100;
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gamma = (channel) => {
    const clamped = Math.max(0, Math.min(1, channel));
    return clamped <= 31308e-7 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  const toByte = (channel) => Math.max(0, Math.min(255, Math.round(gamma(channel) * 255)));
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(toByte(rLin))}${toHex(toByte(gLin))}${toHex(toByte(bLin))}`;
}
function resolveColorToHex(value) {
  const match = value.match(
    /oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*[^)]+)?\s*\)/
  );
  if (!match) return null;
  return oklchToHex(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
}
function normalizeToPx(value, rootFontSize) {
  const remMatch = value.match(/^(-?[0-9.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * rootFontSize;
  const pxMatch = value.match(/^(-?[0-9.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  return null;
}
function extractFirstRuleBody(css) {
  const start = css.indexOf("{");
  if (start === -1) return css;
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return css.slice(start + 1);
}
function buildValueIndex(cssMap, themeMap, rootFontSize, families) {
  const sortedFamilies = [...families].sort((a, b) => b.length - a.length);
  const index = {};
  for (const [prop, css] of cssMap) {
    const stripped = prop.startsWith("_") ? prop.slice(1) : prop;
    const family = sortedFamilies.find(
      (fam) => stripped === fam || stripped.startsWith(fam + "_")
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
    if (existing === void 0 || existing.startsWith("_") && !prop.startsWith("_")) {
      index[family][key] = prop;
    }
  }
  return index;
}
function extractCssProperties(css) {
  const props = /* @__PURE__ */ new Set();
  const declRegex = /([a-zA-Z-]+)\s*:\s*[^;{}]+;/g;
  let match;
  while (match = declRegex.exec(css)) {
    const prop = match[1];
    if (prop.startsWith("-")) continue;
    props.add(prop);
  }
  return [...props];
}
function buildCssPropertyIndex(cssMap) {
  const index = {};
  for (const [prop, css] of cssMap) {
    const properties = extractCssProperties(extractFirstRuleBody(css));
    if (properties.length > 0) index[prop] = properties;
  }
  return index;
}
function createDoc(css, showPixelEquivalents, rootFontSize, themeMap) {
  try {
    let formatted = transform({
      filename: "doc.css",
      code: Buffer.from(css)
    }).code.toString().replace(/\*\//g, "*\u200B/");
    if (showPixelEquivalents) {
      formatted = formatted.replace(
        /^(\s*)([\w-]+):\s*([^;]+);/gm,
        (match, indent, prop, value) => {
          const annotated = value.replace(
            /(-?[0-9.]+)rem/g,
            (m, p1) => `${m} /* ${parseFloat(p1) * rootFontSize}px *\u200B/`
          );
          if (annotated !== value) {
            return `${indent}${prop}: ${annotated};`;
          }
          const directHex = resolveColorToHex(value);
          if (directHex) {
            return `${indent}${prop}: ${value}; /* ${directHex} *\u200B/`;
          }
          if (/var\(|calc\(/.test(value)) {
            const resolved = resolveCssValue(value.trim(), themeMap);
            const remMatch = resolved.match(/^(-?[0-9.]+)rem$/);
            if (remMatch) {
              return `${indent}${prop}: ${value}; /* ${parseFloat(remMatch[1]) * rootFontSize}px *\u200B/`;
            }
            const resolvedHex = resolveColorToHex(resolved);
            if (resolvedHex) {
              return `${indent}${prop}: ${value}; /* ${resolvedHex} *\u200B/`;
            }
          }
          return match;
        }
      );
    }
    return `
    * \`\`\`css
    * ${formatted.replace(/\n/g, "\n    * ")}
    * \`\`\`
  `;
  } catch {
    return "";
  }
}
var ARBITRARY_FAMILIES = [
  // Colors
  "bg",
  "text",
  "border",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-x",
  "border-y",
  "border-s",
  "border-e",
  "ring",
  "ring-offset",
  "fill",
  "stroke",
  "outline",
  "caret",
  "accent",
  "decoration",
  "from",
  "via",
  "to",
  "divide",
  "placeholder",
  // Spacing
  "p",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "ps",
  "pe",
  "m",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "ms",
  "me",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  // Sizing
  "w",
  "h",
  "size",
  "min-w",
  "max-w",
  "min-h",
  "max-h",
  "basis",
  // Positioning
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  // Typography
  "font",
  "tracking",
  "leading",
  "indent",
  "text-shadow",
  // Transforms
  "translate-x",
  "translate-y",
  "translate-z",
  "rotate",
  "rotate-x",
  "rotate-y",
  "rotate-z",
  "scale",
  "scale-x",
  "scale-y",
  "scale-z",
  "skew-x",
  "skew-y",
  // Effects
  "opacity",
  "shadow",
  "shadow-color",
  "drop-shadow",
  "blur",
  "brightness",
  "contrast",
  "grayscale",
  "hue-rotate",
  "invert",
  "saturate",
  "sepia",
  "backdrop-blur",
  "backdrop-brightness",
  "backdrop-contrast",
  "backdrop-grayscale",
  "backdrop-hue-rotate",
  "backdrop-invert",
  "backdrop-opacity",
  "backdrop-saturate",
  "backdrop-sepia",
  // Border radius
  "rounded",
  "rounded-t",
  "rounded-r",
  "rounded-b",
  "rounded-l",
  "rounded-tl",
  "rounded-tr",
  "rounded-br",
  "rounded-bl",
  "rounded-ss",
  "rounded-se",
  "rounded-ee",
  "rounded-es",
  // Flex/Grid
  "z",
  "order",
  "grow",
  "shrink",
  "flex",
  "columns",
  "aspect",
  "grid-cols",
  "grid-rows",
  "col-start",
  "col-end",
  "col-span",
  "row-start",
  "row-end",
  "row-span",
  // Scroll
  "scroll-m",
  "scroll-mx",
  "scroll-my",
  "scroll-mt",
  "scroll-mr",
  "scroll-mb",
  "scroll-ml",
  "scroll-ms",
  "scroll-me",
  "scroll-p",
  "scroll-px",
  "scroll-py",
  "scroll-pt",
  "scroll-pr",
  "scroll-pb",
  "scroll-pl",
  "scroll-ps",
  "scroll-pe",
  // Animation
  "animate",
  "duration",
  "delay",
  "ease",
  // Outline
  "outline-offset",
  // Perspective
  "perspective",
  // Transitions / filters / misc
  "transition",
  "content",
  "mask",
  "will-change",
  "cursor",
  "line-clamp",
  "backdrop-filter",
  "filter",
  "origin"
];
var fmtToTypewind = (s) => s.replace(/\./g, "__").replace(/-/g, "_").replace(/^\@/, "$").replace(/\//g, "$");
var fmtToTailwind = (s) => s.replace(/__/g, ".").replace(/_/g, "-").replace(/^\$/, "@").replace(/\$/, "/");
function isValidIdentifier(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}
var greyAlias = (prop) => {
  if (!/(^|_)gray(_|$)/.test(prop)) return null;
  return prop.replace(/(^|_)gray(?=_|$)/, "$1grey");
};
function processClassList(classList) {
  const standard = [];
  const colorProps = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  for (const [name, meta] of classList) {
    if (/[\[()]/.test(name)) continue;
    let prop;
    if (name.startsWith("-")) {
      prop = fmtToTypewind(name);
    } else {
      prop = fmtToTypewind(name);
    }
    if (!isValidIdentifier(prop) || seen.has(prop)) continue;
    seen.add(prop);
    const hasNumericModifiers = meta.modifiers && meta.modifiers.length > 0 && meta.modifiers.some((m) => /^\d+$/.test(m));
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
function buildTypeContent(standardClasses, variantNames, opacityValues, cssMap, showPixelEquivalents, rootFontSize, themeMap, negativeArbitraryFamilies, noDocProps) {
  const opacityType = opacityValues.length > 0 ? opacityValues.map((v) => JSON.stringify(v)).join(" | ") : "string";
  const colorModifierMap = `{ [K in ${opacityType}]: Property } & Record<string, Property>`;
  const standardProps = standardClasses.map(({ prop, isColor }) => {
    const css = noDocProps.has(prop) ? void 0 : cssMap.get(prop);
    const doc = css ? `/** ${createDoc(css, showPixelEquivalents, rootFontSize, themeMap)} */
  ` : "";
    const baseType = `${doc}"${prop}": Property`;
    if (isColor) {
      return `${baseType}; "${prop}$": ${colorModifierMap}`;
    }
    return baseType;
  }).concat([
    // `group`/`peer` are marker classes with no generated CSS (Tailwind
    // doesn't list them in getClassList, so they can't be discovered the
    // way other utilities are) and the bare names are already taken by the
    // group(style)/peer(style) variant functions below, so the marker
    // itself gets its own typed property.
    '/** The `group` marker class \u2014 gives descendants a target for `group-*` variants. */\n  "is_group": Property',
    '/** The `peer` marker class \u2014 gives following siblings a target for `peer-*` variants. */\n  "is_peer": Property'
  ]).join(";\n  ");
  const arbitraryProps = ARBITRARY_FAMILIES.flatMap((family) => {
    const prop = fmtToTypewind(family) + "_";
    const entries = [`"${prop}": Record<string, Property>`];
    if (negativeArbitraryFamilies.includes(family)) {
      entries.push(`"_${prop}": Record<string, Property>`);
    }
    return entries;
  }).join(";\n  ");
  const STAR_VARIANT_PROPS = { "*": "children", "**": "descendants" };
  const modifierMethods = variantNames.map((name) => {
    let prop = STAR_VARIANT_PROPS[name] ?? fmtToTypewind(name);
    prop = /^\d/.test(prop) ? `_${prop}` : prop;
    if (!isValidIdentifier(prop)) return null;
    const base = `${prop}(style: Property): Property`;
    if (/^(group|peer)-/.test(name)) {
      return `${base};
  ${prop}_named(name: string, style: Property): Property`;
    }
    return base;
  }).filter(Boolean).join(";\n  ");
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
  /** The named \`group/name\` marker class \u2014 scopes \`group-*_named(name, ...)\` variants to this specific group. */
  is_group_named(name: string): Property;
  /** The named \`peer/name\` marker class \u2014 scopes \`peer-*_named(name, ...)\` variants to this specific peer. */
  is_peer_named(name: string): Property;
}

declare const tw: Typewind;

export { tw };
`;
}
async function generateTypes() {
  const config = loadConfig();
  const ctx = await createTypewindContext();
  const themeMap = /* @__PURE__ */ new Map();
  for (const [key, { value }] of ctx.theme.entries()) {
    themeMap.set(key, value);
  }
  const rawClassList = ctx.getClassList();
  const existingNames = new Set(rawClassList.map(([name]) => name));
  const prefixCandidates = /* @__PURE__ */ new Set();
  for (const [name] of rawClassList) {
    if (name.startsWith("-") || /[.\[\/()]/.test(name)) continue;
    const parts = name.split("-");
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join("-");
      if (!existingNames.has(prefix)) prefixCandidates.add(prefix);
    }
  }
  const prefixList = [...prefixCandidates];
  const prefixCss = ctx.candidatesToCss(prefixList);
  const bareDefaultEntries = prefixList.filter((_, i) => prefixCss[i]).map((name) => [name, {}]);
  const IGNORE_SCAN_DIRS = /* @__PURE__ */ new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    ".vite",
    "vendor",
    ".turbo",
    ".cache",
    "coverage",
    "out"
  ]);
  const SCAN_EXTS = [".tsx", ".ts", ".jsx", ".js"];
  function collectScanFiles(dir, out = []) {
    let entries;
    try {
      entries = fs2.readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      const full = path2.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_SCAN_DIRS.has(entry.name)) collectScanFiles(full, out);
      } else if (SCAN_EXTS.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
    return out;
  }
  const usedIdentifiers = /* @__PURE__ */ new Set();
  for (const file of collectScanFiles(process.cwd())) {
    let code;
    try {
      code = fs2.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!code.includes("typewind-v4") && !code.includes("from 'typewind'") && !code.includes("tw.")) continue;
    for (const match of code.matchAll(/\.([a-zA-Z_$][a-zA-Z0-9_$]*\d[a-zA-Z0-9_$]*)/g)) {
      usedIdentifiers.add(match[1]);
    }
  }
  const numericCandidates = [...usedIdentifiers].map((ident) => fmtToTailwind(ident)).filter((name) => !existingNames.has(name));
  const numericCss = numericCandidates.length ? ctx.candidatesToCss(numericCandidates) : [];
  const numericEntries = numericCandidates.filter((_, i) => numericCss[i]).map((name) => [name, {}]);
  const noDocProps = new Set(numericEntries.map(([name]) => fmtToTypewind(name)));
  const classList = [...rawClassList, ...bareDefaultEntries, ...numericEntries];
  const { standard: standardClasses } = processClassList(classList);
  const rawVariants = ctx.getVariants();
  const variantNames = rawVariants.map((v) => v.name);
  const containerSizes = rawVariants.find((v) => v.name === "@")?.values?.filter((v) => /^(xs|sm|md|lg|xl|2xl|3xs|2xs|3xl)$/.test(v)) ?? [
    "xs",
    "sm",
    "md",
    "lg",
    "xl",
    "2xl"
  ];
  const containerVariants = containerSizes.flatMap((size) => [
    `@${size}`,
    `@max-${size}`,
    `@min-${size}`
  ]);
  const compoundVariants = rawVariants.filter((v) => v.values?.length > 0 && v.name !== "@" && v.name !== "@max" && v.name !== "@min").flatMap((v) => v.values.map((value) => `${v.name}-${value}`));
  const variants = [.../* @__PURE__ */ new Set([...variantNames, ...containerVariants, ...compoundVariants])];
  const opacityValues = [];
  {
    const opacitySet = /* @__PURE__ */ new Set();
    for (const [, meta] of classList) {
      if (!meta.modifiers) continue;
      for (const m of meta.modifiers) {
        if (/^\d+$/.test(m)) opacitySet.add(m);
      }
    }
    opacityValues.push(...[...opacitySet].sort((a, b) => Number(a) - Number(b)));
  }
  const twClassNames = standardClasses.map(
    ({ prop }) => fmtToTailwind(prop).replace(/(^|-)grey(?=-|$)/, "$1gray")
  );
  const cssResults = ctx.candidatesToCss(twClassNames);
  const cssMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < standardClasses.length; i++) {
    const css = cssResults[i];
    if (css) cssMap.set(standardClasses[i].prop, css);
  }
  const negativeArbitraryProbes = ARBITRARY_FAMILIES.map((family) => `-${family}-[0.2px]`);
  const negativeArbitraryCss = ctx.candidatesToCss(negativeArbitraryProbes);
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
    noDocProps
  );
  const typewindDistDir = path2.dirname(__require.resolve("typewind-v4"));
  fs2.writeFileSync(path2.join(typewindDistDir, "index.d.ts"), typeContent, "utf8");
  const namedClassSet = classList.filter(([name]) => !/[\[\/()]/.test(name)).map(([name]) => name);
  const valueIndex = buildValueIndex(
    cssMap,
    themeMap,
    config.rootFontSize,
    ARBITRARY_FAMILIES.map(fmtToTypewind)
  );
  const classOrderPairs = ctx.getClassOrder(twClassNames);
  const kebabToOrder = /* @__PURE__ */ new Map();
  for (const [kebab, pos] of classOrderPairs) {
    if (pos !== null) kebabToOrder.set(kebab, pos);
  }
  const classOrder = [
    // `group`/`peer` have no generated CSS, so Tailwind's own getClassOrder
    // has no opinion on where they sort — conventionally written first.
    "is_group",
    "is_peer",
    ...standardClasses.map(({ prop }, i) => ({ prop, order: kebabToOrder.get(twClassNames[i]) })).sort((a, b) => {
      if (a.order === void 0 && b.order === void 0) return 0;
      if (a.order === void 0) return 1;
      if (b.order === void 0) return -1;
      return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
    }).map(({ prop }) => prop)
  ];
  const cssProperties = buildCssPropertyIndex(cssMap);
  const metadata = {
    variants,
    classSet: namedClassSet,
    valueIndex,
    rootFontSize: config.rootFontSize,
    classOrder,
    cssProperties
  };
  fs2.writeFileSync(
    path2.join(typewindDistDir, "_metadata.json"),
    JSON.stringify(metadata),
    "utf8"
  );
  const sourceInlineCss = `@source inline("${namedClassSet.join(" ")}");`;
  fs2.writeFileSync(
    path2.join(typewindDistDir, "_typewind-source.css"),
    sourceInlineCss,
    "utf8"
  );
  const classesFilePath = path2.join(process.cwd(), ".typewind-classes.txt");
  if (!fs2.existsSync(classesFilePath)) {
    fs2.writeFileSync(classesFilePath, "", "utf8");
  }
  console.log(
    `\u2713 Generated ${standardClasses.length} type definitions with ${variants.length} variants`
  );
}
generateTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
export {
  generateTypes
};
