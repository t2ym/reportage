/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
/*
  Install a wrapped version of Suite to sandbox.Suite
  The wrapped version uses sandbox.describe, etc. when Suite.run(classes, target, sandbox) is called
  Suite class (not instance) object is unique and cannot be reset once loaded
 */
import { sandbox } from './sandbox-global.js';
import Resolved from './resolved-paths.js';
const scenaristResponse = await fetch(new URL(Resolved['scenarist/Suite.js'], import.meta.url)); // fetch the UMD version
const scenaristScriptText = await scenaristResponse.text();
// This patch expects scenarist 1.1.10
const scenaristScriptText_wrapped = scenaristScriptText
  .replace("this.scope = target || '';", "this.scope = target || '';this.file = (new Error().stack.split('\\n')[2]).replace(/^ *at ([^(]*):[0-9]*:[0-9]*$$/, '$$1')")
  .replace(/\(typeof ([A-Za-z]+) === 'function' \? ([A-Za-z]+) : ([A-Za-z]+)\)/g,
            "(typeof sandbox.$1 === 'function' ? sandbox.$2 : sandbox.$3)")
  .replace(/.call\(self, parameters\)/g, '.call(self, parameters, this)')
  .replace(/.call\(self\)/g, '.call(self, this)')
  .replace('self.setup()', 'self.setup(this)')
  .replace('self.teardown()', 'self.teardown(this)')
  .replace('run(classes, target)', 'run(classes, target, sandbox = globalThis)')
  .replace('instance[1].run()', 'instance[1].run(undefined, undefined, sandbox)');
const scenaristInstaller = new Function('module', 'exports', scenaristScriptText_wrapped);
const _module = {
  exports: {},
};
scenaristInstaller(_module, _module.exports); // disguise the UMD installer so that Suite can be installed at _module.exports
const Suite = _module.exports; // install Suite class into sandbox.Suite
Object.defineProperty(sandbox, 'Suite', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: Suite,
});
export default Suite;
