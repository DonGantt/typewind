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

// src/transform.ts
var transform_exports = {};
__export(transform_exports, {
  transformBabel: () => transformBabel,
  typewindTransforms: () => typewindTransforms
});
module.exports = __toCommonJS(transform_exports);
if (typeof process !== "undefined") {
  console.warn(
    '[typewind] typewind-v4/transform is deprecated and has no effect with Tailwind v4.\nRemove it from your tailwind.config and use the Vite plugin instead:\n  import { typewindVitePlugin } from "typewind-v4/vite"\n'
  );
}
var typewindTransforms = {};
var transformBabel = void 0;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  transformBabel,
  typewindTransforms
});
