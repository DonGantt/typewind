const babel = require('@babel/core');

module.exports = function typewindTurbopackLoader(source) {
  const filename = this.resourcePath;
  const isTs = /\.tsx?$/.test(filename);

  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: ['typewind-v4/babel'],
    parserOpts: { plugins: isTs ? ['typescript', 'jsx'] : ['jsx'] },
  });

  if (!result || !result.code) return source;
  this.callback(null, result.code);
};
