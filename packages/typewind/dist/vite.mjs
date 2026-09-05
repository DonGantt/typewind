var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/vite.ts
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
function typewindVitePlugin() {
  const cache = /* @__PURE__ */ new Map();
  let projectRoot = "";
  function babel(code, id) {
    const cacheKey = id + ":" + code;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
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
        const code = fs.readFileSync(file, "utf8");
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
export {
  typewindVitePlugin
};
