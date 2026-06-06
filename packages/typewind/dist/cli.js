#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  generateTypes: () => generateTypes
});
module.exports = __toCommonJS(cli_exports);
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var import_lightningcss = require("lightningcss");

// src/utils.ts
var import_tailwindcss = require("tailwindcss");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
function loadConfig() {
  let pkg = {};
  try {
    pkg = require(import_path.default.join(process.cwd(), "package.json"));
  } catch {
  }
  return {
    cssEntry: "",
    showPixelEquivalents: false,
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
    const fullPath = import_path.default.resolve(process.cwd(), candidate);
    if (import_fs.default.existsSync(fullPath)) {
      const content = import_fs.default.readFileSync(fullPath, "utf8");
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
  return import_path.default.dirname(require.resolve("tailwindcss/package.json"));
}
async function loadModule(id, base) {
  try {
    const resolved = require.resolve(id, { paths: [base, process.cwd()] });
    const mod = require(resolved);
    return { module: mod, base: import_path.default.dirname(resolved) };
  } catch {
    throw new Error(
      `Typewind: Could not resolve @plugin '${id}'. Is it installed in your project?`
    );
  }
}
function makeStylesheetLoader(tailwindPkgDir) {
  return async function loadStylesheet(id, base) {
    if (id === "tailwindcss") {
      const indexCss = import_path.default.join(tailwindPkgDir, "index.css");
      return {
        content: import_fs.default.readFileSync(indexCss, "utf8"),
        base: tailwindPkgDir
      };
    }
    if (id.startsWith("tailwindcss/")) {
      const rel = id.replace("tailwindcss/", "");
      for (const candidate of [
        import_path.default.join(tailwindPkgDir, rel),
        import_path.default.join(tailwindPkgDir, rel + ".css")
      ]) {
        if (import_fs.default.existsSync(candidate)) {
          return {
            content: import_fs.default.readFileSync(candidate, "utf8"),
            base: tailwindPkgDir
          };
        }
      }
      return { content: "", base: tailwindPkgDir };
    }
    for (const candidate of [
      import_path.default.resolve(base, id),
      import_path.default.resolve(base, id + ".css")
    ]) {
      if (import_fs.default.existsSync(candidate)) {
        return {
          content: import_fs.default.readFileSync(candidate, "utf8"),
          base: import_path.default.dirname(candidate)
        };
      }
    }
    return { content: "", base };
  };
}
async function createTypewindContext() {
  const cssEntryPath = findCssEntryPath();
  const base = import_path.default.dirname(cssEntryPath);
  const cssContent = import_fs.default.readFileSync(cssEntryPath, "utf8");
  const tailwindPkgDir = findTailwindPkgDir();
  return await (0, import_tailwindcss.__unstable__loadDesignSystem)(cssContent, {
    base,
    loadStylesheet: makeStylesheetLoader(tailwindPkgDir),
    loadModule
  });
}

// src/cli.ts
function createDoc(css, showPixelEquivalents, rootFontSize) {
  try {
    let formatted = (0, import_lightningcss.transform)({
      filename: "doc.css",
      code: Buffer.from(css)
    }).code.toString().replace(/\*\//g, "*\u200B/");
    if (showPixelEquivalents) {
      formatted = formatted.replace(
        /(-?[0-9.]+)rem/g,
        (match, p1) => `${match} /* ${parseFloat(p1) * rootFontSize}px *\u200B/`
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
  "perspective"
];
var fmtToTypewind = (s) => s.replace(/-/g, "_").replace(/^\@/, "$");
var fmtToTailwind = (s) => s.replace(/_/g, "-").replace(/^\$/, "@").replace(/\$/, "/");
function isValidIdentifier(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}
function processClassList(classList) {
  const standard = [];
  const colorProps = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  for (const [name, meta] of classList) {
    if (/[.\[\/()]/.test(name)) continue;
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
  }
  return { standard, colorProps };
}
function buildTypeContent(standardClasses, variantNames, opacityValues, cssMap, showPixelEquivalents, rootFontSize) {
  const opacityType = opacityValues.length > 0 ? opacityValues.map((v) => JSON.stringify(v)).join(" | ") : "string";
  const colorModifierMap = `{ [K in ${opacityType}]: Property } & Record<string, Property>`;
  const standardProps = standardClasses.map(({ prop, isColor }) => {
    const css = cssMap.get(prop);
    const doc = css ? `/** ${createDoc(css, showPixelEquivalents, rootFontSize)} */
  ` : "";
    const baseType = `${doc}"${prop}": Property`;
    if (isColor) {
      return `${baseType}; "${prop}$": ${colorModifierMap}`;
    }
    return baseType;
  }).join(";\n  ");
  const arbitraryProps = ARBITRARY_FAMILIES.map((family) => {
    const prop = fmtToTypewind(family) + "_";
    return `"${prop}": Record<string, Property>`;
  }).join(";\n  ");
  const modifierMethods = variantNames.filter((name) => !["*", "**"].includes(name)).map((name) => {
    let prop = fmtToTypewind(name);
    prop = /^\d/.test(prop) ? `_${prop}` : prop;
    if (!isValidIdentifier(prop)) return null;
    return `${prop}(style: Property): Property`;
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
}

declare const tw: Typewind;

export { tw };
`;
}
async function generateTypes() {
  const config = loadConfig();
  const ctx = await createTypewindContext();
  const classList = ctx.getClassList();
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
  const peerValues = rawVariants.find((v) => v.name === "peer")?.values ?? [];
  const groupValues = rawVariants.find((v) => v.name === "group")?.values ?? [];
  const peerGroupVariants = [
    ...peerValues.map((v) => `peer-${v}`),
    ...groupValues.map((v) => `group-${v}`)
  ];
  const variants = [.../* @__PURE__ */ new Set([...variantNames, ...containerVariants, ...peerGroupVariants])];
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
  const twClassNames = standardClasses.map(({ prop }) => fmtToTailwind(prop));
  const cssResults = ctx.candidatesToCss(twClassNames);
  const cssMap = /* @__PURE__ */ new Map();
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
    config.rootFontSize
  );
  const typewindDistDir = import_path2.default.dirname(require.resolve("typewind"));
  import_fs2.default.writeFileSync(import_path2.default.join(typewindDistDir, "index.d.ts"), typeContent, "utf8");
  const namedClassSet = classList.filter(([name]) => !/[\[\/()]/.test(name)).map(([name]) => name);
  const metadata = { variants, classSet: namedClassSet };
  import_fs2.default.writeFileSync(
    import_path2.default.join(typewindDistDir, "_metadata.json"),
    JSON.stringify(metadata),
    "utf8"
  );
  console.log(
    `\u2713 Generated ${standardClasses.length} type definitions with ${variants.length} variants`
  );
}
generateTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateTypes
});
