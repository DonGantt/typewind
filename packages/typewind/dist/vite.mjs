var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/vite.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
var IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".git", ".vite", "vendor"]);
var SOURCE_EXTS = [".tsx", ".ts", ".jsx", ".js"];
function collectSourceFiles(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
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
function collectStringLiterals(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectStringLiterals(item, out);
    return;
  }
  const n = node;
  if (typeof n.type !== "string") return;
  if (n.type === "StringLiteral" && typeof n.value === "string") out.push(n.value);
  for (const key of Object.keys(n)) {
    if (key === "loc" || key === "start" || key === "end" || key === "range") continue;
    collectStringLiterals(n[key], out);
  }
}
function hashSource(code) {
  return crypto.createHash("sha1").update(code).digest("hex");
}
function typewindVitePlugin() {
  const cache = /* @__PURE__ */ new Map();
  let projectRoot = "";
  function babel(code, id) {
    const hash = hashSource(code);
    const cached = cache.get(id);
    if (cached && cached.hash === hash) return cached;
    const babelCore = __require("@babel/core");
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
      },
      ast: true
    });
    if (!result?.code) return null;
    const out = {
      hash,
      code: result.code,
      map: result.map,
      ast: result.ast
    };
    cache.set(id, out);
    return out;
  }
  function writeClassesFile() {
    const classSet = /* @__PURE__ */ new Set();
    for (const file of collectSourceFiles(projectRoot)) {
      try {
        const code = fs.readFileSync(file, "utf8");
        const result = babel(code, file);
        if (result?.ast) {
          const strings = [];
          collectStringLiterals(result.ast, strings);
          for (const value of strings) {
            for (const cls of value.split(/\s+/)) {
              if (cls && cls.length <= 256 && !/^-?[0-9.]+$/.test(cls)) {
                classSet.add(cls);
              }
            }
          }
        }
      } catch {
      }
    }
    fs.writeFileSync(
      path.join(projectRoot, ".typewind-classes.txt"),
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
    // A deleted (or renamed-away-from) file's cache entry would otherwise
    // never leave the cache for the life of the dev server.
    watchChange(id, { event }) {
      if (event === "delete") cache.delete(id);
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
      const result = babel(code, id);
      return result && { code: result.code, map: result.map };
    }
  };
}
export {
  typewindVitePlugin
};
