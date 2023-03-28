/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import fs from "fs";
import path from "path";

const resolution_targets = [
  'scenarist/Suite.js',
  'mocha/mocha.js',
  'mocha/mocha.css',
  '@esm-bundle/chai/esm/chai.js',
];

const resolved_paths = {};

for (let i = 0; i < resolution_targets.length; i++) {
  let tmp = await import.meta.resolve(resolution_targets[i]);
  resolved_paths[resolution_targets[i]] = path.relative(path.dirname(import.meta.url), tmp);
}

fs.writeFileSync(
  path.join(path.dirname(import.meta.url), 'resolved-paths.js').substring(5),
  `export default ${JSON.stringify(resolved_paths, null, 2)}`
);
