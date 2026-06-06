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

// src/vite.ts
var vite_exports = {};
__export(vite_exports, {
  typewindVitePlugin: () => typewindVitePlugin
});
module.exports = __toCommonJS(vite_exports);
function typewindVitePlugin() {
  const cache = /* @__PURE__ */ new Map();
  return {
    name: "typewind",
    // Run before @tailwindcss/vite so Tailwind sees the actual class strings
    enforce: "pre",
    transform(code, id) {
      if (!/\.(tsx?|jsx?)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      const cacheKey = id + ":" + code;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const babelCore = require("@babel/core");
      if (!babelCore) return null;
      const ext = id.split(".").pop() ?? "ts";
      const result = babelCore.transformSync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        plugins: ["typewind/babel"],
        sourceMaps: true,
        parserOpts: {
          plugins: ext === "ts" || ext === "tsx" ? ["typescript", "jsx"] : ["jsx"]
        }
      });
      if (!result?.code) return null;
      const out = { code: result.code, map: result.map };
      cache.set(cacheKey, out);
      return out;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  typewindVitePlugin
});
