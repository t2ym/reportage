/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import fs from "fs";
import path from "path";

const patch_targets = [
  'test/instrumented/extension/chrome/background.js',
  'test/instrumented/extension/chrome/content-script.js',
];

for (let i = 0; i < patch_targets.length; i++) {
  let script = fs.readFileSync(patch_targets[i]).toString();
  script = script.replace('new Function("return this")()', 'globalThis');
  fs.writeFileSync(patch_targets[i], script);
}
