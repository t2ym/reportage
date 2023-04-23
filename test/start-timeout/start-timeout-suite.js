/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
if (location.origin !== Config.reporterOrigin) {
  const LOCAL_STORAGE_START_TIMEOUT_FAIL_COUNTER = 'LocalStorage:failcounter';
  const MAX_FAILURES = 3;
  let counter = parseInt(localStorage.getItem(LOCAL_STORAGE_START_TIMEOUT_FAIL_COUNTER) || '0');
  if (counter < MAX_FAILURES) {
    console.log(`start-timeout-suite.js: counter ${counter} < MAX_FAILURES ${MAX_FAILURES}`)
    counter++;
    localStorage.setItem(LOCAL_STORAGE_START_TIMEOUT_FAIL_COUNTER, counter);
    await new Promise(resolve => setTimeout(resolve, 5000));
    throw new Error(`failing to import ${import.meta.url}`);
    //await import('./inexistent-module.js');
  }
  else {
    console.log(`start-timeout-suite.js: counter ${counter} >= MAX_FAILURES ${MAX_FAILURES}`)
    //sessionStorage.removeItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER);
  }
}
const { default: Suite } = await import(Config.scenaristLoaderPath);
let start_timeout = new Suite('start_timeout', 'Description of Start Timeout Suite');
start_timeout.htmlSuite = '/test/mocha.html';
start_timeout.test = class SingleTest extends Suite {
  static get reconnectable() { return false; }
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Single Test');
  }
}

start_timeout.test = class SuccessiveSingleTest extends Suite {
  static get reconnectable() { return false; }
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Successive Single Test');
  }
}

export default Suite;