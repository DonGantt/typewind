import { PluginObj, PluginPass } from '@babel/core';

declare function typewindBabelPlugin(): PluginObj<PluginPass & {
    classes: string[];
}>;
declare function transformBabel(ext: string, content: string): string;

export { typewindBabelPlugin as default, transformBabel };
