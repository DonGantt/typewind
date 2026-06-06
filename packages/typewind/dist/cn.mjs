var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/cn.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// src/runtime.ts
var knownClasses = /* @__PURE__ */ new Set();
try {
  if (typeof __require !== "undefined" && typeof __dirname !== "undefined") {
    const _fs = __require("fs");
    const _path = __require("path");
    const metaPath = _path.join(__dirname, "_metadata.json");
    if (_fs.existsSync(metaPath)) {
      const meta = JSON.parse(_fs.readFileSync(metaPath, "utf8"));
      if (Array.isArray(meta.classSet)) knownClasses = new Set(meta.classSet);
    }
  }
} catch {
}
var typewind_id = Symbol.for("typewind_style");

// src/cn.ts
function cn(...inputs) {
  return twMerge(
    clsx(
      inputs.map((input) => {
        if (!input) return input;
        if (typeof input === "function" && input[typewind_id]) {
          return input.toString();
        }
        return input;
      })
    )
  );
}
export {
  cn
};
