/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
const { default: Suite } = await import(Config.scenaristLoaderPath);
//import Suite from './first-suite.js';
const { default: chai } = await import(Config.resolve('@esm-bundle/chai/esm/chai.js'));
if (location.origin !== Config.reporterOrigin &&
    new URL(location.href).pathname === '/test/mocha2.html') {
  const SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER = 'SessionStorage:failcounter';
  const MAX_FAILURES = 1;
  let counter = parseInt(sessionStorage.getItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER) || '0');
  if (counter < MAX_FAILURES) {
    counter++;
    console.log(`ready-timeout-suite.js: counter ${counter}`);
    sessionStorage.setItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER, counter);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await import('./inexistent-module.js');
  }
  else {
    //sessionStorage.removeItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER);
  }
}
let successive_ready_timeout = new Suite('successive_ready_timeout', 'Description of Successive Ready Timeout Suite');
successive_ready_timeout.htmlSuite = '/test/mocha2.html';
//successive_ready_timeout.test = Suite.scopes['first'].classes.FirstTest;
successive_ready_timeout.test = class SuccessiveSingleTest extends Suite {
  static get reconnectable() { return false; }
  async operation(_this) {
  }
  async checkpoint() {
    console.log('Checkpoint for Successive Single Test');
    chai.assert.equal(new URL(location.href).pathname, '/test/mocha2.html', 'pathname === /test/mocha2.html');
  }
}

/*
successive_ready_timeout.test = {
  FirstTest: {
    SuccessiveSingleTest: 'SuccessiveReadyTimeoutTest',
  },
};
*/

export default Suite;