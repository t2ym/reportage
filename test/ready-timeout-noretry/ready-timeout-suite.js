/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
if (location.origin !== Config.reporterOrigin) {
  const LOCAL_STORAGE_READY_TIMEOUT_FAIL_COUNTER = 'LocalStorage:failcounter';
  const MAX_FAILURES = 1;
  let counter = parseInt(localStorage.getItem(LOCAL_STORAGE_READY_TIMEOUT_FAIL_COUNTER) || '0');
  if (counter < MAX_FAILURES) {
    counter++;
    console.log(`ready-timeout-suite.js: counter ${counter}`);
    localStorage.setItem(LOCAL_STORAGE_READY_TIMEOUT_FAIL_COUNTER, counter);
    await new Promise(resolve => setTimeout(resolve, 5000));
    //await import('./inexistent-module.js');
  }
  else {
    //sessionStorage.removeItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER);
  }
}
const { default: Suite } = await import(Config.scenaristLoaderPath);
let ready_timeout = new Suite('ready_timeout', 'Description of Ready Timeout Suite');
ready_timeout.htmlSuite = '/test/mocha.html';
ready_timeout.test = class SingleTest extends Suite {
  static get reconnectable() { return false; }
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Single Test');
  }
}

ready_timeout.test = class SuccessiveSingleTest extends Suite {
  static get reconnectable() { return false; }
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Successive Single Test');
  }
}

export default Suite;