/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
const { default: Suite } = await import(Config.scenaristLoaderPath);
let close = new Suite('close', 'Description of Close Suite');
close.htmlSuite = '/test/mocha.html';
close.test = class SingleTest extends Suite {
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Single Test');
    //throw new Error('SingleTest failed')
  }
}
close.test = class CloseTest extends Suite {
  async operation(_this) {
    console.log('abrupt closing of window');
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.close();
    await new Promise(resolve => {
      window.addEventListener('beforeunload', (event) => {
        resolve();
        //while (true) {}
      });
    });
  }
  async checkpoint() {
    console.log('Checkpoint for Close Test');
  }
}

export default Suite;