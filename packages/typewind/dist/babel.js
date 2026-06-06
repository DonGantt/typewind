"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/require-like/lib/require-like.js
var require_require_like = __commonJS({
  "../../node_modules/require-like/lib/require-like.js"(exports2, module2) {
    "use strict";
    var Module = require("module");
    var dirname = require("path").dirname;
    module2.exports = function requireLike(path, uncached) {
      var parentModule = new Module(path);
      parentModule.filename = path;
      parentModule.paths = Module._nodeModulePaths(dirname(path));
      function requireLike2(file) {
        var cache = Module._cache;
        if (uncached) {
          Module._cache = {};
        }
        var exports3 = Module._load(file, parentModule);
        Module._cache = cache;
        return exports3;
      }
      ;
      requireLike2.resolve = function(request) {
        var resolved = Module._resolveFilename(request, parentModule);
        return resolved instanceof Array ? resolved[1] : resolved;
      };
      try {
        requireLike2.paths = require.paths;
      } catch (e) {
      }
      requireLike2.main = process.mainModule;
      requireLike2.extensions = require.extensions;
      requireLike2.cache = require.cache;
      return requireLike2;
    };
  }
});

// ../../node_modules/eval/eval.js
var require_eval = __commonJS({
  "../../node_modules/eval/eval.js"(exports2, module2) {
    "use strict";
    var vm = require("vm");
    var isBuffer = Buffer.isBuffer;
    var requireLike = require_require_like();
    function merge(a, b) {
      if (!a || !b) return a;
      var keys = Object.keys(b);
      for (var k, i = 0, n = keys.length; i < n; i++) {
        k = keys[i];
        a[k] = b[k];
      }
      return a;
    }
    var vmGlobals = new vm.Script("Object.getOwnPropertyNames(globalThis)").runInNewContext();
    module2.exports = function(content, filename, scope, includeGlobals) {
      if (typeof filename !== "string") {
        if (typeof filename === "object") {
          includeGlobals = scope;
          scope = filename;
          filename = "";
        } else if (typeof filename === "boolean") {
          includeGlobals = filename;
          scope = {};
          filename = "";
        }
      }
      var sandbox = {};
      var exports3 = {};
      var _filename = filename || module2.parent.filename;
      if (includeGlobals) {
        merge(sandbox, global);
        Object.getOwnPropertyNames(global).forEach((name) => {
          if (!vmGlobals.includes(name)) {
            sandbox[name] = global[name];
          }
        });
        sandbox.console = console;
        sandbox.require = requireLike(_filename);
      }
      if (typeof scope === "object") {
        merge(sandbox, scope);
      }
      sandbox.exports = exports3;
      sandbox.module = {
        exports: exports3,
        filename: _filename,
        id: _filename,
        parent: module2.parent,
        require: sandbox.require || requireLike(_filename)
      };
      sandbox.global = sandbox;
      var options = {
        filename,
        displayErrors: false
      };
      if (isBuffer(content)) {
        content = content.toString();
      }
      if (typeof content === "string") {
        var stringScript = content.replace(/^\#\!.*/, "");
        var script = new vm.Script(stringScript, options);
        script.runInNewContext(sandbox, options);
      } else {
        content.runInNewContext(sandbox, options);
      }
      return sandbox.module.exports;
    };
  }
});

// src/babel.ts
var babel_exports = {};
__export(babel_exports, {
  default: () => typewindBabelPlugin,
  transformBabel: () => transformBabel
});
module.exports = __toCommonJS(babel_exports);
var import_core = require("@babel/core");
var import_eval = __toESM(require_eval());
var import_generator = __toESM(require("@babel/generator"));
function typewindBabelPlugin() {
  const nodesReplaced = /* @__PURE__ */ new Set();
  return {
    name: "typewind",
    pre() {
      this.classes ??= [];
    },
    visitor: {
      MemberExpression(path, state) {
        if (!import_core.types.isIdentifier(path.node.object) || path.node.object.name !== "tw")
          return;
        let curPath = path;
        let prevPath = void 0;
        while (curPath && (import_core.types.isMemberExpression(curPath.node) || import_core.types.isCallExpression(curPath.node) && (prevPath == void 0 || prevPath.node == curPath.node.callee))) {
          prevPath = curPath;
          curPath = curPath.parentPath;
        }
        const code = (0, import_generator.default)(prevPath.node).code;
        const { result } = (0, import_eval.default)(
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
            "`",
            "\\`"
          )}. \${error}\`)
}
`,
          __filename,
          {},
          true
        );
        if (prevPath.node && !import_core.types.isStringLiteral(prevPath.node)) {
          nodesReplaced.add(prevPath.node);
          try {
            prevPath.replaceWith(import_core.types.stringLiteral(result));
          } catch {
          }
        }
      }
    }
  };
}
function transformBabel(ext, content) {
  const babel = require("@babel/core");
  const config = {
    filename: `typewind.${ext}`,
    plugins: ["typewind/babel"]
  };
  if (ext === "ts" || ext === "tsx") {
    config.presets = ["@babel/preset-typescript"];
  }
  if (ext === "js" || ext === "jsx") {
    config.plugins?.push("@babel/plugin-syntax-jsx");
  }
  const res = babel.transformSync(content, config);
  if (res?.code == void 0) {
    throw new Error("Failed to transform file");
  }
  return res.code;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  transformBabel
});
