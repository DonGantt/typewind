// src/transform.ts
if (typeof process !== "undefined") {
  console.warn(
    '[typewind] typewind/transform is deprecated and has no effect with Tailwind v4.\nRemove it from your tailwind.config and use the Vite plugin instead:\n  import { typewindVitePlugin } from "typewind/vite"\n'
  );
}
var typewindTransforms = {};
var transformBabel = void 0;
export {
  transformBabel,
  typewindTransforms
};
