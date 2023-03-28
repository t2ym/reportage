/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
export { Config };
const { default: chai, assert } = await import(Config.resolve('@esm-bundle/chai/esm/chai.js'));
export { chai, assert };
const { default: Suite } = await import(Config.scenaristLoaderPath);
let scope = 'common';
let common = new Suite(scope, 'Description of Common Suite');
common.htmlSuite = '*';
// common-test.js global test classes
common.test = class CommonSuite extends Suite {
  async setup(_this) {
    await super.setup(_this);
    // hack until beforeEach() and afterEach() are implemented in scenarist
    const This = this;
    if (_this.test.parent._beforeEach.length == 0) {
      _this.test.parent._beforeEach.push(
        _this.test.parent._createHook(
          'beforeEach hook',
          async function () {
            await This.beforeEach(_this);
          }
        )
      );
    }
    if (_this.test.parent._afterEach.length == 0) {
      _this.test.parent._afterEach.push(
        _this.test.parent._createHook(
          'afterEach hook',
          async function () {
            await This.afterEach(_this);
          }
        )
      );
    }
    this.currentPhase = this._currentPhase;
    this.step = null;
  }
  async teardown(_this) {
    await super.teardown(_this);
  }
  async beforeEach(_this) {
    if (this.step === null) {
      this.step = 0;
    }
    else if (_this.currentTest.currentRetry() === 0) {
      this.step++;
    }
    const testURL = this.testURL(_this);
    _this.currentTest.context = [
      {
        title: 'testURL',
        value: testURL,
      },
    ];
  }
  async afterEach(_this) {
    switch (_this.currentTest.state) {
    case 'passed':
      break;
    case 'failed':
      //await this.screenshot(this.testURL(_this));
      break;
    case 'pending':
    default:
      break;
    }
  }
  nextPhase() {
    if (typeof this.phase !== 'number') {
      this.phase = 0;
    }
    return this.phase + 1;
  }
  stepPhase() {
    if (typeof this.phase === 'number') {
      this.phase++;
    }
    else {
      this.phase = 1;
    }
    return this.phase;
  }
  get _currentPhase() {
    if (this.target && typeof this.target.phase === 'number') {
      return this.target.phase;
    }
    else {
      return 0;
    }
  }
  hasToSkip() {
    if (typeof this.phase !== 'number') {
      this.phase = 0;
    }
    return this.phase !== this.currentPhase;
  }
  skipPhase(_this) {
    if (this.hasToSkip()) {
      // __failed is set as false as a workaround to avoid skipping subsequent tests in the current suite when skipAfterFailure is true
      this.__failed = false;
      _this.skip();
    }
  }
  testURL(_this) {
    const reporterURL = new URL(Config.reporterURL);
    const configPath = (reporterURL.hash.substring(1) || '/test/reportage.config.js').split('?')[0];
    return `${reporterURL.origin}${reporterURL.pathname}${reporterURL.search}` +
      `#${configPath}` +
      `?scope=${encodeURIComponent(this.target.suite.scope)}` +
      `&testIndex=${encodeURIComponent(this.target.suite.testIndex)}` +
      `&testClass=${encodeURIComponent(this.constructor.name)}` +
      `&testStep=${this.step}`;
  }
  addContext(testObj, context) {
    if (!testObj.test.context) {
      testObj.test.context = [];
    }
    testObj.test.context.push(context);
  }
  /*
  async screenshot(testURL) {
    let listener;
    let resolve;
    let reject;
    let promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });
    let timeoutId;
    window.addEventListener('screenshot-finished', listener = (event) => {
      window.removeEventListener('screenshot-finished', listener);
      clearTimeout(timeoutId);
      resolve(event.detail);
    });
    window.dispatchEvent(new CustomEvent('screenshot', { detail: { url: location.origin + '/*', format: 'png', quality: 100, testURL: testURL } }));
    timeoutId = setTimeout(() => {
      window.removeEventListener('screenshot-finished', listener);
      reject(new Error('screenshot timed out'));
    }, 100000);
    let result = await promise;
    console.log(`screenshot: screenshot-finished`, result);
    return result;
  }
  */
}
export default Suite;
