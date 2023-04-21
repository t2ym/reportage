/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
if (location.origin !== Config.reporterOrigin &&
    parseInt((new URL(location)).searchParams.get('phase') || 0) > 0) {
  const SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER = 'SessionStorage:failcounter';
  const MAX_FAILURES = 1;
  let counter = parseInt(localStorage.getItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER) || '0');
  if (counter < MAX_FAILURES) {
    counter++;
    console.log(`ready-timeout-suite.js: counter ${counter}`);
    localStorage.setItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER, counter);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await import('./inexistent-module.js');
  }
  else {
    //sessionStorage.removeItem(SESSION_STORAGE_READY_TIMEOUT_FAIL_COUNTER);
  }
}
const { default: chai } = await import(Config.resolve('@esm-bundle/chai/esm/chai.js'));
const { default: Suite } = await import(Config.scenaristLoaderPath);
let phased_ready_timeout = new Suite('ready_timeout', 'Description of Phased Ready Timeout Suite');
phased_ready_timeout.htmlSuite = '/test/mocha.html';
let CommonSuite;
phased_ready_timeout.test = CommonSuite = class CommonSuite extends Suite {
  async setup(_this) {
    await super.setup(_this);
    const This = this;
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
  }
  async teardown(_this) {
    await super.teardown(_this);
  }
  async afterEach(_this) {
    //throw new Error(`afterEach ${_this.currentTest.title} this.currentTest.state:${_this.currentTest.state}`);
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
}
phased_ready_timeout.test = class Phase0Test extends CommonSuite {
  get description() { return `Description of Phase0 Test`; }
  async operation(_this) {
    this.skipPhase(_this);
    chai.assert.equal(sessionStorage.getItem('message from phase 0'), null, 'sessionStorage from phase 0 is null');
    chai.assert.equal(sessionStorage.getItem('message from phase 1'), null, 'sessionStorage from phase 1 is null');
    sessionStorage.setItem('message from phase 0', (sessionStorage.getItem('message from phase 0') || '') + 'sessionStorage is inherited');
  }
  async checkpoint() {
    console.log('Checkpoint for Phase 0 Test');
    chai.assert.equal(sessionStorage.getItem('message from phase 0'), 'sessionStorage is inherited', 'sessionStorage from phase 0 is set');
  }
}
phased_ready_timeout.test = (base) => class Phase1Test extends base {
  get description() { return `Description of Phase1 Test`; }
  static get reconnectable() { return false; }
  async operation(_this) {
    this.stepPhase();
    if (this.currentPhase + 1 === this.phase) {
      console.log('Phase 1 Test operation (deferred navigation)', this.phase, this.currentPhase);
      Object.assign(this.target, {
        phase: this.phase,
        _url: (new URL(`/test/mocha2.html?phase=${this.phase}`, location.href)).href,
        deferredNavigation() {
          const a = document.querySelector('#_link');
          a.href = this._url;
          a.click();
        },
      });
    }
  }
  async checkpoint(_this) {
    this.skipPhase(_this);
    console.log('Checkpoint for Phase 1 Test (deferred navigation)', this.phase, this.currentPhase, history.length, location.href);
    sessionStorage.setItem('message from phase 1', 'sessionStorage is inherited');
    chai.assert.equal(location.href, (new URL(`/test/mocha2.html?phase=${this.phase}`, location.href)).href, 'Deferred navigation URL');
    chai.assert.equal(sessionStorage.getItem('message from phase 0'), 'sessionStorage is inherited', 'sessionStorage from phase 0 is inherited');
  }
}
phased_ready_timeout.test = {
  '': [],
  Phase0Test: {
    Phase1Test: 'PhasedReadyTimeoutTest',
  },
};

export default Suite;