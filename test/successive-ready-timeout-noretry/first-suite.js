/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
const { default: Suite } = await import(Config.scenaristLoaderPath);
let first = new Suite('first', 'Description of First Suite');
first.htmlSuite = '/test/mocha.html';
first.test = class FirstTest extends Suite {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for First Test');
  }
}

export default Suite;