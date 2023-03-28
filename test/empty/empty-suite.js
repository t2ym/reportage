/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js';
const { default: Suite } = await import(Config.scenaristLoaderPath);
let empty = new Suite('empty', 'Description of Empty Suite');
empty.htmlSuite = '/test/mocha.html';
/*
empty.test = class NonEmptyTest extends Suite {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Empty Test');
  }
}
*/
empty.test = class EmptyTest extends Suite {
  /*
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Empty Test');
  }
  */
}

export default Suite;