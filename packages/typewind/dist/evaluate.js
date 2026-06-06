"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/evaluate.ts
var evaluate_exports = {};
__export(evaluate_exports, {
  createTw: () => createTw
});
module.exports = __toCommonJS(evaluate_exports);
var DEFAULT_VARIANTS = /* @__PURE__ */ new Set([
  // Pseudo-classes
  "hover",
  "focus",
  "active",
  "visited",
  "target",
  "focus-within",
  "focus-visible",
  "disabled",
  "enabled",
  "checked",
  "indeterminate",
  "default",
  "required",
  "optional",
  "valid",
  "invalid",
  "user-valid",
  "user-invalid",
  "in-range",
  "out-of-range",
  "placeholder-shown",
  "autofill",
  "read-only",
  "empty",
  "open",
  "inert",
  // Pseudo-elements
  "before",
  "after",
  "placeholder",
  "file",
  "marker",
  "selection",
  "first-line",
  "first-letter",
  "backdrop",
  "details-content",
  // Positional
  "first",
  "last",
  "only",
  "odd",
  "even",
  "first-of-type",
  "last-of-type",
  "only-of-type",
  "nth",
  "nth-last",
  "nth-of-type",
  "nth-last-of-type",
  "not",
  "has",
  "in",
  // Group / Peer
  "group",
  "group-hover",
  "group-focus",
  "group-active",
  "group-visited",
  "group-checked",
  "group-disabled",
  "group-focus-within",
  "group-focus-visible",
  "peer",
  "peer-hover",
  "peer-focus",
  "peer-active",
  "peer-checked",
  "peer-disabled",
  // ARIA
  "aria",
  "aria-busy",
  "aria-checked",
  "aria-disabled",
  "aria-expanded",
  "aria-hidden",
  "aria-pressed",
  "aria-readonly",
  "aria-required",
  "aria-selected",
  // Data
  "data",
  // Responsive breakpoints
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "max-sm",
  "max-md",
  "max-lg",
  "max-xl",
  "max-2xl",
  "min-sm",
  "min-md",
  "min-lg",
  "min-xl",
  "min-2xl",
  "min",
  "max",
  // Container queries (v4)
  "@",
  "@xs",
  "@sm",
  "@md",
  "@lg",
  "@xl",
  "@2xl",
  "@3xl",
  "@max",
  "@max-xs",
  "@max-sm",
  "@max-md",
  "@max-lg",
  "@max-xl",
  "@max-2xl",
  "@min",
  "@min-xs",
  "@min-sm",
  "@min-md",
  "@min-lg",
  "@min-xl",
  "@min-2xl",
  // Dark mode / Media features
  "dark",
  "print",
  "portrait",
  "landscape",
  "motion-safe",
  "motion-reduce",
  "contrast-more",
  "contrast-less",
  "forced-colors",
  "inverted-colors",
  "pointer-none",
  "pointer-coarse",
  "pointer-fine",
  "any-pointer-none",
  "any-pointer-coarse",
  "any-pointer-fine",
  "noscript",
  // Misc
  "ltr",
  "rtl",
  "starting",
  "supports"
]);
var variants = DEFAULT_VARIANTS;
var knownClasses = /* @__PURE__ */ new Set();
try {
  const fs = require("fs");
  const path = require("path");
  const metaPath = path.join(__dirname, "_metadata.json");
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.variants && Array.isArray(meta.variants)) {
      variants = /* @__PURE__ */ new Set([...DEFAULT_VARIANTS, ...meta.variants]);
    }
    if (meta.classSet && Array.isArray(meta.classSet)) {
      knownClasses = new Set(meta.classSet);
    }
  }
} catch {
}
var fmtToTailwind = (s) => s.replace(/_/g, "-").replace(/^\$/, "@").replace(/\$/, "/");
var createTw = () => {
  const twUsed = (classes = /* @__PURE__ */ new Set()) => {
    const target = {
      classes,
      prevProp: void 0,
      toString() {
        return [...target.classes].join(" ");
      }
    };
    const thisTw = new Proxy(target, {
      get(t, p, recv) {
        if (p === "toString") return Reflect.get(...arguments);
        if (typeof p !== "string") return null;
        const name = fmtToTailwind(p);
        if (t.prevProp?.endsWith("-")) {
          const base = t.prevProp.slice(0, -1);
          const namedClass = `${base}-${p}`;
          t.classes.add(knownClasses.has(namedClass) ? namedClass : `${base}-[${p}]`);
        } else if (t.prevProp?.endsWith("/")) {
          t.classes.add(`${t.prevProp}${name}`);
        } else if (!name.endsWith("-") && !name.endsWith("/")) {
          let spreadModifier2 = function(prefix, chunks) {
            for (const chunk of chunks.toString().split(" ")) {
              t.classes.add(`${prefix}${chunk}`);
            }
            return thisTw;
          };
          var spreadModifier = spreadModifier2;
          if (name === "raw") {
            return (style) => spreadModifier2("", style);
          }
          if (name === "variant") {
            return (modifier, classes2) => spreadModifier2(`[${modifier}]:`, classes2);
          }
          if (variants.has(name) || name === "important") {
            const prefix = name === "important" ? "!" : `${name}:`;
            return (arg) => spreadModifier2(prefix, arg);
          }
          t.classes.add(name);
        }
        t.prevProp = name;
        return thisTw;
      }
    });
    return thisTw;
  };
  const tw = new Proxy(
    {},
    {
      get(_target, p) {
        if (typeof p !== "string") return Reflect.get(...arguments);
        return twUsed()[p];
      }
    }
  );
  return tw;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createTw
});
