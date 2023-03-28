/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Resolved from './resolved-paths.js';
const mochaURL = (new URL(Resolved['mocha/mocha.js'], import.meta.url)).href;
const mochaResponse = await fetch(mochaURL);
const mochaScriptText = await mochaResponse.text();
// ignore search parameters in mocha.run()
const patchedMochaScript = mochaScriptText.replace('commonjsGlobal.location.search', "''")
  .replace('//# sourceMappingURL=mocha.js.map', '//# sourceMappingURL=' + (new URL('mocha.js.map', mochaURL)).href);
const mochaInstaller_raw = new Function('globalThis', 'self', 'console', patchedMochaScript);
export function mochaInstaller (_globalThis, _self = _globalThis, _console = console) {
  //console.log('mochaInstaller', _globalThis, _self, _console);
  return mochaInstaller_raw(_globalThis, _self, _console);
}