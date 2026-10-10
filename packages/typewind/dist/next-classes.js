#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/next-classes.ts
var import_node_fs = __toESM(require("fs"));
var import_node_path = __toESM(require("path"));
var IGNORE_DIRS = /* @__PURE__ */ new Set(["node_modules", ".next", "dist", "build", ".git", "generated", ".vite", "vendor"]);
var SOURCE_EXTS = [".tsx", ".ts", ".jsx", ".js"];
function collectSourceFiles(dir) {
  const results = [];
  try {
    for (const entry of import_node_fs.default.readdirSync(dir, { withFileTypes: true })) {
      const full = import_node_path.default.join(dir, entry.name);
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
function writeClassesFile(srcDir, outFile) {
  const babel = require("@babel/core");
  const classSet = /* @__PURE__ */ new Set();
  for (const file of collectSourceFiles(srcDir)) {
    let code;
    try {
      code = import_node_fs.default.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!code.includes("typewind-v4")) continue;
    const ext = file.split(".").pop() ?? "ts";
    let result;
    try {
      result = babel.transformSync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        plugins: ["typewind-v4/babel"],
        parserOpts: {
          plugins: ext === "ts" || ext === "tsx" ? ["typescript", "jsx"] : ["jsx"]
        }
      });
    } catch {
      continue;
    }
    if (!result?.code) continue;
    for (const match of result.code.matchAll(/"([^"\\]+)"/g)) {
      for (const cls of match[1].split(/\s+/)) {
        if (cls && cls.length <= 256 && !/^-?[0-9.]+$/.test(cls)) classSet.add(cls);
      }
    }
  }
  import_node_fs.default.writeFileSync(outFile, [...classSet].join(" "), "utf8");
  return classSet.size;
}
function parseArgs(argv) {
  const args = { watch: false, src: "src", out: ".typewind-classes.txt" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--watch" || arg === "-w") args.watch = true;
    else if (arg === "--src") args.src = argv[++i] ?? args.src;
    else if (arg === "--out") args.out = argv[++i] ?? args.out;
  }
  return args;
}
function main() {
  const { watch, src, out } = parseArgs(process.argv.slice(2));
  const srcDir = import_node_path.default.resolve(process.cwd(), src);
  const outFile = import_node_path.default.resolve(process.cwd(), out);
  if (!import_node_fs.default.existsSync(srcDir)) {
    console.error(`typewind: source directory not found: ${srcDir}`);
    process.exit(1);
  }
  const run = () => {
    const count = writeClassesFile(srcDir, outFile);
    console.log(`typewind: wrote ${count} classes to ${import_node_path.default.relative(process.cwd(), outFile)}`);
  };
  run();
  if (watch) {
    let pending = null;
    const debouncedRun = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(run, 150);
    };
    import_node_fs.default.watch(srcDir, { recursive: true }, (_event, filename) => {
      if (filename && SOURCE_EXTS.some((ext) => filename.endsWith(ext))) {
        debouncedRun();
      }
    });
    console.log(`typewind: watching ${import_node_path.default.relative(process.cwd(), srcDir)} for changes...`);
  }
}
main();
