/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import fs from 'fs';
import path from 'path';
import minimatch from 'minimatch';
import babel from '@babel/core';

import babelPluginIstanbul from 'babel-plugin-istanbul';

const babelPlugins = (await Promise.all([
  "async-generators",
  "class-properties",
  "dynamic-import",
  "import-meta",
  "numeric-separator",
  "object-rest-spread",
  "optional-catch-binding",
  "top-level-await",

  /* "big-int",
  "class-private-properties",
  "class-private-methods", */
].map(syntax => {
  return import(`@babel/plugin-syntax-${syntax}`)
}))).map(obj => obj.default);

babelPlugins.push([ babelPluginIstanbul, { compact: true, }]);

export function instrument(code, filename) {
  const result = babel.transform(code, {
    filename: filename,
    sourceMaps: "inline",
    presets: [],
    plugins: babelPlugins,
  });
  //console.log(result);
  return result.code;
}

export { minimatch };
