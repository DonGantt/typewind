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

// src/cn.ts
var cn_exports = {};
__export(cn_exports, {
  cn: () => cn
});
module.exports = __toCommonJS(cn_exports);
var import_clsx = require("clsx");
var import_tailwind_merge = require("tailwind-merge");

// src/runtime.ts
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

// src/cn.ts
function cn(...inputs) {
  return (0, import_tailwind_merge.twMerge)(
    (0, import_clsx.clsx)(
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cn
});
