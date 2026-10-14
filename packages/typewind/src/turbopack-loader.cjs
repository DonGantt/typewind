const babel = require('@babel/core');

module.exports = function typewindTurbopackLoader(source, inputSourceMap) {
  const filename = this.resourcePath;
  const isTs = /\.tsx?$/.test(filename);

  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: ['typewind-v4/babel'],
    parserOpts: { plugins: isTs ? ['typescript', 'jsx'] : ['jsx'] },
    sourceMaps: true,
    inputSourceMap: inputSourceMap || undefined,
  });

  if (!result || !result.code) return this.callback(null, source, inputSourceMap);
  this.callback(null, result.code, result.map || undefined);
};
