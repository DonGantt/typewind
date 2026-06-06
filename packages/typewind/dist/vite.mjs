var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/vite.ts
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
      const babelCore = __require("@babel/core");
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
export {
  typewindVitePlugin
};
