import { NodePath, PluginObj, PluginPass, types as t } from '@babel/core';
import _eval from 'eval';
import generator from '@babel/generator';

export default function typewindBabelPlugin(): PluginObj<
  PluginPass & { classes: string[] }
> {
  const nodesReplaced = new Set<any>();

  return {
    name: 'typewind',
    pre() {
      this.classes ??= [];
    },
    visitor: {
      MemberExpression(path, state) {
        if (
          !t.isIdentifier(path.node.object) ||
          path.node.object.name !== 'tw'
        )
          return;

        let curPath = path as NodePath<any>;
        let prevPath: NodePath<any> = undefined!;

        while (
          curPath &&
          (t.isMemberExpression(curPath.node) ||
            (t.isCallExpression(curPath.node) &&
              (prevPath == undefined || prevPath.node == curPath.node.callee)))
        ) {
          prevPath = curPath!;
          curPath = curPath.parentPath!;
        }

        const code: string = generator(prevPath.node).code;

        const { result } = _eval(
          `
const { createTw } = require("typewind/dist/evaluate.js");
const tw = createTw();
try {
  let result$$ = ${code};
  if (typeof result$$ === 'function' || typeof result$$ === "undefined") {
    throw new Error()
  } else {
    exports.result = result$$.toString();
  }
} catch (error) {
  throw new Error(\`Error in evaluating typewind expression: ${code.replace(
    '`',
    '\\`'
  )}. \${error}\`)
}
`,
          __filename,
          {},
          true
        ) as { result: string };

        if (prevPath.node && !t.isStringLiteral(prevPath.node)) {
          nodesReplaced.add(prevPath.node);
          try {
            prevPath.replaceWith(t.stringLiteral(result));
          } catch {}
        }
      },
    },
  };
}

export function transformBabel(ext: string, content: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const babel = require('@babel/core') as typeof import('@babel/core');

  const config: import('@babel/core').TransformOptions = {
    filename: `typewind.${ext}`,
    plugins: ['typewind/babel'],
  };

  if (ext === 'ts' || ext === 'tsx') {
    config.presets = ['@babel/preset-typescript'];
  }
  if (ext === 'js' || ext === 'jsx') {
    config.plugins?.push('@babel/plugin-syntax-jsx');
  }

  const res = babel.transformSync(content, config);

  if (res?.code == undefined) {
    throw new Error('Failed to transform file');
  }

  return res.code;
}
