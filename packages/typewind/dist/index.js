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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  tw: () => tw
});
module.exports = __toCommonJS(index_exports);

// src/runtime.ts
var fmtToTailwind = (s) => s.replace(/_/g, "-").replace(/^\$/, "@").replace(/\$/, "/");
var greyToGray = (s) => s.replace(/(^|-)grey(?=-|$)/g, "$1gray");
var knownClasses = /* @__PURE__ */ new Set();
try {
  if (typeof require !== "undefined" && typeof __dirname !== "undefined") {
    const _fs = require("fs");
    const _path = require("path");
    const metaPath = _path.join(__dirname, "_metadata.json");
    if (_fs.existsSync(metaPath)) {
      const meta = JSON.parse(_fs.readFileSync(metaPath, "utf8"));
      if (Array.isArray(meta.classSet)) knownClasses = new Set(meta.classSet);
    }
  }
} catch {
}
var typewind_id = Symbol.for("typewind_style");
function createRuntimeTw() {
  const twUsed = (classes = /* @__PURE__ */ new Set()) => {
    const target = Object.assign(() => {
    }, {
      classes,
      prevProp: void 0,
      maybeVariant: void 0,
      // proxy can't be used as string so convert it
      [Symbol.toPrimitive]() {
        if (target.maybeVariant) {
          target.classes.add(target.maybeVariant);
          target.maybeVariant = void 0;
        }
        return [...target.classes].join(" ");
      }
    });
    function spreadModifier(prefix, chunks) {
      for (const chunk of chunks.toString().split(" ")) {
        target.classes.add(`${prefix}${greyToGray(chunk)}`);
      }
    }
    const thisTw = new Proxy(target, {
      get(target2, p, _recv) {
        if (p === typewind_id) {
          return true;
        }
        if (p === "toString" || p === "valueOf" || p === Symbol.toPrimitive) {
          return target2[Symbol.toPrimitive];
        }
        const isStrProp = ""[p] !== void 0;
        if (isStrProp) {
          const prim = target2[Symbol.toPrimitive]();
          const value = prim[p];
          return typeof value === "function" ? value.bind(prim) : value;
        }
        if (typeof p !== "string") return null;
        const name = greyToGray(fmtToTailwind(p));
        if (target2.prevProp?.endsWith("-")) {
          const base = target2.prevProp.slice(0, -1);
          const namedClass = greyToGray(`${base}-${p}`);
          target2.classes.add(knownClasses.has(namedClass) ? namedClass : `${base}-[${p}]`);
        } else if (target2.prevProp?.endsWith("/")) {
          target2.classes.add(`${target2.prevProp}${name}`);
        } else if (!name.endsWith("-") && !name.endsWith("/")) {
          if (target2.maybeVariant) {
            target2.classes.add(target2.maybeVariant);
            target2.maybeVariant = void 0;
          }
          if (name === "raw") {
            return (style) => {
              spreadModifier("", style);
              return thisTw;
            };
          }
          if (name === "variant") {
            return (modifier, classes2) => {
              spreadModifier(`[${modifier}]:`, classes2);
              return thisTw;
            };
          }
          if (name === "important") {
            return (style) => {
              spreadModifier("!", style);
              return thisTw;
            };
          }
          target2.maybeVariant = name;
        }
        target2.prevProp = name;
        return thisTw;
      },
      apply(target2, _thisArg, [style]) {
        const prefix = target2.maybeVariant;
        if (!prefix) {
          throw new Error(
            "Typewind Error: unreachable code path, `maybeVariant` is undefined"
          );
        }
        target2.maybeVariant = void 0;
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
      }
    });
    return thisTw;
  };
  const tw2 = new Proxy(
    {},
    {
      get(_target, p) {
        if (typeof p !== "string") return Reflect.get(...arguments);
        return twUsed()[p];
      }
    }
  );
  return tw2;
}

// src/index.ts
var tw = createRuntimeTw();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  tw
});
