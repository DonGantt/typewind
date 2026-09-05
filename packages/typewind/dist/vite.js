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

// src/vite.ts
var vite_exports = {};
__export(vite_exports, {
  typewindVitePlugin: () => typewindVitePlugin
});
module.exports = __toCommonJS(vite_exports);
var import_node_fs = __toESM(require("fs"));
var import_node_path = __toESM(require("path"));
var IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".git", ".vite", "vendor"]);
var SOURCE_EXTS = [".tsx", ".ts", ".jsx", ".js"];
function collectSourceFiles(dir) {
  const results = [];
  try {
    for (const entry of import_node_fs.default.readdirSync(dir, { withFileTypes: true })) {
      const full = import_node_path.default.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) results.push(...collectSourceFiles(full));
      } else if (entry.isFile() && SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
  }
  return results;
}
function typewindVitePlugin() {
  const cache = /* @__PURE__ */ new Map();
  let projectRoot = "";
  function babel(code, id) {
    const cacheKey = id + ":" + code;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const babelCore = require("@babel/core");
    if (!babelCore) return null;
    const ext = id.split(".").pop() ?? "ts";
    const result = babelCore.transformSync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      plugins: ["typewind-v4/babel"],
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
  function writeClassesFile() {
    const classSet = /* @__PURE__ */ new Set();
    for (const file of collectSourceFiles(projectRoot)) {
      try {
        const code = import_node_fs.default.readFileSync(file, "utf8");
        const result = babel(code, file);
        if (result?.code) {
          for (const match of result.code.matchAll(/"([^"\\]+)"/g)) {
            for (const cls of match[1].split(/\s+/)) {
              if (cls && cls.length <= 256 && !/^-?[0-9.]+$/.test(cls)) {
                classSet.add(cls);
              }
            }
          }
        }
      } catch {
      }
    }
    import_node_fs.default.writeFileSync(
      import_node_path.default.join(projectRoot, ".typewind-classes.txt"),
      [...classSet].join(" "),
      "utf8"
    );
  }
  return {
    name: "typewind",
    // Run before @tailwindcss/vite so Tailwind sees the actual class strings
    enforce: "pre",
    configResolved(config) {
      projectRoot = config.root;
    },
    // Production / SSR builds: write the classes file before any transforms run.
    buildStart() {
      if (projectRoot) writeClassesFile();
    },
    // Dev server: buildStart is not called, so we write here instead.
    // configureServer fires before the server starts serving requests, so the
    // file exists by the time @tailwindcss/vite processes index.css.
    configureServer(_server) {
      if (projectRoot) writeClassesFile();
    },
    // Regenerate on file changes in dev mode so new classes are picked up.
    handleHotUpdate({ file }) {
      if (projectRoot && /\.(tsx?|jsx?)$/.test(file) && !file.includes("node_modules")) {
        writeClassesFile();
      }
    },
    transform(code, id) {
      if (!/\.(tsx?|jsx?)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      return babel(code, id);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  typewindVitePlugin
});
