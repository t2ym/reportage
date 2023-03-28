/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
const { default: Suite } = await import(Config.scenaristLoaderPath);
let single = new Suite('single', 'Description of Single Suite');
single.htmlSuite = '/test/mocha.html';
single.test = class SingleTest extends Suite {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Single Test');
  }
}
single.test = class EmptyTest extends Suite {
  /*
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Empty Test');
  }
  */
}

export default Suite;