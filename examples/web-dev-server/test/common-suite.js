/*
@license https://github.com/t2ym/reportage/blob/master/LICENSE.md
Copyright (c) 2023 Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
import Config from './reportage.config.js'; // test suites know its config path
export { Config };
const { default: chai, assert } = await import(Config.resolve('@esm-bundle/chai/esm/chai.js'));
export { chai, assert };
const { default: Suite } = await import(Config.scenaristLoaderPath);
/*
const console = {
  log() {
    globalThis.console.log(...arguments);
    let log = localStorage.getItem('console.log');
    if (!log) {
      log = [];
    }
    else {
      log = JSON.parse(log);
    }
    log.push([...arguments]);
    localStorage.setItem('console.log', JSON.stringify(log, null, 2));
  }
}
*/
let scope = 'common';
let common = new Suite(scope, 'Description of Common Suite');
common.htmlSuite = '*';
// common-test.js global test classes
common.test = class CommonSuite extends Suite {
  async setup() {
    await super.setup();
    this.currentPhase = this._currentPhase;
    //console.log(`ExampleSuite.setup: currentPhase = ${this.currentPhase}`);
    //throw new Error('error at setup');
  }
  async teardown() {
    //let self = this;
    await super.teardown();
    //throw new Error('error at teardown');
    //await self.forEvent(self.container, 'dom-change', () => { self.container.if = false; }, true);
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
export default Suite;
