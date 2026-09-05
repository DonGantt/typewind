// DEPRECATED: typewind-v4/transform is not supported with Tailwind v4.
// Use the Vite plugin instead:
//
//   import { typewindVitePlugin } from 'typewind-v4/vite'
//
// In vite.config.ts:
//   plugins: [typewindVitePlugin(), ...]
//
// The content.transform API was removed in Tailwind v4.
// See the migration guide for details.

if (typeof process !== 'undefined') {
  console.warn(
    '[typewind] typewind-v4/transform is deprecated and has no effect with Tailwind v4.\n' +
      'Remove it from your tailwind.config and use the Vite plugin instead:\n' +
      '  import { typewindVitePlugin } from "typewind-v4/vite"\n'
  );
}

export const typewindTransforms: Record<string, never> = {} as Record<string, never>;
export const transformBabel = undefined;
